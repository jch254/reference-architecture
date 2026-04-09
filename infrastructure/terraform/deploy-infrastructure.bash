#!/bin/bash -ex

echo Deploying infrastructure via Terraform...

cd infrastructure/terraform
terraform init \
  -reconfigure \
  -backend-config "bucket=${REMOTE_STATE_BUCKET}" \
  -backend-config "key=${TF_STATE_KEY:-reference-architecture}" \
  -backend-config "region=${AWS_DEFAULT_REGION}" \
  -get=true

terraform plan -detailed-exitcode \
  -refresh=false \
  -var-file=environments/prod/terraform.tfvars \
  -var="image_tag=${IMAGE_TAG}" \
  -out main.tfplan || TF_EXIT=$?

TF_EXIT=${TF_EXIT:-0}

if [ "$TF_EXIT" -eq 0 ]; then
  echo "No infrastructure changes — skipping apply"
elif [ "$TF_EXIT" -eq 2 ]; then
  echo "Infrastructure changes detected — applying"
  terraform apply -auto-approve main.tfplan
else
  echo "Terraform plan failed"
  exit 1
fi
