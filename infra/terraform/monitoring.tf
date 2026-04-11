resource "aws_cloudwatch_log_group" "api" {
  name              = "/${local.name_prefix}/api"
  retention_in_days = var.log_retention_days
}

resource "aws_cloudwatch_metric_alarm" "api_high_cpu" {
  alarm_name          = "${local.name_prefix}-api-high-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  dimensions = {
    InstanceId = aws_instance.app.id
  }
}
