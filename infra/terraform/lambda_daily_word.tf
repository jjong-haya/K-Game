resource "aws_security_group" "daily_word_lambda" {
  count       = var.enable_daily_word_lambda ? 1 : 0
  name_prefix = "${local.name_prefix}-daily-word-lambda-"
  description = "Security group for the daily-word-generate Lambda"
  vpc_id      = var.vpc_id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group_rule" "db_from_daily_word_lambda" {
  count                    = var.enable_daily_word_lambda ? 1 : 0
  type                     = "ingress"
  from_port                = 3306
  to_port                  = 3306
  protocol                 = "tcp"
  security_group_id        = aws_security_group.db.id
  source_security_group_id = aws_security_group.daily_word_lambda[0].id
  description              = "Allow daily-word-generate Lambda to reach RDS"
}

resource "aws_iam_role" "daily_word_lambda" {
  count = var.enable_daily_word_lambda ? 1 : 0
  name  = "${local.name_prefix}-daily-word-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "daily_word_lambda_basic" {
  count      = var.enable_daily_word_lambda ? 1 : 0
  role       = aws_iam_role.daily_word_lambda[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy_attachment" "daily_word_lambda_vpc" {
  count      = var.enable_daily_word_lambda ? 1 : 0
  role       = aws_iam_role.daily_word_lambda[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

resource "aws_iam_role_policy" "daily_word_lambda_bedrock" {
  count = var.enable_daily_word_lambda ? 1 : 0
  name  = "${local.name_prefix}-daily-word-bedrock"
  role  = aws_iam_role.daily_word_lambda[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream"
        ]
        Resource = "*"
      }
    ]
  })
}

resource "aws_cloudwatch_log_group" "daily_word_lambda" {
  count             = var.enable_daily_word_lambda ? 1 : 0
  name              = "/aws/lambda/${local.daily_word_lambda_name}"
  retention_in_days = var.log_retention_days
}

resource "aws_lambda_function" "daily_word_generate" {
  count         = var.enable_daily_word_lambda ? 1 : 0
  function_name = local.daily_word_lambda_name
  role          = aws_iam_role.daily_word_lambda[0].arn
  handler       = "src/index.handler"
  runtime       = "nodejs20.x"
  timeout       = var.daily_word_lambda_timeout
  memory_size   = var.daily_word_lambda_memory_size
  s3_bucket     = var.daily_word_lambda_s3_bucket
  s3_key        = var.daily_word_lambda_s3_key

  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = [aws_security_group.daily_word_lambda[0].id]
  }

  environment {
    variables = {
      AWS_REGION         = var.aws_region
      APP_TIMEZONE       = "Asia/Seoul"
      BEDROCK_MODEL_ID   = var.daily_word_bedrock_model_id
      DB_HOST            = aws_db_instance.main.address
      DB_PORT            = "3306"
      DB_USER            = var.db_username
      DB_PASSWORD        = var.db_password
      DB_NAME            = var.db_name
      DB_CONNECTION_LIMIT = "2"
    }
  }

  depends_on = [
    aws_iam_role_policy_attachment.daily_word_lambda_basic,
    aws_iam_role_policy_attachment.daily_word_lambda_vpc,
    aws_iam_role_policy.daily_word_lambda_bedrock,
    aws_cloudwatch_log_group.daily_word_lambda,
  ]
}

resource "aws_cloudwatch_event_rule" "daily_word_generate" {
  count               = var.enable_daily_word_lambda && var.enable_daily_word_schedule ? 1 : 0
  name                = "${local.name_prefix}-daily-word-generate"
  description         = "Generate the daily word challenge on a schedule"
  schedule_expression = var.daily_word_schedule_expression
}

resource "aws_cloudwatch_event_target" "daily_word_generate" {
  count     = var.enable_daily_word_lambda && var.enable_daily_word_schedule ? 1 : 0
  rule      = aws_cloudwatch_event_rule.daily_word_generate[0].name
  target_id = "daily-word-generate"
  arn       = aws_lambda_function.daily_word_generate[0].arn

  input = jsonencode({
    operation = "daily_word_generate"
  })
}

resource "aws_lambda_permission" "daily_word_generate_events" {
  count         = var.enable_daily_word_lambda && var.enable_daily_word_schedule ? 1 : 0
  statement_id  = "AllowExecutionFromEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.daily_word_generate[0].function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.daily_word_generate[0].arn
}
