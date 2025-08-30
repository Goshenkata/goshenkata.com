# CodeDeploy resources

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
