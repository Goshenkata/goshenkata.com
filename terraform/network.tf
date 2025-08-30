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
