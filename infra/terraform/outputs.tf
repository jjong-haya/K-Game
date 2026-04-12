output "frontend_bucket_name" {
  value = aws_s3_bucket.frontend.bucket
}

output "cloudfront_distribution_domain_name" {
  value = aws_cloudfront_distribution.frontend.domain_name
}

output "alb_dns_name" {
  value = aws_lb.app.dns_name
}

output "db_endpoint" {
  value = aws_db_instance.main.address
}

output "daily_word_lambda_name" {
  value = var.enable_daily_word_lambda ? aws_lambda_function.daily_word_generate[0].function_name : null
}
