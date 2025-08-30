# Cloudflare provider and DNS records

# Cloudflare provider configuration
provider "cloudflare" {
  api_token = local.ssm_parameters["CLOUDFLARE_API_TOKEN"]
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
