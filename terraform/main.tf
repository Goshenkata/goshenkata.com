terraform {
  backend "s3" {
    bucket = "goshenkata-terraform-state"
    key    = "goshenkata/terraform.tfstate"
    region = "eu-central-1"
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "6.9.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# Default VPC and subnet
data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

# Security group for web traffic
resource "aws_security_group" "web_sg" {
  name_prefix = "${var.project_name}-web-"
  vpc_id      = data.aws_vpc.default.id

  tags = {
    Name = "${var.project_name}-Pweb-sg"
    Project = "${var.project_name}"
  }
}

# Security group ingress rule for HTTP traffic
resource "aws_vpc_security_group_ingress_rule" "http" {
  security_group_id = aws_security_group.web_sg.id
  description       = "HTTP"
  from_port         = var.http_port
  to_port           = var.http_port
  ip_protocol       = "tcp"
  cidr_ipv4         = "0.0.0.0/0"

  tags = {
    Name = "${var.project_name}-http-ingress"
  }
}

# Security group ingress rule for SSH traffic
resource "aws_vpc_security_group_ingress_rule" "ssh" {
  security_group_id = aws_security_group.web_sg.id
  description       = "SSH"
  from_port         = 22
  to_port           = 22
  ip_protocol       = "tcp"
  cidr_ipv4         = "0.0.0.0/0"

  tags = {
    Name = "${var.project_name}-ssh-ingress"
  }
}

# Security group ingress rule for HTTPS traffic
resource "aws_vpc_security_group_ingress_rule" "https" {
  security_group_id = aws_security_group.web_sg.id
  description       = "HTTPS"
  from_port         = 443
  to_port           = 443
  ip_protocol       = "tcp"
  cidr_ipv4         = "0.0.0.0/0"

  tags = {
    Name = "${var.project_name}-https-ingress"
  }
}

# Security group egress rule for all outbound traffic
resource "aws_vpc_security_group_egress_rule" "all_outbound" {
  security_group_id = aws_security_group.web_sg.id
  description       = "All outbound traffic"
  ip_protocol       = "-1"
  cidr_ipv4         = "0.0.0.0/0"

  tags = {
    Name = "${var.project_name}-all-egress"
  }
}

# User data script to setup Node.js, nginx and run the app
locals {
  user_data = <<-EOF
    #!/bin/bash
    echo "=== Starting EC2 User Data Script ==="
    echo "=== Deployment ID: ${var.deployment_id} ==="
    
    echo "=== Updating system packages ==="
    dnf update -y
    
    echo "=== Installing nodejs, npm, git, nginx, openssl ==="
    dnf install -y nodejs npm git nginx openssl
    
    echo "=== Cloning repository ==="
    cd /home/ec2-user
    git clone ${var.github_repo_url}
    cd goshenkata.com/${var.app_directory}
    
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
      -subj "/C=Bulgaria/ST=Sofia/L=Sofia/O=Goshenkata/CN=localhost"
    echo "SSL certificate generated"
    
    echo "=== Configuring nginx with SSL ==="
    echo "server {
        listen ${var.http_port};
        listen 443 ssl;
        server_name _;
        
        ssl_certificate /etc/nginx/ssl/nginx.crt;
        ssl_certificate_key /etc/nginx/ssl/nginx.key;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;
        
        location / {
            proxy_pass http://localhost:${var.app_port};
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
        }
    }" > /etc/nginx/conf.d/nodeapp.conf
    echo "Nginx configuration written"
    
    echo "=== Removing default nginx config ==="
    rm -f /etc/nginx/conf.d/default.conf
    
    echo "=== Starting nginx service ==="
    systemctl enable nginx
    systemctl start nginx
    echo "Nginx service status: $(systemctl is-active nginx)"
    
    echo "=== Setting file permissions ==="
    chown -R ec2-user:ec2-user /home/ec2-user/goshenkata.com
    
    echo "=== Setup complete! ==="
    echo "HTTP: http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)"
    echo "HTTPS: https://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)"
    echo "Node.js logs: tail -f /home/ec2-user/app.log"
  EOF
}

# EC2 instance using terraform-aws-modules
module "ec2_instance" {
  source  = "terraform-aws-modules/ec2-instance/aws"
  version = "~> 6.0.2"

  name = "${var.project_name}-web-server"

  instance_type               = var.instance_type
  ami                         = data.aws_ami.amazon_linux.id
  monitoring                  = false
  vpc_security_group_ids      = [aws_security_group.web_sg.id]
  subnet_id                   = data.aws_subnets.default.ids[0]
  associate_public_ip_address = true

  user_data_base64            = base64encode(local.user_data)
  user_data_replace_on_change = true  # This forces recreation when user_data changes

  tags = {
    Name = "${var.project_name}-web-server"
    Project = "${var.project_name}"
  }
}

# Get the latest Amazon Linux 2023 AMI
data "aws_ami" "amazon_linux" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-2023*"]
  }

  filter {
    name   = "architecture"
    values = ["x86_64"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }

  filter {
    name   = "usage-operation"
    values = ["RunInstances"]
  }
}

