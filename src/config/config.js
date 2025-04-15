require('dotenv').config();

module.exports = {
    // Server Configuration
    server: {
        port: process.env.PORT || 3000,
        env: process.env.NODE_ENV || 'development',
    },

    // Redis Configuration
    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD,
        cluster: {
            enabled: process.env.REDIS_CLUSTER_ENABLED === 'true',
            nodes: (process.env.REDIS_CLUSTER_NODES || '').split(','),
        },
    },

    // RabbitMQ Configuration
    rabbitmq: {
        url: process.env.RABBITMQ_URL || 'amqp://localhost',
        queues: {
            execution: 'code-execution-queue',
            results: 'execution-results-queue',
        },
    },

    // Docker Configuration
    docker: {
        socketPath: (process.platform === 'win32' ? process.env.WIN_DOCKER_SOCKET : process.env.DOCKER_SOCKET) || (process.platform === 'win32' ? '\\.\pipe\docker_engine' : '/var/run/docker.sock'),
        containerConfig: {
            memory: process.env.CONTAINER_MEMORY_LIMIT || '6m',
            cpuPeriod: 100000,
            cpuQuota: Number(process.env.CONTAINER_CPU_QUOTA || 50000), // 50% CPU limit
            networkDisabled: true,
            readOnlyRootfs: true,
            autoRemove: true,
            timeout: Number(process.env.EXECUTION_TIMEOUT || 15000), // 15 seconds
        },
    },

    // Security Configuration
    security: {
        rateLimit: {
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: Number(process.env.RATE_LIMIT_MAX || 100),
        },
        maxCodeSize: Number(process.env.MAX_CODE_SIZE || 65536), // 64KB
        allowedLanguages: ['javascript', 'typescript', 'python', 'go'],
    },

    // Worker Configuration
    worker: {
        maxRetries: Number(process.env.WORKER_MAX_RETRIES || 3),
        concurrency: Number(process.env.WORKER_CONCURRENCY || 5),
        healthCheck: {
            interval: Number(process.env.HEALTH_CHECK_INTERVAL || 30000), // 30 seconds
            timeout: Number(process.env.HEALTH_CHECK_TIMEOUT || 5000), // 5 seconds
        },
    },
};