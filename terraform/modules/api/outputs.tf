output "lambda_function_name" {
  description = "Lambda function name"
  value       = aws_lambda_function.api.function_name
}

output "lambda_function_arn" {
  description = "Lambda function ARN"
  value       = aws_lambda_function.api.arn
}

output "api_endpoint" {
  description = "API endpoint URL"
  value       = var.use_function_url ? aws_lambda_function_url.api[0].function_url : aws_apigatewayv2_api.main[0].api_endpoint
}

output "api_gateway_id" {
  description = "API Gateway ID"
  value       = var.use_function_url ? null : aws_apigatewayv2_api.main[0].id
}
