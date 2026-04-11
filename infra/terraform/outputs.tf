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
