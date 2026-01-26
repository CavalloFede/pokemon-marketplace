variable "project_name" {
  description = "Name of the project"
  type        = string
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "subnet_ids" {
  description = "List of subnet IDs for database"
  type        = list(string)
}

variable "security_group_id" {
  description = "Security group ID for database"
  type        = string
}

variable "db_name" {
  description = "Name of the database"
  type        = string
  default     = "pokemon_marketplace"
}

variable "db_username" {
  description = "Database master username"
  type        = string
  default     = "postgres"
}

variable "engine_version" {
  description = "PostgreSQL engine version"
  type        = string
  default     = "15.4"
}

variable "min_capacity" {
  description = "Minimum ACU capacity for serverless"
  type        = number
  default     = 0.5
}

variable "max_capacity" {
  description = "Maximum ACU capacity for serverless"
  type        = number
  default     = 4
}

variable "instance_count" {
  description = "Number of database instances"
  type        = number
  default     = 1
}

variable "max_connections_threshold" {
  description = "Threshold for connection alarm"
  type        = number
  default     = 80
}
