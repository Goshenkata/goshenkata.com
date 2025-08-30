# SSM parameter logic

# Fetch all parameters with /goshenkata/ prefix
data "aws_ssm_parameters_by_path" "app_config" {
  path      = "/goshenkata"
  recursive = true
}

# Create a map of parameter names to values for easy access
locals {
  # Extract parameter names and values, uppercased keys
  ssm_parameters = {
    for param in data.aws_ssm_parameters_by_path.app_config.names :
    upper(trim(replace(param, "/goshenkata/", ""), "/")) => data.aws_ssm_parameters_by_path.app_config.values[index(data.aws_ssm_parameters_by_path.app_config.names, param)]
  }
  # Generate just the SSM export statements (no duplicates)
  ssm_exports = join("\n", [
    for key, value in local.ssm_parameters :
    "${upper(key)}=${value}"
  ])
}

locals {
  user_data = templatefile("${path.module}/user-data.sh", {
    app_port              = var.app_port
    domain_name           = var.domain_name
    cloudflare_ipv4_ranges = join("\n", local.cloudflare_ipv4_ranges)
    cloudflare_ipv6_ranges = join("\n", local.cloudflare_ipv6_ranges)
    ssm_exports           = local.ssm_exports
  })
}
