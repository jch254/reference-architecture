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
