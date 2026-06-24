region = "ap-southeast-4"
name   = "reference-architecture-lambda"

terraform_state_key = "reference-architecture-lambda"
terraform_var_file  = "environments/prod-lambda/terraform.tfvars"

# Same runtime profile as the default ECS demo (reference-architecture.603.nz),
# so this is a clean ECS-vs-Lambda comparison: only the compute backend differs.
tenant_resolution_mode = "subdomain"
auth_provider          = "internal_magic_link"

# Lambda sizing for the container-image function. x86_64 must match the image
# built by Dockerfile.lambda (public.ecr.aws/lambda/nodejs:24).
lambda_memory_size  = 512
lambda_timeout      = 30
lambda_architecture = "x86_64"

build_docker_image = "jch254/docker-node-terraform-aws"
build_docker_tag   = "22.x-docker"
source_location    = "https://github.com/jch254/reference-architecture.git"
cache_bucket       = "jch254-codebuild-cache/reference-architecture-lambda"

# Lambda deployments build and deploy via buildspec-lambda.yml (Dockerfile.lambda
# + `aws lambda wait function-updated`), not the ECS buildspec.yml.
buildspec = "buildspec-lambda.yml"

cloudflare_domain    = "603.nz"
cloudflare_subdomain = "reference-architecture-lambda"
dns_name             = "reference-architecture-lambda.603.nz"

resend_from_email = "noreply@mail.603.nz"

# The default magic-link profile sends email, so set a real RESEND_API_KEY in SSM
# (or a non-empty `re_...` value if you will not exercise login). The Resend
# client is constructed lazily on first send, so to run this demo without any
# Resend key, uncomment the line below — the function then boots and serves with
# no key needed (magic-link emails simply are not sent). COOKIE_SECRET is still
# required either way.
# email_mode = "noop"
