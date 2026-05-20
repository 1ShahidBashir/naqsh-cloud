# ============================================================
# EC2 Instances — The Actual Servers
# ============================================================
# WHAT IS EC2?
# EC2 (Elastic Compute Cloud) = virtual servers on AWS.
# We create 2 instances:
#
#   1. MASTER NODE: Runs the Kubernetes "control plane"
#      (the brain that manages the cluster — schedules pods,
#      monitors health, handles kubectl commands)
#
#   2. WORKER NODE: Runs your actual application pods
#      (backend, frontend, Redis, monitoring)
#
# WHAT IS USER DATA?
# A bash script that runs automatically when the server
# first boots up. We use it to install Docker and Kubernetes
# tools so the servers are ready to go without manual SSH.
# ============================================================

# ---------- Find the latest Ubuntu 22.04 AMI ----------
# An AMI (Amazon Machine Image) is the "template" for your
# server's operating system. This finds the latest official
# Ubuntu 22.04 image automatically.
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical (Ubuntu's publisher)

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# ---------- Bootstrap Script ----------
# This script runs on BOTH master and worker when they boot.
# It installs: Docker, kubeadm, kubelet, kubectl
locals {
  k8s_bootstrap = <<-USERDATA
    #!/bin/bash
    set -euxo pipefail

    # ---- System Prep ----
    apt-get update -y
    apt-get install -y apt-transport-https ca-certificates curl gnupg lsb-release

    # ---- Install Docker ----
    # Docker runs your containers. Kubernetes tells Docker
    # WHICH containers to run and WHERE.
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
    echo "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" > /etc/apt/sources.list.d/docker.list
    apt-get update -y
    apt-get install -y docker-ce docker-ce-cli containerd.io

    # Configure containerd for Kubernetes
    mkdir -p /etc/containerd
    containerd config default > /etc/containerd/config.toml
    sed -i 's/SystemdCgroup = false/SystemdCgroup = true/' /etc/containerd/config.toml
    systemctl restart containerd
    systemctl enable docker

    # ---- Install Kubernetes Tools ----
    # kubeadm: sets up the cluster
    # kubelet: the agent that runs on every node
    # kubectl: the CLI you use to manage the cluster
    curl -fsSL https://pkgs.k8s.io/core:/stable:/v1.29/deb/Release.key | gpg --dearmor -o /etc/apt/keyrings/kubernetes-apt-keyring.gpg
    echo "deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] https://pkgs.k8s.io/core:/stable:/v1.29/deb/ /" > /etc/apt/sources.list.d/kubernetes.list
    apt-get update -y
    apt-get install -y kubelet kubeadm kubectl
    apt-mark hold kubelet kubeadm kubectl

    # ---- Enable Required Kernel Modules ----
    cat > /etc/modules-load.d/k8s.conf <<EOF
    overlay
    br_netfilter
    EOF
    modprobe overlay
    modprobe br_netfilter

    # ---- Networking Config for K8s ----
    cat > /etc/sysctl.d/k8s.conf <<EOF
    net.bridge.bridge-nf-call-iptables  = 1
    net.bridge.bridge-nf-call-ip6tables = 1
    net.ipv4.ip_forward                 = 1
    EOF
    sysctl --system

    # ---- Disable Swap (Kubernetes requirement) ----
    swapoff -a
    sed -i '/ swap / s/^/#/' /etc/fstab

    echo "✅ Bootstrap complete — ready for kubeadm init/join"
  USERDATA
}

# ---------- MASTER NODE ----------
resource "aws_instance" "master" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = var.instance_type
  key_name               = var.key_pair_name
  subnet_id              = aws_subnet.public_a.id
  vpc_security_group_ids = [aws_security_group.k8s_cluster.id]

  user_data = local.k8s_bootstrap

  root_block_device {
    volume_size = 30 # GB — K8s images need space
    volume_type = "gp3"
  }

  tags = {
    Name = "${var.project_name}-master"
    Role = "master"
  }
}

# ---------- WORKER NODE ----------
resource "aws_instance" "worker" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = var.instance_type
  key_name               = var.key_pair_name
  subnet_id              = aws_subnet.public_a.id
  vpc_security_group_ids = [aws_security_group.k8s_cluster.id]

  user_data = local.k8s_bootstrap

  root_block_device {
    volume_size = 30
    volume_type = "gp3"
  }

  tags = {
    Name = "${var.project_name}-worker"
    Role = "worker"
  }
}

# ---------- Elastic IP for Master ----------
# A regular EC2 gets a new IP every time it reboots.
# An Elastic IP is a FIXED public IP that stays the same.
# This is important because kubectl and Jenkins need to
# connect to the master at a known address.
resource "aws_eip" "master" {
  instance = aws_instance.master.id
  domain   = "vpc"

  tags = {
    Name = "${var.project_name}-master-eip"
  }
}
