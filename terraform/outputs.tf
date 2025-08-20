output "instance_public_ip" {
  description = "Public IP address of the EC2 instance"
  value       = module.ec2_instance.public_ip
}

output "instance_public_dns" {
  description = "Public DNS name of the EC2 instance"
  value       = module.ec2_instance.public_dns
}

output "app_url" {
  description = "URL to access the Node.js application"
  value       = "https://${var.domain_name}"
}

output "cloudflare_records" {
  description = "Cloudflare DNS records created"
  value = {
    root_domain = {
      name    = cloudflare_dns_record.root.name
      content = cloudflare_dns_record.root.content
      proxied = cloudflare_dns_record.root.proxied
    }
  }
}

output "codedeploy_application" {
  description = "CodeDeploy application details"
  value = {
    application_id        = module.codedeploy.id
    application_name      = module.codedeploy.name
    deployment_group_id   = module.codedeploy.group_id
    deployment_config_name = module.codedeploy.deployment_config_name
    deployment_config_id  = module.codedeploy.deployment_config_id
  }
}