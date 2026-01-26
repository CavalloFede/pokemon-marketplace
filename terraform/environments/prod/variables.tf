variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "pokemon-marketplace"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "prod"
}

# Networking
variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.1.0.0/16" # Different CIDR from dev
}

variable "availability_zones" {
  description = "List of availability zones"
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b", "us-east-1c"] # 3 AZs for production
}

variable "enable_nat_gateway" {
  description = "Enable NAT Gateway"
  type        = bool
  default     = true # Enabled for production
}

# Database
variable "db_name" {
  description = "Database name"
  type        = string
  default     = "pokemon_marketplace"
}

variable "db_min_capacity" {
  description = "Minimum ACU capacity"
  type        = number
  default     = 2 # Higher minimum for production
}

variable "db_max_capacity" {
  description = "Maximum ACU capacity"
  type        = number
  default     = 16 # Higher maximum for production
}

# Cache
variable "redis_use_serverless" {
  description = "Use ElastiCache Serverless"
  type        = bool
  default     = true
}

variable "redis_max_storage_gb" {
  description = "Maximum Redis storage in GB"
  type        = number
  default     = 5 # Higher storage for production
}

# Auth
variable "google_client_id" {
  description = "Google OAuth client ID"
  type        = string
  sensitive   = true
}

variable "google_client_secret" {
  description = "Google OAuth client secret"
  type        = string
  sensitive   = true
}

variable "auth_callback_urls" {
  description = "OAuth callback URLs"
  type        = list(string)
  # Should be set via tfvars or environment variable
}

variable "auth_logout_urls" {
  description = "OAuth logout URLs"
  type        = list(string)
  # Should be set via tfvars or environment variable
}

# API
variable "lambda_zip_path" {
  description = "Path to Lambda deployment package"
  type        = string
  default     = "../../../apps/api/dist/lambda.zip"
}

variable "lambda_memory" {
  description = "Lambda memory size in MB"
  type        = number
  default     = 1024 # More memory for production
}

variable "cors_origins" {
  description = "Allowed CORS origins"
  type        = list(string)
  # Should be set via tfvars or environment variable
}

# Frontend
variable "frontend_domain_names" {
  description = "Custom domain names for frontend"
  type        = list(string)
  default     = [] # Should be set for production
}

variable "acm_certificate_arn" {
  description = "ACM certificate ARN for custom domain"
  type        = string
  default     = null # Required if using custom domain
}
