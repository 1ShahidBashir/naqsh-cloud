# ============================================================
# Terraform Variables
# ============================================================
# WHAT ARE VARIABLES?
# Variables make your Terraform code reusable. Instead of
# hardcoding "t3.medium" everywhere, you use var.instance_type.
# When you run Terraform, you can override these with:
#   terraform apply -var="instance_type=t3.large"
# or by creating a terraform.tfvars file.
# ============================================================

variable "aws_region" {
  description = "AWS region to deploy into (ap-south-1 = Mumbai, closest to India)"
  type        = string
  default     = "ap-south-1"
}

variable "project_name" {
  description = "Name prefix for all AWS resources"
  type        = string
  default     = "naqsh"
}

variable "instance_type" {
  description = "EC2 instance type. t3.medium = 2 vCPU, 4GB RAM — enough for K8s"
  type        = string
  default     = "t3.medium"
}

variable "key_pair_name" {
  description = "Name of your AWS SSH key pair (create one in AWS Console → EC2 → Key Pairs)"
  type        = string
}

variable "dockerhub_username" {
  description = "Docker Hub username for pulling images"
  type        = string
  default     = "1sammy"
}
