# Secure Online Judge System

A highly available, secure, and partition-tolerant online judge system for executing code in isolated environments. Built with Node.js, Docker, RabbitMQ, and Redis.

## Prerequisites

- Node.js 16+
- Docker
- Docker Compose

Note: RabbitMQ and Redis will be automatically set up using Docker Compose.

## Features

- Secure code execution in isolated Docker containers
- Resource limiting (CPU, memory, network, disk I/O)
- Distributed task queue with RabbitMQ
- High availability with Redis cluster
- Rate limiting and request validation
- Support for JavaScript, TypeScript, Python, and Go
- Circuit breakers and automatic recovery
- Health monitoring and logging

## Security Measures

- Isolated execution environments using Docker
- Read-only containers with no network access
- Resource quotas and limits
- Process count restrictions
- No privileged operations
- Input validation and sanitization
- Rate limiting per client
- Security headers with Helmet

## Prerequisites

- Node.js 16+
- Docker
- RabbitMQ
- Redis

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a .env file with the following variables:
   ```env
   PORT=3000
   NODE_ENV=production
   
   # Redis Configuration
   REDIS_HOST=localhost
   REDIS_PORT=6379
   REDIS_PASSWORD=secure_redis_password
   REDIS_CLUSTER_ENABLED=false
   
   # RabbitMQ Configuration
   RABBITMQ_URL=amqp://admin:secure_password@localhost:5672
   
   # Docker Configuration
   CONTAINER_MEMORY_LIMIT=256m
   CONTAINER_CPU_QUOTA=50000
   EXECUTION_TIMEOUT=15000
   
   # Security Configuration
   RATE_LIMIT_MAX=100
   MAX_CODE_SIZE=65536
   
   # Worker Configuration
   WORKER_MAX_RETRIES=3
   WORKER_CONCURRENCY=5
   ```

## Starting Services

1. Start the RabbitMQ and Redis services using Docker Compose:
   ```bash
   docker-compose up -d
   ```

2. Verify the services are running:
   ```bash
   docker-compose ps
   ```

3. Access the services:
   - RabbitMQ Management UI: http://localhost:15672 (username: admin, password: secure_password)
   - Redis is available on localhost:6379

4. To stop the services:
   ```bash
   docker-compose down
   ```

## API Endpoints

### Submit Code
`POST /submit`

Request body:
```json
{
  "code": "console.log('Hello World');",
  "language": "javascript"
}
```

Response:
```json
{
  "taskId": "abc123",
  "message": "Code submitted successfully",
  "statusUrl": "/status/abc123"
}
```

### Check Status
`GET /status/:taskId`

Response:
```json
{
  "taskId": "abc123",
  "success": true,
  "output": "Hello World\n",
  "executionTime": 156
}
```

## Architecture

- **API Server**: Express.js application handling HTTP requests
- **Task Queue**: RabbitMQ for distributing execution tasks
- **Worker Nodes**: Process code execution in Docker containers
- **Cache Layer**: Redis cluster for result caching and high availability
- **Execution Environment**: Isolated Docker containers with resource limits

## Error Handling

- Circuit breakers for external service failures
- Automatic retry mechanism with exponential backoff
- Dead letter queues for failed executions
- Graceful degradation during partial system failures

## Monitoring

- Health check endpoints
- Worker node status monitoring
- Resource usage tracking
- Error logging and alerting

## Development

```bash
# Start in development mode
npm run dev

# Run tests
npm test
```

## Production Deployment

1. Set up Redis cluster for high availability
2. Configure RabbitMQ with appropriate queues and exchanges
3. Deploy multiple worker nodes for load distribution
4. Set up monitoring and alerting
5. Start the application:
   ```bash
   npm start
   ```

## License

MIT