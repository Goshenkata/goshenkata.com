output "app_url" {
  description = "URL to access the Node.js application"
  value       = "https://${var.domain_name}"
}

output "codedeploy_application_name" {
  description = "CodeDeploy application name"
  value       = module.codedeploy.name
}

output "codedeploy_deployment_group_name" {
  description = "CodeDeploy deployment group name"
  value       = module.codedeploy.name
}