# Deployment Guide for Oracle Cloud VM Instance

## Prerequisites

1. Oracle Cloud Infrastructure (OCI) account
2. Oracle Cloud VM instance running Ubuntu 20.04 or later
3. SSH access to the VM instance

## Security Configuration

1. Configure Security List rules in OCI Console:
   - Allow TCP 4000 (Application)
   - Allow TCP 5672 (RabbitMQ)
   - Allow TCP 15672 (RabbitMQ Management)
   - Allow TCP 6379 (Redis)

2. Update security credentials:
   - Change default RabbitMQ credentials in `docker-compose.yml`
   - Update Redis password in `docker-compose.yml`
   - Modify corresponding credentials in `.env` file

## Deployment Steps

1. SSH into your Oracle Cloud VM instance:
   ```bash
   ssh ubuntu@<your-vm-ip>
   ```

2. Clone the repository and navigate to the project directory:
   ```bash
   git clone <your-repository-url>
   cd fullstack
   ```

3. Make the deployment script executable:
   ```bash
   chmod +x deploy.sh
   ```

4. Run the deployment script:
   ```bash
   ./deploy.sh
   ```

## Post-Deployment

1. Verify services are running:
   ```bash
   docker compose ps
   pm2 status
   ```

2. Monitor logs:
   ```bash
   # Application logs
   pm2 logs code-judge-server

   # Docker services logs
   docker compose logs
   ```

3. Access points:
   - Application: http://<your-vm-ip>:4000
   - RabbitMQ Management: http://<your-vm-ip>:15672

## Maintenance

1. Update application:
   ```bash
   git pull
   npm install
   pm2 restart code-judge-server
   ```

2. Restart services:
   ```bash
   docker compose restart
   pm2 restart code-judge-server
   ```

## Troubleshooting

1. Check service status:
   ```bash
   systemctl status docker
   docker compose ps
   pm2 status
   ```

2. View logs:
   ```bash
   pm2 logs
   docker compose logs
   ```

3. Common issues:
   - If services fail to start, check if ports are already in use
   - Verify environment variables in `.env` file
   - Ensure Docker daemon is running
   - Check disk space and system resources

## Backup

1. Database volumes:
   ```bash
   docker compose stop
   sudo tar -czf backup.tar.gz /var/lib/docker/volumes/
   docker compose start
   ```

2. Application data:
   ```bash
   tar -czf app_backup.tar.gz .env src package.json
   ```

## Security Best Practices

1. Keep system packages updated:
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

2. Monitor system logs:
   ```bash
   sudo journalctl -u docker
   sudo journalctl -u pm2-root
   ```

3. Regular security practices:
   - Use strong passwords
   - Keep Docker images updated
   - Monitor system resources
   - Implement regular backups
   - Review security group rules