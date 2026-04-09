#!/bin/bash -ex

echo Deploying Cloudflare DNS via Terraform...

cd infrastructure/terraform/cloudflare
terraform init \
  -reconfigure \
  -backend-config "bucket=${REMOTE_STATE_BUCKET}" \
  -backend-config "key=${TF_STATE_KEY:-reference-architecture}-cloudflare" \
  -backend-config "region=${AWS_DEFAULT_REGION}" \
  -get=true

terraform plan -detailed-exitcode \
  -var="cloudflare_api_token=${CLOUDFLARE_API_TOKEN}" \
  -var="domain=${CLOUDFLARE_DOMAIN}" \
  -var="subdomain=${CLOUDFLARE_SUBDOMAIN}" \
  -var="aws_region=${AWS_DEFAULT_REGION}" \
  -var="aws_state_bucket=${REMOTE_STATE_BUCKET}" \
  -var="aws_state_key=${TF_STATE_KEY:-reference-architecture}" \
  -out main.tfplan || TF_EXIT=$?

TF_EXIT=${TF_EXIT:-0}

if [ "$TF_EXIT" -eq 0 ]; then
  echo "No Cloudflare changes — skipping apply"
elif [ "$TF_EXIT" -eq 2 ]; then
  echo "Cloudflare changes detected — applying"
  terraform apply -auto-approve main.tfplan
else
  echo "Cloudflare Terraform plan failed"
  exit 1
fi
