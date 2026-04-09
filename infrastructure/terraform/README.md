# Infrastructure — Terraform

## Architecture

ECS Fargate behind API Gateway HTTP API. No ALB — API Gateway connects directly to ECS via VPC Link + Cloud Map (private service discovery). Public subnets only, no NAT gateway.

## Resources

- ECS Fargate — single service, single container. Rolling deploys with circuit breaker.
- API Gateway HTTP API — regional custom domain with ACM TLS cert. VPC Link to Cloud Map.
- Cloud Map — private DNS namespace. ECS registers tasks automatically.
- DynamoDB — single table, PAY_PER_REQUEST. ECS task role scoped to GetItem, PutItem, UpdateItem, DeleteItem, Query.
- CodeBuild — build, Docker push to ECR, Terraform apply, ECS stabilise, then Cloudflare apply. Post-deploy system validation.
- `cloudflare/` — DNS layer. See [cloudflare/README.md](cloudflare/README.md).

## Networking

Public subnets only. ECS tasks get public IPs. VPC Link security group restricts ingress to port 3000.

## Rolling deploys

- Old task stays running while new task launches alongside
- Container health check (`/api/health`) must pass before task is healthy
- 60s grace period before ECS evaluates health
- Circuit breaker with rollback enabled

## Bootstrap

ACM certificate requires DNS validation via Cloudflare, but Cloudflare depends on AWS outputs. First deploy requires targeted applies:

1. `terraform apply -target=aws_acm_certificate.main` (AWS layer)
2. `terraform apply -target=cloudflare_dns_record.acm_validation` (Cloudflare layer)
3. Wait for ACM validation
4. Full apply on both layers

After bootstrap, all subsequent deploys run automatically via CodeBuild.

## Pipeline flow

`buildspec.yml` → build → Docker push to ECR → Terraform plan/apply → ECS stabilise → Cloudflare Terraform plan/apply → system validation.
