# Infrastructure

Two deployment layers, applied sequentially via CodeBuild.

## Structure

```
/infrastructure/terraform             → AWS (ECS, API Gateway, DynamoDB, ECR)
/infrastructure/terraform/cloudflare  → DNS (Cloudflare CNAME → API Gateway)
```

## Flow

CodeBuild builds and pushes the Docker image, then applies the AWS Terraform layer. Once ECS stabilises, it applies the Cloudflare layer.

## Layer relationship

- AWS layer provisions compute, networking, and the API Gateway custom domain
- Cloudflare layer reads AWS outputs (via remote state) and creates DNS records pointing to API Gateway
- Cloudflare handles TLS termination and edge proxying

See each layer's README for specifics.
