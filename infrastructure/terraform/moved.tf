moved {
  from = aws_ecr_repository.main
  to   = module.ecr_repository.aws_ecr_repository.main
}

moved {
  from = aws_dynamodb_table.entities
  to   = module.dynamodb_single_table.aws_dynamodb_table.main
}
