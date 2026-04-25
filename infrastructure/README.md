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

## Module relationship

Reusable infrastructure primitives are owned by `jch254/terraform-modules`. This repository composes those modules into a runnable public scaffold and keeps app-specific choices local: names, domains, environment variables, secrets, notification wiring, image tags, and deployment flow.

AWS and Cloudflare intentionally remain separate Terraform roots. The AWS root produces API Gateway and ACM outputs; the Cloudflare root consumes those outputs through remote state and manages only the DNS records for this scaffold.

The Terraform `moved.tf` files are intentionally retained. They document the state-safe migration history and let Terraform preserve deployed resource identity when planning against existing state.

Namaste, Lush, and future KHA can adopt the same modules later when useful, but this scaffold is a reference rather than an automatic migration mandate. SES, mail provider records, Cloudflare security rules, build notifications, and other product-specific infrastructure stay outside this reusable-core migration.

See each layer's README for specifics.
