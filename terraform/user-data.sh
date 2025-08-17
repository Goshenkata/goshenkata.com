#!/bin/bash
echo "=== Starting EC2 User Data Script ==="
echo "=== Deployment ID: ${deployment_id} ==="

echo "=== Updating system packages ==="
dnf update -y

echo "=== Installing openssl for SSL certificates ==="
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

echo "=== Creating SSL certificate directory ==="
mkdir -p /etc/nginx/ssl

echo "=== Generating self-signed SSL certificate for Cloudflare Full mode ==="
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/nginx.key \
    -out /etc/nginx/ssl/nginx.crt \
    -subj "/C=US/ST=State/L=City/O=Organization/CN=${domain_name}"

echo "=== Setting SSL certificate permissions ==="
chmod 600 /etc/nginx/ssl/nginx.key
chmod 644 /etc/nginx/ssl/nginx.crt

echo "=== Configuring nginx for Cloudflare Full encryption ==="

# Generate real_ip directives for IPv4 ranges
IPV4_REAL_IP=""
IFS=$'\n'
for ip in ${cloudflare_ipv4_ranges}; do
    if [ ! -z "$ip" ] && [ "$ip" != "" ]; then
        IPV4_REAL_IP="$IPV4_REAL_IP    set_real_ip_from $ip;"$'\n'
    fi
done

# Generate real_ip directives for IPv6 ranges  
IPV6_REAL_IP=""
for ip in ${cloudflare_ipv6_ranges}; do
    if [ ! -z "$ip" ] && [ "$ip" != "" ]; then
        IPV6_REAL_IP="$IPV6_REAL_IP    set_real_ip_from $ip;"$'\n'
    fi
done
unset IFS

cat > /etc/nginx/conf.d/nodeapp.conf << 'NGINX_CONFIG'
server {
    listen 443 ssl default_server;
    listen 80 default_server;
    server_name ${domain_name} www.${domain_name};
    
    # Access logging
    access_log /var/log/nginx/access.log combined;
    error_log /var/log/nginx/error.log;
    
    # SSL Configuration for Cloudflare Full mode
    ssl_certificate /etc/nginx/ssl/nginx.crt;
    ssl_certificate_key /etc/nginx/ssl/nginx.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-SHA256:ECDHE-RSA-AES256-SHA384;
    ssl_prefer_server_ciphers off;
    
    # Restore real visitor IP from Cloudflare headers
    real_ip_header CF-Connecting-IP;
    # IPv4 ranges
NGINX_CONFIG

# Append the dynamic IP ranges
echo "$IPV4_REAL_IP" >> /etc/nginx/conf.d/nodeapp.conf
echo "    # IPv6 ranges" >> /etc/nginx/conf.d/nodeapp.conf
echo "$IPV6_REAL_IP" >> /etc/nginx/conf.d/nodeapp.conf

# Append the rest of the configuration
cat >> /etc/nginx/conf.d/nodeapp.conf << 'NGINX_CONFIG'
    
    # Redirect HTTP to HTTPS
    if ($scheme != "https") {
        return 301 https://$host$request_uri;
    }
    
    location / {
        proxy_pass http://localhost:${app_port};
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        
        # Add some debugging headers
        add_header X-Debug-Server "nginx-ec2" always;
        add_header X-Debug-Upstream "nodejs-${app_port}" always;
    }
    
    # Health check endpoint
    location /health {
        access_log off;
        return 200 "OK - Nginx is running\n";
        add_header Content-Type text/plain;
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
echo "Nginx access logs: tail -f /var/log/nginx/access.log"
echo "Nginx error logs: tail -f /var/log/nginx/error.log"

echo "=== Deployment Information ==="
echo "EC2 Instance Public IP: $(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)"
echo "Domain configured: ${domain_name}"
echo "App running on port: ${app_port}"
echo "Test URLs:"
echo "  - Health check: https://${domain_name}/health"
echo "  - Main app: https://${domain_name}/"

echo "=== Troubleshooting commands ==="
echo "Check nginx status: systemctl status nginx"
echo "Check app process: ps aux | grep node"
echo "Test nginx config: nginx -t"
echo "View nginx config: cat /etc/nginx/conf.d/nodeapp.conf"
