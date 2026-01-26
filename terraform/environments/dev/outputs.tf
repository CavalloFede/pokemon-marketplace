# Networking
output "vpc_id" {
  description = "VPC ID"
  value       = module.networking.vpc_id
}

# Database
output "database_endpoint" {
  description = "Database endpoint"
  value       = module.database.cluster_endpoint
}

output "database_secret_arn" {
  description = "Database credentials secret ARN"
  value       = module.database.secret_arn
}

# Cache
output "redis_endpoint" {
  description = "Redis endpoint"
  value       = module.cache.endpoint
}

# Auth
output "cognito_user_pool_id" {
  description = "Cognito User Pool ID"
  value       = module.auth.user_pool_id
}

output "cognito_client_id" {
  description = "Cognito Client ID"
  value       = module.auth.client_id
}

output "cognito_hosted_ui_url" {
  description = "Cognito hosted UI URL"
  value       = module.auth.hosted_ui_url
}

# API
output "api_endpoint" {
  description = "API endpoint URL"
  value       = module.api.api_endpoint
}

output "lambda_function_name" {
  description = "Lambda function name"
  value       = module.api.lambda_function_name
}

# Frontend
output "frontend_bucket_name" {
  description = "Frontend S3 bucket name"
  value       = module.frontend.bucket_name
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID"
  value       = module.frontend.cloudfront_distribution_id
}

output "website_url" {
  description = "Website URL"
  value       = module.frontend.website_url
}

# Summary for easy reference
output "summary" {
  description = "Deployment summary"
  value = {
    environment = var.environment
    website_url = module.frontend.website_url
    api_url     = module.api.api_endpoint
    cognito_url = module.auth.hosted_ui_url
  }
}
