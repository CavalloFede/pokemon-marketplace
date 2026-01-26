output "endpoint" {
  description = "Redis endpoint"
  value       = var.use_serverless ? aws_elasticache_serverless_cache.main[0].endpoint[0].address : aws_elasticache_replication_group.main[0].primary_endpoint_address
}

output "port" {
  description = "Redis port"
  value       = var.use_serverless ? aws_elasticache_serverless_cache.main[0].endpoint[0].port : 6379
}

output "connection_string" {
  description = "Redis connection string"
  value       = var.use_serverless ? "rediss://${aws_elasticache_serverless_cache.main[0].endpoint[0].address}:${aws_elasticache_serverless_cache.main[0].endpoint[0].port}" : "redis://${aws_elasticache_replication_group.main[0].primary_endpoint_address}:6379"
}
