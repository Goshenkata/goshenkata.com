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
      name    = cloudflare_record.root.name
      content = cloudflare_record.root.content
      proxied = cloudflare_record.root.proxied
    }
    www_domain = {
      name    = cloudflare_record.www.name
      content = cloudflare_record.www.content
      proxied = cloudflare_record.www.proxied
    }
  }
}
