const amqp = require('amqplib');
const Redis = require('ioredis');
const config = require('../config/config');
const executionService = require('./executionService');
const TestCase = require('../models/TestCase');

class WorkerService {
  constructor() {
    this.channel = null;
    this.connection = null;
    this.redis = this._createRedisClient();
    this.retryCount = new Map();
  }

  async initialize() {
    try {
      // Connect to RabbitMQ
      this.connection = await amqp.connect(config.rabbitmq.url);
      this.channel = await this.connection.createChannel();

      // Assert queues
      await this.channel.assertQueue(config.rabbitmq.queues.execution, {
        durable: true,
        deadLetterExchange: 'dlx',
        deadLetterRoutingKey: 'failed-executions'
      });

      await this.channel.assertQueue(config.rabbitmq.queues.results);

      // Set up consumer with prefetch
      await this.channel.prefetch(config.worker.concurrency);
      
      // Start consuming messages
      this.channel.consume(
        config.rabbitmq.queues.execution,
        msg => this._processMessage(msg),
        { noAck: false }
      );

      // Set up health check interval
      this._startHealthCheck();

    } catch (error) {
      console.error('Failed to initialize worker:', error);
      throw error;
    }
  }

  async _processMessage(msg) {
    if (!msg) return;

    try {
      const task = JSON.parse(msg.content.toString());
      const { code, language, taskId, testCases } = task;

      // Transform test cases into TestCase instances
      const testCaseInstances = testCases.map(tc => 
        new TestCase(tc.input, tc.output, tc.description)
      );

      // Check cache first
      const cachedResult = await this.redis.get(`result:${taskId}`);
      if (cachedResult) {
        await this._publishResult(JSON.parse(cachedResult));
        this.channel.ack(msg);
        return;
      }

      // Execute code with test cases
      const result = await executionService.executeCode(code, language, testCaseInstances);

      // Cache result
      await this.redis.setex(
        `result:${taskId}`,
        3600, // Cache for 1 hour
        JSON.stringify({ taskId, ...result })
      );

      // Publish result
      await this._publishResult({ taskId, ...result });
      
      // Acknowledge message
      this.channel.ack(msg);
      
      // Reset retry count
      this.retryCount.delete(taskId);

    } catch (error) {
      const taskId = JSON.parse(msg.content.toString()).taskId;
      const retries = (this.retryCount.get(taskId) || 0) + 1;

      if (retries <= config.worker.maxRetries) {
        // Retry with exponential backoff
        this.retryCount.set(taskId, retries);
        setTimeout(() => {
          this.channel.nack(msg, false, true);
        }, Math.pow(2, retries) * 1000);
      } else {
        // Max retries reached, send to dead letter queue
        this.channel.nack(msg, false, false);
        this.retryCount.delete(taskId);
        
        // Publish error result
        await this._publishResult({
          taskId,
          success: false,
          error: 'Max retries exceeded'
        });
      }
    }
  }

  async _publishResult(result) {
    await this.channel.sendToQueue(
      config.rabbitmq.queues.results,
      Buffer.from(JSON.stringify(result)),
      { persistent: true }
    );
  }

  _createRedisClient() {
    if (config.redis.cluster.enabled) {
      return new Redis.Cluster(config.redis.cluster.nodes, {
        redisOptions: {
          password: config.redis.password
        }
      });
    }

    return new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password
    });
  }

  _startHealthCheck() {
    setInterval(async () => {
      try {
        // Check RabbitMQ connection
        if (!this.connection || !this.channel) {
          await this.initialize();
        }

        // Check Redis connection
        await this.redis.ping();

      } catch (error) {
        console.error('Health check failed:', error);
        // Attempt to reconnect
        this.initialize().catch(console.error);
      }
    }, config.worker.healthCheck.interval);
  }

  async shutdown() {
    try {
      if (this.channel) await this.channel.close();
      if (this.connection) await this.connection.close();
      await this.redis.quit();
    } catch (error) {
      console.error('Error during shutdown:', error);
    }
  }
}

module.exports = new WorkerService();