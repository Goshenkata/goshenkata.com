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
    http = {
      source  = "hashicorp/http"
      version = "~> 3.0"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5"
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

# Fetch Cloudflare IP ranges from official endpoints
data "http" "cloudflare_ipv4" {
  url = "https://www.cloudflare.com/ips-v4"
}

data "http" "cloudflare_ipv6" {
  url = "https://www.cloudflare.com/ips-v6"
}

locals {
  cloudflare_ipv4_ranges = split("\n", chomp(data.http.cloudflare_ipv4.response_body))
  cloudflare_ipv6_ranges = split("\n", chomp(data.http.cloudflare_ipv6.response_body))
}

# Security group ingress rules for HTTPS traffic (Cloudflare IPv4)
resource "aws_vpc_security_group_ingress_rule" "https_cloudflare_ipv4" {
  for_each = toset(local.cloudflare_ipv4_ranges)

  security_group_id = aws_security_group.web_sg.id
  description       = "HTTPS from Cloudflare IP ${each.value}"
  from_port         = 443
  to_port           = 443
  ip_protocol       = "tcp"
  cidr_ipv4         = each.value

  tags = {
    Name = "${var.project_name}-https-cloudflare-${replace(each.value, "/", "-")}"
  }
}

# Security group ingress rules for HTTPS traffic (Cloudflare IPv6)
resource "aws_vpc_security_group_ingress_rule" "https_cloudflare_ipv6" {
  for_each = toset(local.cloudflare_ipv6_ranges)

  security_group_id = aws_security_group.web_sg.id
  description       = "HTTPS from Cloudflare IPv6 ${each.value}"
  from_port         = 443
  to_port           = 443
  ip_protocol       = "tcp"
  cidr_ipv6         = each.value

  tags = {
    Name = "${var.project_name}-https-cloudflare-ipv6-${replace(each.value, "/", "-")}"
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
  user_data = templatefile("${path.module}/user-data.sh", {
    deployment_id        = var.deployment_id
    github_repo_url      = var.github_repo_url
    app_directory        = var.app_directory
    app_port            = var.app_port
    domain_name         = var.domain_name
    cloudflare_ipv4_ranges = join("\n", local.cloudflare_ipv4_ranges)
    cloudflare_ipv6_ranges = join("\n", local.cloudflare_ipv6_ranges)
  })
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

# Cloudflare provider configuration
provider "cloudflare" {
  # API token will be provided via CLOUDFLARE_API_TOKEN environment variable
}

# Get the Cloudflare zone for the domain
data "cloudflare_zones" "domain" {
  filter {
    name = var.domain_name
  }
}

# Create A record for the root domain
resource "cloudflare_record" "root" {
  zone_id = data.cloudflare_zones.domain.zones[0].id
  name    = "@"
  content = module.ec2_instance.public_ip
  type    = "A"
  ttl     = 300
  proxied = true
  comment = "Managed by Terraform - Points to EC2 instance"

  tags = ["terraform", "ec2"]
}

# Create A record for www subdomain
resource "cloudflare_record" "www" {
  zone_id = data.cloudflare_zones.domain.zones[0].id
  name    = "www"
  content = module.ec2_instance.public_ip
  type    = "A"
  ttl     = 300
  proxied = true
  comment = "Managed by Terraform - Points to EC2 instance"

  tags = ["terraform", "ec2"]
}

