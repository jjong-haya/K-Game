locals {
  name_prefix = "${var.project_name}-${var.environment}"
  frontend_bucket = var.frontend_bucket_name != "" ? var.frontend_bucket_name : "${local.name_prefix}-frontend"
}

data "aws_caller_identity" "current" {}

data "aws_cloudfront_cache_policy" "caching_optimized" {
  name = "Managed-CachingOptimized"
}
