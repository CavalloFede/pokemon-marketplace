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
  default     = "dev"
}

# Networking
variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "List of availability zones"
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b"]
}

variable "enable_nat_gateway" {
  description = "Enable NAT Gateway (costs money)"
  type        = bool
  default     = false # Disabled for dev to save costs
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
  default     = 0.5
}

variable "db_max_capacity" {
  description = "Maximum ACU capacity"
  type        = number
  default     = 2
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
  default     = 1
}

# Auth
variable "google_client_id" {
  description = "Google OAuth client ID"
  type        = string
  default     = ""
  sensitive   = true
}

variable "google_client_secret" {
  description = "Google OAuth client secret"
  type        = string
  default     = ""
  sensitive   = true
}

variable "auth_callback_urls" {
  description = "OAuth callback URLs"
  type        = list(string)
  default     = ["http://localhost:5173/auth/callback"]
}

variable "auth_logout_urls" {
  description = "OAuth logout URLs"
  type        = list(string)
  default     = ["http://localhost:5173/login"]
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
  default     = 512
}

variable "cors_origins" {
  description = "Allowed CORS origins"
  type        = list(string)
  default     = ["http://localhost:5173", "http://localhost:3000"]
}

# Frontend
variable "frontend_domain_names" {
  description = "Custom domain names for frontend"
  type        = list(string)
  default     = []
}

variable "acm_certificate_arn" {
  description = "ACM certificate ARN"
  type        = string
  default     = null
}
