# ============================================================
# Terraform Outputs
# ============================================================
# WHAT ARE OUTPUTS?
# After Terraform creates your infrastructure, outputs show
# you important information like IP addresses and connection
# commands. Run "terraform output" anytime to see them again.
# ============================================================

output "master_public_ip" {
  description = "Public IP of the Kubernetes master node (use this for kubectl & SSH)"
  value       = aws_eip.master.public_ip
}

output "master_private_ip" {
  description = "Private IP of master (used by worker to join the cluster)"
  value       = aws_instance.master.private_ip
}

output "worker_public_ip" {
  description = "Public IP of the Kubernetes worker node"
  value       = aws_instance.worker.public_ip
}

output "ssh_to_master" {
  description = "Command to SSH into the master node"
  value       = "ssh -i ~/.ssh/${var.key_pair_name}.pem ubuntu@${aws_eip.master.public_ip}"
}

output "ssh_to_worker" {
  description = "Command to SSH into the worker node"
  value       = "ssh -i ~/.ssh/${var.key_pair_name}.pem ubuntu@${aws_instance.worker.public_ip}"
}

output "app_url" {
  description = "Access the app at this URL (after K8s setup)"
  value       = "http://${aws_eip.master.public_ip}"
}
