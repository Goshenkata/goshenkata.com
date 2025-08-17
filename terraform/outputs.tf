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
  value       = "http://${module.ec2_instance.public_ip}"
}
