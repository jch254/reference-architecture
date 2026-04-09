# Infrastructure

## Components

- **ECS Fargate** — single service, single container. Health-checked rolling deploys via deployment circuit breaker.
- **API Gateway HTTP API** — regional custom domain with ACM TLS cert. VPC Link to Cloud Map for private service discovery.
- **Cloud Map** — private DNS namespace. ECS registers tasks automatically. API Gateway routes to healthy instances via SRV records.
- **Cloudflare** — DNS + edge proxy. CNAME points at API Gateway custom domain target. Also hosts the ACM certificate validation record.
- **CodeBuild** — builds Docker image, pushes to ECR, runs Terraform apply, waits for ECS stabilisation, then applies Cloudflare DNS.

## Networking

Public subnets only. No NAT gateway, no private subnets. ECS tasks get public IPs. VPC Link security group restricts ingress to port 3000 from the API Gateway SG.

## Rolling deploys

- `deployment_minimum_healthy_percent = 100` — old task stays running
- `deployment_maximum_percent = 200` — new task launches alongside
- Container health check (`/api/health`) must pass before task is considered healthy
- `health_check_grace_period_seconds = 60` — ECS waits before evaluating health
- Circuit breaker with rollback enabled

## Bootstrap dependency

ACM certificate requires DNS validation via Cloudflare, but the Cloudflare Terraform step depends on AWS outputs. First deploy requires targeted applies — see [README.md](../README.md#first-time-bootstrap).
