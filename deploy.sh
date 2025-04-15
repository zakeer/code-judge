#!/bin/bash

# Update system packages
sudo apt-get update
sudo apt-get upgrade -y

# Install Node.js and npm
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Docker and Docker Compose
sudo apt-get install -y apt-transport-https ca-certificates curl software-properties-common
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -
sudo add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable"
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Add current user to docker group
sudo usermod -aG docker $USER

# Install PM2 globally
sudo npm install -g pm2

# Create application directory
APP_DIR="/opt/code-judge"
sudo mkdir -p $APP_DIR
sudo chown -R $USER:$USER $APP_DIR

# Clone the application (replace with your repository URL)
cd $APP_DIR
git clone https://github.com/yourusername/code-judge.git .

# Install dependencies
npm install

# Setup environment variables
cat > .env << EOL
# Server Configuration
PORT=4000
NODE_ENV=production

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=secure_redis_password
REDIS_CLUSTER_ENABLED=false
REDIS_CLUSTER_NODES=

# RabbitMQ Configuration
RABBITMQ_URL=amqp://admin:secure_password@localhost:5672

# Docker Configuration
DOCKER_SOCKET=/var/run/docker.sock
CONTAINER_MEMORY_LIMIT=256m
CONTAINER_CPU_QUOTA=50000
EXECUTION_TIMEOUT=15000

# Security Configuration
RATE_LIMIT_MAX=100
MAX_CODE_SIZE=65536

# Worker Configuration
WORKER_MAX_RETRIES=3
WORKER_CONCURRENCY=2
HEALTH_CHECK_INTERVAL=30000
HEALTH_CHECK_TIMEOUT=5000
EOL

# Start Docker services
docker compose up -d

# Configure firewall
sudo ufw allow 4000/tcp
sudo ufw allow 5672/tcp
sudo ufw allow 15672/tcp
sudo ufw allow 6379/tcp

# Start the application with PM2
pm2 start src/index.js --name "code-judge-server"
pm2 startup
pm2 save

echo "Deployment completed successfully!"
echo "RabbitMQ Management UI: http://localhost:15672"
echo "Application running on port 4000"