const Docker = require('dockerode');
const config = require('../config/config');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

class ExecutionService {
  constructor() {
    this.docker = new Docker({
      socketPath: config.docker.socketPath
    });
    this.containerPools = {};
    this.initializePools();
    
    // Handle graceful shutdown
    process.on('SIGTERM', () => this.cleanup());
    process.on('SIGINT', () => this.cleanup());
  }

  async cleanup() {
    console.log('Cleaning up container pools...');
    try {
      for (const [language, pool] of Object.entries(this.containerPools)) {
        for (const containerInfo of pool) {
          await this.removeContainer(containerInfo);
        }
        this.containerPools[language] = [];
      }
      console.log('Container pools cleaned up successfully');
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
    process.exit(0);
  }

  async initializePools() {
    try {
      // Clean up any orphaned containers from previous crashes
      await this.cleanupOrphanedContainers();

      const languages = config.security.allowedLanguages;
      for (const language of languages) {
        this.containerPools[language] = [];
        await this.ensureContainerPool(language);
      }
      // Start container health check interval
      setInterval(() => this.checkContainerHealth(), 
        config.worker.healthCheck.interval);
    
    } catch (error) {
      console.error('Failed to initialize container pools:', error);
    }
  }

  async ensureContainerPool(language) {
    try {
      const poolSize = config.worker.concurrency;
      const currentPoolSize = this.containerPools[language].length;
      
      if (currentPoolSize < poolSize) {
        const imageName = this._getImageForLanguage(language);
        
        // Ensure image is pulled
        await new Promise((resolve, reject) => {
          this.docker.pull(imageName, (err, stream) => {
            if (err) return reject(err);
            this.docker.modem.followProgress(stream, (err, output) => {
              if (err) return reject(err);
              resolve(output);
            });
          });
        });

        // Create new containers to fill the pool
        const containersToCreate = poolSize - currentPoolSize;
        for (let i = 0; i < containersToCreate; i++) {
          const containerId = uuidv4();
          const containerConfig = this._createContainerConfig(language);
          const container = await this.docker.createContainer({
            ...containerConfig,
            name: `code-execution-pool-${language}-${containerId}`,
            Tty: true,
            OpenStdin: true,
            StdinOnce: false
          });
          
          await container.start();
          this.containerPools[language].push({
            id: containerId,
            container,
            busy: false,
            lastUsed: Date.now()
          });
        }
      }
    } catch (error) {
      console.error(`Failed to ensure container pool for ${language}:`, error);
      throw error;
    }
  }

  async checkContainerHealth() {
    for (const [language, pool] of Object.entries(this.containerPools)) {
      for (const containerInfo of pool) {
        try {
          const { container } = containerInfo;
          const state = await container.inspect();
          if (!state.State.Running) {
            // Remove and replace unhealthy container
            await this.removeContainer(containerInfo);
            await this.ensureContainerPool(language);
          }
        } catch (error) {
          console.error('Container health check failed:', error);
          await this.removeContainer(containerInfo);
          await this.ensureContainerPool(language);
        }
      }
    }
  }

  async getAvailableContainer(language) {
    const pool = this.containerPools[language];
    if (!pool) throw new Error(`No container pool for language: ${language}`);

    // Find available container
    const containerInfo = pool.find(c => !c.busy);
    if (!containerInfo) {
      // If all containers are busy, wait and retry
      await new Promise(resolve => setTimeout(resolve, 1000));
      return this.getAvailableContainer(language);
    }

    containerInfo.busy = true;
    containerInfo.lastUsed = Date.now();
    return containerInfo;
  }

  async executeCode(code, language, testCases) {
    let containerInfo;
    try {
      containerInfo = await this.getAvailableContainer(language);
      const { container } = containerInfo;

      // Create temporary file for code
      const fileName = this._getFileName(language);
      const filePath = path.join(os.tmpdir(), fileName);
      await fs.writeFile(filePath, code);

      // Copy code file to container
      await container.putArchive(
        await this.createTarFromFiles([{ path: filePath, name: fileName }]),
        { path: '/app' }
      );

      const results = [];
      for (const testCase of testCases) {
        // Create temporary file for current test case input
        const inputFileName = `input-${uuidv4()}.txt`;
        const inputFilePath = path.join(os.tmpdir(), inputFileName);
        await fs.writeFile(inputFilePath, testCase.input);

        // Copy input file to container
        await container.putArchive(
          await this.createTarFromFiles([{ path: inputFilePath, name: inputFileName }]),
          { path: '/app' }
        );

        // Execute code with current test case
        const exec = await container.exec({
          Cmd: this._getExecutionCommand(language, fileName, inputFileName),
          AttachStdout: true,
          AttachStderr: true
        });

        const execResult = await this._runExec(exec);
        testCase.setResult(execResult.output, execResult.executionTime);
        results.push(testCase.toJSON());

        // Clean up input file
        await fs.unlink(inputFilePath);
        await container.exec({
          Cmd: ['rm', `/app/${inputFileName}`],
          AttachStdout: true,
          AttachStderr: true
        });
      }

      // Clean up code file
      await fs.unlink(filePath);
      await container.exec({
        Cmd: ['rm', `/app/${fileName}`],
        AttachStdout: true,
        AttachStderr: true
      });

      return {
        success: results.every(r => r.passed),
        results,
        totalExecutionTime: results.reduce((sum, r) => sum + r.executionTime, 0)
      };

    } catch (error) {
      throw new Error(`Execution failed: ${error.message}`);
    } finally {
      if (containerInfo) {
        containerInfo.busy = false;
      }
    }
  }

  async createTarFromFiles(files) {
    const tar = require('tar-stream').pack();
    for (const file of files) {
      const fileContent = await fs.readFile(file.path);
      tar.entry({ name: file.name }, fileContent);
    }
    tar.finalize();
    return tar;
  }

  async _runExec(exec) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      let output = '';

      exec.start({
        Detach: false,
        Tty: true
      }, (err, stream) => {
        if (err) return reject(err);

        const timeout = setTimeout(() => {
          stream.destroy();
          reject(new Error('Execution timeout'));
        }, config.docker.containerConfig.timeout);

        stream.on('data', data => {
          // Convert buffer to string and clean up binary artifacts and control characters
          const cleanedData = data.toString('utf8')
            .replace(/^[\x00-\08F]*B(?=[C[{]E[a-zA-Z]|\d)/g, '') // Remove binary prefixex bpt tabJSxN, tentwlin (\x0A), aud caiexagsbr pleu(\x0D)00-\x09\x0B-\x1F\x7F-\x9F]07F '19]|/ Remove control rextmgded ASCII         .rreaocnrs(?<!\d)[!0-9]+(?=[\[{])/g, $') // Ree//.No malizp aine (ndi$,se JSON structures, but keep actual numbers
            .replace(/[\x00-\x1F]+(?=[\[{]|[a-zA-Z]|\d)/g, '') // Remove any remaining control chars before content
            .replace(/\r\n$/g, '\n')
            .replace(/\n$/g, '')
            .trim();

          output += cleanedData;
        });

        stream.on('end', async () => {
          clearTimeout(timeout);
          const execInspect = await exec.inspect();
          resolve({
            exitCode: execInspect.ExitCode,
            output,
            executionTime: Date.now() - startTime
          });
        });

        stream.on('error', err => {
          clearTimeout(timeout);
          reject(err);
        });
      });
    });
  }

  async cleanupOrphanedContainers() {
    try {
      const containers = await this.docker.listContainers({ all: true });
      for (const container of containers) {
        if (container.Names[0].startsWith('/code-execution-pool-')) {
          try {
            const dockerContainer = this.docker.getContainer(container.Id);
            await dockerContainer.remove({ force: true });
            console.log(`Removed orphaned container: ${container.Names[0]}`);
          } catch (error) {
            console.error(`Failed to remove orphaned container ${container.Names[0]}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('Failed to cleanup orphaned containers:', error);
    }
  }

  async removeContainer(containerInfo) {
    try {
      await containerInfo.container.remove({ force: true });
      const pool = this.containerPools[containerInfo.language];
      const index = pool.indexOf(containerInfo);
      if (index > -1) {
        pool.splice(index, 1);
      }
    } catch (error) {
      console.error('Failed to remove container:', error);
    }
  }

  _getExecutionCommand(language, fileName, inputFile) {
    // const inputFile = `input-${fileName}`;
    switch (language) {
      case 'javascript':
        return ['sh', '-c', `cat /app/${inputFile} | node /app/${fileName}`];
      case 'python':
        return ['sh', '-c', `cat /app/${inputFile} | python /app/${fileName}`];
      case 'go':
        return ['sh', '-c', `cat /app/${inputFile} | go run /app/${fileName}`];
      default:
        throw new Error(`Unsupported language: ${language}`);
    }
  }

  _createContainerConfig(language) {
    const memoryInBytes = Math.max(256 * 1024 * 1024, parseInt(config.docker.containerConfig.memory) * 1024 * 1024);

    const baseConfig = {
      Image: this._getImageForLanguage(language),
      WorkingDir: '/app',
      ...config.docker.containerConfig,
      HostConfig: {
        Memory: memoryInBytes,
        MemorySwap: memoryInBytes,
        CpuPeriod: config.docker.containerConfig.cpuPeriod,
        CpuQuota: config.docker.containerConfig.cpuQuota,
        NetworkDisabled: config.docker.containerConfig.networkDisabled,
        ReadonlyRootfs: false, // Temporarily disabled to allow file operations
        SecurityOpt: ['no-new-privileges'],
        PidsLimit: 50,
        AutoRemove: false, // Changed to false for pool containers
        Binds: [`${os.tmpdir()}:/app:rw`] // Mount host temp directory to container
      }
    };

    return baseConfig;
  }

  _getImageForLanguage(language) {
    const images = {
      javascript: 'node:16-alpine',
      typescript: 'node:16-alpine',
      python: 'python:3.9-alpine',
      go: 'golang:1.17-alpine'
    };

    if (!images[language]) {
      throw new Error(`Unsupported language: ${language}`);
    }

    return images[language];
  }

  _getFileName(language) {
    const extensions = {
      javascript: 'js',
      typescript: 'ts',
      python: 'py',
      go: 'go'
    };

    return `solution-${uuidv4()}.${extensions[language]}`;
  }
}

module.exports = new ExecutionService();