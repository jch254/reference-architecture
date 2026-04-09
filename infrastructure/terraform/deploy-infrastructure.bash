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
  echo "Infrastructure changes detected"

  IAM_CHANGE=$(terraform show -json main.tfplan | python3 -c "
import sys, json
plan = json.load(sys.stdin)
for rc in plan.get('resource_changes', []):
    if rc.get('type') in ['aws_iam_role', 'aws_iam_role_policy', 'aws_iam_role_policy_attachment']:
        if any(a in ['create', 'update', 'delete'] for a in rc.get('change', {}).get('actions', [])):
            sys.exit(0)
sys.exit(1)
" 2>/dev/null && echo "true" || echo "false")

  if [ "$IAM_CHANGE" = "true" ]; then
    echo "IAM changes detected — applying IAM resources first"
    terraform apply -auto-approve \
      -target=aws_iam_role.codebuild_role \
      -target=aws_iam_role_policy.codebuild_policy \
      -var-file=environments/prod/terraform.tfvars \
      -var="image_tag=${IMAGE_TAG}"

    echo "Waiting for IAM propagation..."
    for i in {1..10}; do
      if aws sts get-caller-identity > /dev/null 2>&1; then
        echo "IAM propagation confirmed"
        break
      fi
      echo "Retry $i..."
      sleep 3
    done

    TF_EXIT=0
    terraform plan -detailed-exitcode \
      -refresh=false \
      -var-file=environments/prod/terraform.tfvars \
      -var="image_tag=${IMAGE_TAG}" \
      -out main.tfplan || TF_EXIT=$?

    if [ "$TF_EXIT" -eq 0 ]; then
      echo "No remaining infrastructure changes after IAM apply"
    fi
  fi

  if [ "$TF_EXIT" -eq 2 ]; then
    echo "Applying infrastructure changes"
    terraform apply -auto-approve main.tfplan
  fi
else
  echo "Terraform plan failed"
  exit 1
fi
