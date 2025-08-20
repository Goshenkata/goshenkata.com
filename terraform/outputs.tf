output "app_url" {
  description = "URL to access the Node.js application"
  value       = "https://${var.domain_name}"
}

output "codedeploy_application" {
  description = "CodeDeploy application details"
  value = {
    application_name      = module.codedeploy.name
    deployment_group_name = module.codedeploy.name  # The deployment group name is the same as the application name in this module
  }
}