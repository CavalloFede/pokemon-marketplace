# Pokemon Marketplace - Terraform Infrastructure

This directory contains the Terraform configuration for deploying the Pokemon Marketplace to AWS.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              CloudFront                                  │
│                         (CDN + HTTPS + Caching)                         │
└──────────────┬────────────────────────────────────┬─────────────────────┘
               │                                    │
               ▼                                    ▼
┌──────────────────────────┐          ┌──────────────────────────────────┐
│        S3 Bucket         │          │         API Gateway              │
│    (Frontend Assets)     │          │     (HTTP API + Rate Limiting)   │
└──────────────────────────┘          └──────────────┬───────────────────┘
                                                     │
                                                     ▼
                                      ┌──────────────────────────────────┐
                                      │            Lambda                 │
                                      │    (Fastify API - Node.js 20)    │
                                      └──────────┬───────────┬───────────┘
                                                 │           │
                           ┌─────────────────────┘           └──────────────────┐
                           │                                                    │
                           ▼                                                    ▼
              ┌────────────────────────┐                      ┌─────────────────────────┐
              │   Aurora PostgreSQL    │                      │    ElastiCache Redis    │
              │   (Serverless v2)      │                      │      (Serverless)       │
              └────────────────────────┘                      └─────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                          Cognito User Pool                              │
│                       (Authentication + Google OAuth)                   │
└─────────────────────────────────────────────────────────────────────────┘
```

## Prerequisites

1. **AWS CLI** configured with appropriate credentials
2. **Terraform** >= 1.5.0
3. **Google OAuth credentials** (for authentication)
4. **Lambda deployment package** (built from the API)

## Quick Start

### 1. Set up Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a new OAuth 2.0 Client ID
3. Add authorized redirect URIs:
   - `http://localhost:5173/auth/callback` (development)
   - Your CloudFront URL (after deployment)

### 2. Configure Variables

```bash
cd terraform/environments/dev
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your values
```

### 3. Build Lambda Package

```bash
cd apps/api
pnpm build
pnpm package  # Creates dist/lambda.zip
```

### 4. Deploy

```bash
cd terraform/environments/dev

# Initialize
terraform init

# Preview changes
terraform plan

# Apply
terraform apply
```

### 5. Post-Deployment

1. Update Cognito callback URLs with CloudFront domain
2. Update Google OAuth redirect URIs
3. Run database migrations
4. Deploy frontend assets to S3

## Modules

| Module | Description |
|--------|-------------|
| `networking` | VPC, subnets, security groups, NAT gateway |
| `database` | Aurora PostgreSQL Serverless v2 |
| `cache` | ElastiCache Redis Serverless |
| `auth` | Cognito User Pool with Google OAuth |
| `api` | Lambda function with API Gateway |
| `frontend` | S3 bucket with CloudFront distribution |

## Environments

- **dev**: Development environment (minimal resources, no NAT gateway)
- **prod**: Production environment (higher capacity, multi-AZ, backups)

## Cost Estimation (Dev Environment)

| Service | Estimated Monthly Cost |
|---------|----------------------|
| Aurora Serverless v2 (0.5-2 ACU) | ~$15-50 |
| ElastiCache Serverless | ~$5-20 |
| Lambda (light usage) | ~$0-5 |
| CloudFront | ~$0-5 |
| S3 | ~$0-1 |
| Cognito | Free (first 50K MAU) |
| **Total** | **~$20-80/month** |

*Note: Enabling NAT Gateway adds ~$32/month*

## Common Commands

```bash
# Format code
terraform fmt -recursive

# Validate configuration
terraform validate

# Show current state
terraform show

# Destroy all resources
terraform destroy

# Import existing resource
terraform import module.frontend.aws_s3_bucket.frontend bucket-name

# Target specific module
terraform apply -target=module.api
```

## Troubleshooting

### Lambda can't access RDS/Redis
- Ensure NAT Gateway is enabled for internet access from VPC
- Check security group rules allow traffic

### CloudFront returns 403
- Verify S3 bucket policy allows CloudFront OAC
- Check if index.html exists in bucket

### Cognito OAuth fails
- Verify callback URLs match exactly
- Check Google OAuth credentials are correct

## Security Notes

- Database credentials are stored in AWS Secrets Manager
- All traffic is encrypted in transit (TLS)
- S3 bucket is private (CloudFront only)
- Lambda runs in private subnets
- Cognito handles authentication securely
