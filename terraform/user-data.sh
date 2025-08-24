#!/bin/bash
echo "=== Starting EC2 Bootstrap Script ==="
echo "=== Updating system packages ==="
dnf update -y

echo "=== Installing required packages ==="
dnf install -y nodejs npm git nginx openssl ruby wget

echo "=== Installing CodeDeploy agent ==="
cd /home/ec2-user
wget https://aws-codedeploy-eu-central-1.s3.eu-central-1.amazonaws.com/latest/install
chmod +x ./install
./install auto
systemctl enable codedeploy-agent
systemctl start codedeploy-agent

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
echo "${cloudflare_ipv4_ranges}" | while IFS= read -r ip; do
    if [ ! -z "$ip" ] && [ "$ip" != "" ]; then
        echo "    set_real_ip_from $ip;" >> /tmp/ipv4_ranges.txt
    fi
done

# Generate real_ip directives for IPv6 ranges  
IPV6_REAL_IP=""
echo "${cloudflare_ipv6_ranges}" | while IFS= read -r ip; do
    if [ ! -z "$ip" ] && [ "$ip" != "" ]; then
        echo "    set_real_ip_from $ip;" >> /tmp/ipv6_ranges.txt
    fi
done

cat > /etc/nginx/conf.d/nodeapp.conf << 'NGINX_CONFIG'
server {
    listen 443 ssl;
    listen 80;
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
if [ -f /tmp/ipv4_ranges.txt ]; then
    cat /tmp/ipv4_ranges.txt >> /etc/nginx/conf.d/nodeapp.conf
fi
echo "    # IPv6 ranges" >> /etc/nginx/conf.d/nodeapp.conf
if [ -f /tmp/ipv6_ranges.txt ]; then
    cat /tmp/ipv6_ranges.txt >> /etc/nginx/conf.d/nodeapp.conf
fi

# Append the rest of the configuration
cat >> /etc/nginx/conf.d/nodeapp.conf << 'NGINX_CONFIG'
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
}
NGINX_CONFIG
echo "Nginx configuration written"

# Clean up temporary files
rm -f /tmp/ipv4_ranges.txt /tmp/ipv6_ranges.txt

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

echo "=== Setting up ec2-user environment ==="
chown -R ec2-user:ec2-user /home/ec2-user

echo "=== Creating .env file in home directory ==="
cat > /home/ec2-user/.env <<'EOF'
NODE_ENV=production
PORT=${app_port}
DOMAIN=${domain_name}
# SSM parameters
${ssm_exports}
EOF
chown ec2-user:ec2-user /home/ec2-user/.env
chmod 600 /home/ec2-user/.env

# Load .env file for this session
set -a
source /home/ec2-user/.env
set +a

echo "=== Bootstrap complete! ==="
echo "CodeDeploy agent status: $(systemctl is-active codedeploy-agent)"
echo "Nginx status: $(systemctl is-active nginx)"
echo "System ready for CodeDeploy deployments"

echo "=== Troubleshooting commands ==="
echo "Check CodeDeploy agent: systemctl status codedeploy-agent"
echo "Check nginx status: systemctl status nginx"
echo "View nginx config: cat /etc/nginx/conf.d/nodeapp.conf"
