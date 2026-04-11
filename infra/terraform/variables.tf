variable "aws_region" {
  description = "Primary AWS region."
  type        = string
  default     = "ap-northeast-2"
}

variable "project_name" {
  description = "Project name used for tagging and naming."
  type        = string
  default     = "k-game"
}

variable "environment" {
  description = "Deployment environment name."
  type        = string
  default     = "prod"
}

variable "frontend_bucket_name" {
  description = "Optional explicit S3 bucket name for the frontend."
  type        = string
  default     = ""
}

variable "custom_domain_name" {
  description = "Optional custom domain name for ACM/Route53 wiring."
  type        = string
  default     = ""
}

variable "vpc_id" {
  description = "Existing VPC ID."
  type        = string
}

variable "public_subnet_ids" {
  description = "Public subnet IDs for the ALB."
  type        = list(string)
}

variable "private_subnet_ids" {
  description = "Private subnet IDs for EC2 and RDS."
  type        = list(string)
}

variable "ec2_ami_id" {
  description = "AMI ID for the API instance."
  type        = string
}

variable "ec2_instance_type" {
  description = "EC2 instance type for the API."
  type        = string
  default     = "t3.small"
}

variable "app_port" {
  description = "Port exposed by the API process."
  type        = number
  default     = 4000
}

variable "db_name" {
  description = "RDS database name."
  type        = string
  default     = "k_game"
}

variable "db_username" {
  description = "RDS master username."
  type        = string
  default     = "k_game_admin"
}

variable "db_password" {
  description = "RDS master password."
  type        = string
  sensitive   = true
}

variable "db_instance_class" {
  description = "RDS instance class."
  type        = string
  default     = "db.t3.small"
}

variable "db_allocated_storage" {
  description = "RDS storage size in GiB."
  type        = number
  default     = 20
}

variable "log_retention_days" {
  description = "CloudWatch log retention."
  type        = number
  default     = 30
}
