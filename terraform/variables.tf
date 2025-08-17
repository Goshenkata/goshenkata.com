variable "project_name" {
  description = "Name of the project used for resource naming"
  type        = string
  default     = "goshenkata"
}

variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "eu-central-1"
}

variable "instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t2.micro"
}

variable "http_port" {
  description = "HTTP port for web traffic"
  type        = number
  default     = 80
}

variable "app_port" {
  description = "Port where Node.js app runs internally"
  type        = number
  default     = 3000
}

variable "github_repo_url" {
  description = "GitHub repository URL to clone"
  type        = string
  default     = "https://github.com/Goshenkata/goshenkata.com.git"
}

variable "app_directory" {
  description = "Directory within the repo where the app is located"
  type        = string
  default     = "frontend"
}

variable "deployment_id" {
  description = "Deployment identifier (usually git commit hash)"
  type        = string
  default     = "local-deploy"
}

variable "domain_name" {
  description = "Domain name for SSL certificate (leave null to disable HTTPS)"
  type        = string
  default     = "goshenkata.com"
}

variable "email" {
  description = "Email address for Let's Encrypt notifications"
  type        = string
  default     = "goshenkataklev@gmail.com"
}
