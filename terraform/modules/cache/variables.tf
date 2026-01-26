variable "project_name" {
  description = "Name of the project"
  type        = string
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "subnet_ids" {
  description = "List of subnet IDs for cache"
  type        = list(string)
}

variable "security_group_id" {
  description = "Security group ID for cache"
  type        = string
}

variable "use_serverless" {
  description = "Use ElastiCache Serverless instead of traditional"
  type        = bool
  default     = true
}

variable "node_type" {
  description = "Node type for traditional ElastiCache"
  type        = string
  default     = "cache.t4g.micro"
}

variable "num_cache_clusters" {
  description = "Number of cache clusters for traditional ElastiCache"
  type        = number
  default     = 1
}

variable "max_data_storage_gb" {
  description = "Maximum data storage in GB for serverless"
  type        = number
  default     = 1
}

variable "max_ecpu_per_second" {
  description = "Maximum ECPUs per second for serverless"
  type        = number
  default     = 1000
}
