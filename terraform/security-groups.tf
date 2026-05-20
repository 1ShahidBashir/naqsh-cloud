# ============================================================
# Security Groups — Firewall Rules
# ============================================================
# WHAT IS A SECURITY GROUP?
# It's a virtual firewall around your EC2 instances.
# You define which ports are open for incoming (ingress)
# and outgoing (egress) traffic. Everything else is blocked.
#
# Think of it like this:
#   - Port 22 (SSH): so you can log into the server
#   - Port 80/443 (HTTP/HTTPS): so users can access your app
#   - Port 6443 (K8s API): so kubectl can manage the cluster
#   - Ports 30000-32767 (NodePort): K8s exposes services here
# ============================================================

resource "aws_security_group" "k8s_cluster" {
  name        = "${var.project_name}-k8s-sg"
  description = "Security group for Kubernetes master and worker nodes"
  vpc_id      = aws_vpc.main.id

  # ---------- INBOUND RULES ----------

  # SSH access (for you to log into the servers)
  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # HTTP (web traffic)
  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # HTTPS (secure web traffic)
  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Kubernetes API Server (kubectl talks to this)
  ingress {
    description = "Kubernetes API"
    from_port   = 6443
    to_port     = 6443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # NodePort range (K8s exposes services on these ports)
  ingress {
    description = "Kubernetes NodePort Services"
    from_port   = 30000
    to_port     = 32767
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Allow all traffic within the cluster (master ↔ worker)
  ingress {
    description = "Intra-cluster communication"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    self        = true
  }

  # Flannel VXLAN (Kubernetes networking between nodes)
  ingress {
    description = "Flannel VXLAN"
    from_port   = 8472
    to_port     = 8472
    protocol    = "udp"
    cidr_blocks = ["10.0.0.0/16"]
  }

  # Kubelet API (master talks to workers via this)
  ingress {
    description = "Kubelet API"
    from_port   = 10250
    to_port     = 10250
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/16"]
  }

  # ---------- OUTBOUND RULES ----------
  # Allow all outgoing traffic (downloading packages, pulling
  # Docker images, etc.)
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-k8s-sg"
  }
}
