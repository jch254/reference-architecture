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

moved {
  from = aws_iam_role.ecs_execution_role
  to   = module.app_runtime_iam.aws_iam_role.ecs_execution_role
}

moved {
  from = aws_iam_role_policy_attachment.ecs_execution_role_policy
  to   = module.app_runtime_iam.aws_iam_role_policy_attachment.ecs_execution_role_policy
}

moved {
  from = aws_iam_role_policy.ecs_execution_ssm
  to   = module.app_runtime_iam.aws_iam_role_policy.ecs_execution_ssm
}

moved {
  from = aws_iam_role.ecs_task_role
  to   = module.app_runtime_iam.aws_iam_role.ecs_task_role
}

moved {
  from = aws_iam_role_policy.ecs_task_dynamodb
  to   = module.app_runtime_iam.aws_iam_role_policy.ecs_task_dynamodb
}

moved {
  from = aws_security_group.vpc_link
  to   = module.app_security_groups.aws_security_group.vpc_link
}

moved {
  from = aws_security_group.ecs
  to   = module.app_security_groups.aws_security_group.ecs
}
