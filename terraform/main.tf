terraform {
  backend "s3" {
    bucket = "goshenkata-terraform-state"
    key    = "goshenkata/terraform.tfstate"
    region = "eu-central-1"
  }
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "6.5.0"
    }
  }
}

provider "aws" {
  region = "eu-central-1"
}

module "frontend_bucket" {
  source  = "terraform-aws-modules/s3-bucket/aws"
  version = "5.2.0"

  bucket = "${var.project_name}-frontend"

  website = {
    index_document = "index.html"
    error_document = "index.html"
  }

  attach_policy = true
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Sid       = "PublicReadGetObject",
        Effect    = "Allow",
        Principal = "*",
        Action    = "s3:GetObject",
        Resource  = "arn:aws:s3:::${module.frontend_bucket.s3_bucket_id}/*"

      }
    ]
  })
  block_public_acls       = true
  ignore_public_acls      = false
  block_public_policy     = false
  restrict_public_buckets = false

}
