region = "ap-southeast-4"
name   = "reference-architecture-auth0"

terraform_state_key = "reference-architecture-auth0"
terraform_var_file  = "environments/prod-auth0/terraform.tfvars"

tenant_resolution_mode = "fixed"
app_tenant_id          = "refarch-auth0-demo"
auth_provider          = "oidc"

# Replace these with the Auth0 API values before applying this deployment.
# These values are not secrets, but they are deployment-specific.
oidc_issuer   = "https://603.au.auth0.com/"
oidc_audience = "https://reference-architecture-auth0.603.nz/api"

vpc_id = "vpc-0844e8018ce450134"

build_docker_image = "jch254/docker-node-terraform-aws"
build_docker_tag   = "22.x-docker"
source_location    = "https://github.com/jch254/reference-architecture.git"
cache_bucket       = "jch254-codebuild-cache/reference-architecture-auth0"

cloudflare_domain    = "603.nz"
cloudflare_subdomain = "reference-architecture-auth0"
dns_name             = "reference-architecture-auth0.603.nz"

resend_from_email = "noreply@mail.603.nz"

# Keep automated validation disabled until CodeBuild has a secure way to inject
# AUTH_BEARER_TOKEN. Manual OIDC smoke validation is supported with a supplied
# Auth0 access token.
run_system_validation = false
