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

# Fetch all parameters with /goshenkata/ prefix
data "aws_ssm_parameters_by_path" "app_config" {
  path      = "/goshenkata"
  recursive = true
}

# Create a map of parameter names to values for easy access
locals {
  # Extract parameter names and values, uppercased keys
  ssm_parameters = {
    for param in data.aws_ssm_parameters_by_path.app_config.names :
    upper(replace(replace(param, "/goshenkata/", ""), "/", "_")) => data.aws_ssm_parameters_by_path.app_config.values[index(data.aws_ssm_parameters_by_path.app_config.names, param)]
  }
  
  # Generate just the SSM export statements (no duplicates)
  ssm_exports = join("\n", [
    for key, value in local.ssm_parameters :
    "export ${upper(key)}='${value}'"
  ])
  
  user_data = templatefile("${path.module}/user-data.sh", {
    app_port              = var.app_port
    domain_name           = var.domain_name
    cloudflare_ipv4_ranges = join("\n", local.cloudflare_ipv4_ranges)
    cloudflare_ipv6_ranges = join("\n", local.cloudflare_ipv6_ranges)
    ssm_exports           = local.ssm_exports
  })
}

# IAM role for EC2 to work with CodeDeploy
resource "aws_iam_role" "ec2_codedeploy" {
  name = "${var.project_name}-ec2-codedeploy-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Project = var.project_name
  }
}

# Attach CodeDeploy policy to EC2 role
resource "aws_iam_role_policy_attachment" "ec2_codedeploy" {
  role       = aws_iam_role.ec2_codedeploy.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonEC2RoleforAWSCodeDeploy"
}

# Attach SSM policy to EC2 role for parameter access
resource "aws_iam_role_policy_attachment" "ec2_ssm" {
  role       = aws_iam_role.ec2_codedeploy.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

# Custom policy for reading goshenkata parameters
resource "aws_iam_role_policy" "ec2_ssm_parameters" {
  name = "${var.project_name}-ssm-parameters"
  role = aws_iam_role.ec2_codedeploy.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ssm:GetParameter",
          "ssm:GetParameters",
          "ssm:GetParametersByPath"
        ]
        Resource = "arn:aws:ssm:${var.aws_region}:*:parameter/goshenkata/*"
      },
      {
        Effect = "Allow"
        Action = [
          "kms:Decrypt"
        ]
        Resource = "arn:aws:kms:${var.aws_region}:*:key/alias/aws/ssm"
      }
    ]
  })
}

# Instance profile for EC2
resource "aws_iam_instance_profile" "ec2_codedeploy" {
  name = "${var.project_name}-ec2-codedeploy-profile"
  role = aws_iam_role.ec2_codedeploy.name

  tags = {
    Project = var.project_name
  }
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
  iam_instance_profile        = aws_iam_instance_profile.ec2_codedeploy.name

  user_data_base64            = base64encode(local.user_data)

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

# Create A record for the root domain
resource "cloudflare_dns_record" "root" {
  zone_id = local.ssm_parameters["CLOUDFLARE_ZONE_ID"]
  name    = "@"
  content = module.ec2_instance.public_ip
  type    = "A"
  ttl     = 1
  proxied = true
  comment = "Managed by Terraform - Points to EC2 instance"
}

# CodeDeploy application and deployment group
module "codedeploy" {
  source = "cloudposse/code-deploy/aws"
  version = "0.2.3"

  # Required inputs
  enabled                    = true
  name                      = var.project_name
  namespace                 = "gk"
  environment               = "prod"
  stage                     = "prod"
  
  # Deployment configuration
  compute_platform = "Server"
  
  deployment_style = {
    deployment_option = "WITHOUT_TRAFFIC_CONTROL"
    deployment_type   = "IN_PLACE"
  }
  
  minimum_healthy_hosts = {
    type  = "HOST_COUNT"
    value = 0
  }
  
  # EC2 tag filters
  ec2_tag_filter = [
    {
      key   = "Project"
      type  = "KEY_AND_VALUE"
      value = var.project_name
    }
  ]
  
  tags = {
    Project = var.project_name
  }
}