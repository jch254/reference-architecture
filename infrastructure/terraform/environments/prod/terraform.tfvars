region = "ap-southeast-4"
name   = "reference-architecture"

vpc_id = "vpc-0844e8018ce450134"

build_docker_image = "jch254/docker-node-terraform-aws"
build_docker_tag   = "22.x-docker"
source_location    = "https://github.com/jch254/reference-architecture.git"
cache_bucket       = "jch254-codebuild-cache/reference-architecture"

cloudflare_domain    = "603.nz"
cloudflare_subdomain = "reference-architecture"
dns_name             = "reference-architecture.603.nz"
