#!/bin/bash
echo "=== Starting EC2 User Data Script ==="
echo "=== Deployment ID: ${deployment_id} ==="

echo "=== Updating system packages ==="
dnf update -y

echo "=== Installing nodejs, npm, git, nginx, openssl ==="
dnf install -y nodejs npm git nginx openssl

echo "=== Cloning repository ==="
cd /home/ec2-user
git clone ${github_repo_url}
cd goshenkata.com/${app_directory}

echo "=== Installing npm dependencies ==="
npm install

echo "=== Starting Node.js application in background ==="
nohup npm start > /home/ec2-user/app.log 2>&1 &
echo "Node.js app started with PID: $!"

echo "=== Generating self-signed SSL certificate ==="
mkdir -p /etc/nginx/ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/nginx/ssl/nginx.key \
  -out /etc/nginx/ssl/nginx.crt \
  -subj "/C=BG/ST=Sofia/L=Sofia/O=Goshenkata/CN=localhost"

# Set proper permissions for SSL files
chmod 600 /etc/nginx/ssl/nginx.key
chmod 644 /etc/nginx/ssl/nginx.crt
chown root:root /etc/nginx/ssl/nginx.key /etc/nginx/ssl/nginx.crt

# Verify SSL files exist
if [ -f "/etc/nginx/ssl/nginx.crt" ] && [ -f "/etc/nginx/ssl/nginx.key" ]; then
    echo "SSL certificate generated successfully"
    ls -la /etc/nginx/ssl/
else
    echo "ERROR: SSL certificate generation failed"
    exit 1
fi

echo "=== Configuring nginx with SSL ==="
cat > /etc/nginx/conf.d/nodeapp.conf << 'NGINX_CONFIG'
server {
    listen ${http_port};
    listen 443 ssl;
    server_name _;
    
    ssl_certificate /etc/nginx/ssl/nginx.crt;
    ssl_certificate_key /etc/nginx/ssl/nginx.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    
    location / {
        proxy_pass http://localhost:${app_port};
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
NGINX_CONFIG
echo "Nginx configuration written"

echo "=== Removing default nginx config ==="
rm -f /etc/nginx/conf.d/default.conf

echo "=== Testing nginx configuration ==="
nginx -t
if [ $? -eq 0 ]; then
    echo "Nginx configuration test passed"
else
    echo "ERROR: Nginx configuration test failed"
    cat /etc/nginx/conf.d/nodeapp.conf
    exit 1
fi

echo "=== Starting nginx service ==="
systemctl enable nginx
systemctl start nginx
echo "Nginx service status: $(systemctl is-active nginx)"

# Check if nginx started successfully
if [ "$(systemctl is-active nginx)" = "active" ]; then
    echo "Nginx started successfully"
else
    echo "ERROR: Nginx failed to start"
    systemctl status nginx
    journalctl -u nginx --no-pager
    exit 1
fi

echo "=== Setting file permissions ==="
chown -R ec2-user:ec2-user /home/ec2-user/goshenkata.com

echo "=== Setup complete! ==="
echo "Node.js logs: tail -f /home/ec2-user/app.log"
