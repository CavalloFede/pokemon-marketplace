terraform {
  required_version = ">= 1.5.0"

  # Backend configuration - uncomment and configure for remote state
  # backend "s3" {
  #   bucket         = "pokemon-marketplace-terraform-state"
  #   key            = "dev/terraform.tfstate"
  #   region         = "us-east-1"
  #   encrypt        = true
  #   dynamodb_table = "terraform-state-lock"
  # }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

locals {
  project_name = var.project_name
  environment  = var.environment
}

# Networking
module "networking" {
  source = "../../modules/networking"

  project_name       = local.project_name
  environment        = local.environment
  vpc_cidr           = var.vpc_cidr
  availability_zones = var.availability_zones
  enable_nat_gateway = var.enable_nat_gateway
}

# Database
module "database" {
  source = "../../modules/database"

  project_name      = local.project_name
  environment       = local.environment
  subnet_ids        = module.networking.private_subnet_ids
  security_group_id = module.networking.rds_security_group_id
  db_name           = var.db_name
  min_capacity      = var.db_min_capacity
  max_capacity      = var.db_max_capacity
}

# Cache
module "cache" {
  source = "../../modules/cache"

  project_name        = local.project_name
  environment         = local.environment
  subnet_ids          = module.networking.private_subnet_ids
  security_group_id   = module.networking.redis_security_group_id
  use_serverless      = var.redis_use_serverless
  max_data_storage_gb = var.redis_max_storage_gb
}

# Auth
module "auth" {
  source = "../../modules/auth"

  project_name         = local.project_name
  environment          = local.environment
  google_client_id     = var.google_client_id
  google_client_secret = var.google_client_secret
  callback_urls        = var.auth_callback_urls
  logout_urls          = var.auth_logout_urls
}

# API (requires Lambda zip to exist)
module "api" {
  source = "../../modules/api"

  project_name          = local.project_name
  environment           = local.environment
  subnet_ids            = module.networking.private_subnet_ids
  security_group_id     = module.networking.lambda_security_group_id
  lambda_zip_path       = var.lambda_zip_path
  lambda_memory         = var.lambda_memory
  db_secret_arn         = module.database.secret_arn
  db_host               = module.database.cluster_endpoint
  db_name               = var.db_name
  db_username           = "postgres"
  db_password           = "" # Retrieved from secrets manager at runtime
  redis_url             = module.cache.connection_string
  cognito_user_pool_id  = module.auth.user_pool_id
  cognito_user_pool_arn = module.auth.user_pool_arn
  cognito_client_id     = module.auth.client_id
  cors_origins          = var.cors_origins

  depends_on = [module.database, module.cache, module.auth]
}

# Frontend
module "frontend" {
  source = "../../modules/frontend"

  project_name        = local.project_name
  environment         = local.environment
  domain_names        = var.frontend_domain_names
  acm_certificate_arn = var.acm_certificate_arn
  api_endpoint        = module.api.api_endpoint

  depends_on = [module.api]
}
