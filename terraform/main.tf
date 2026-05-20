# ============================================================
# Terraform Main — Provider Configuration
# ============================================================
# WHAT IS A PROVIDER?
# A provider is Terraform's plugin for a cloud platform.
# "aws" tells Terraform we're managing Amazon Web Services
# resources. Other providers exist for Google Cloud, Azure,
# DigitalOcean, etc.
#
# TERRAFORM STATE:
# Terraform keeps track of what it created in a "state file"
# (terraform.tfstate). This lets it know what already exists
# so it can update/delete things intelligently instead of
# creating duplicates.
# ============================================================

terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # State is stored locally for simplicity.
  # In a team, you'd use S3 backend for shared state.
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "naqsh"
      ManagedBy   = "terraform"
      Environment = "production"
    }
  }
}
