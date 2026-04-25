moved {
  from = aws_ecr_repository.main
  to   = module.ecr_repository.aws_ecr_repository.main
}

moved {
  from = aws_dynamodb_table.entities
  to   = module.dynamodb_single_table.aws_dynamodb_table.main
}

moved {
  from = aws_codebuild_project.main
  to   = module.codebuild_project.aws_codebuild_project.codebuild_project
}

moved {
  from = aws_codebuild_webhook.main
  to   = module.codebuild_project.aws_codebuild_webhook.codebuild_webhook[0]
}

moved {
  from = aws_cloudwatch_log_group.main
  to   = module.app_log_group.aws_cloudwatch_log_group.main
}
