# Nginx Reverse Proxy Setup

## Overview
This document describes the Nginx reverse proxy configuration for the Secure Online Judge System. The setup includes SSL/TLS support, rate limiting, compression, and security headers.

## Prerequisites

1. SSL Certificate
   - Before deploying, you need to obtain SSL certificates
   - Place your SSL certificate files in the `./ssl` directory:
     - `fullchain.pem`: Your certificate chain file
     - `privkey.pem`: Your private key file

## Features

- **SSL/TLS Configuration**
  - Enforces TLS 1.2 and 1.3
  - Optimized SSL cipher suites
  - HTTP to HTTPS redirection
  - HSTS enabled

- **Security Headers**
  - X-Frame-Options
  - X-XSS-Protection
  - X-Content-Type-Options
  - Content-Security-Policy
  - Referrer-Policy

- **Rate Limiting**
  - 10 requests per second per IP
  - Burst allowance of 20 requests

- **Performance**
  - Gzip compression enabled
  - Optimized proxy settings
  - Keep-alive connections

## Deployment

1. Create SSL Directory:
   ```bash
   mkdir ssl
   ```

2. Place SSL Certificates:
   - Copy your SSL certificates to the `ssl` directory
   - Ensure correct permissions:
     ```bash
     chmod 600 ssl/privkey.pem
     chmod 644 ssl/fullchain.pem
     ```

3. Start Services:
   ```bash
   docker-compose up -d
   ```

4. Verify Nginx Configuration:
   ```bash
   docker exec judge_nginx nginx -t
   ```

5. Access the Application:
   - HTTPS: https://your-domain
   - Health Check: https://your-domain/health

## Monitoring

- Nginx logs are available in the container at:
  - Access log: `/var/log/nginx/access.log`
  - Error log: `/var/log/nginx/error.log`

- View logs using Docker:
  ```bash
  docker logs judge_nginx
  ```