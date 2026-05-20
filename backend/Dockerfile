# ============================================================
# NAQSH Backend — Production Dockerfile
# ============================================================
# WHAT THIS DOES:
# This file tells Docker how to package your Node.js backend
# into a lightweight, self-contained "image" that can run
# anywhere (your laptop, AWS EC2, Kubernetes, etc.)
#
# WHY MULTI-STAGE:
# Stage 1 installs ALL dependencies (including dev ones) to
# build anything needed. Stage 2 copies only production deps,
# making the final image much smaller (~150MB vs ~800MB).
# ============================================================

# ---------- Stage 1: Install dependencies ----------
# Start from a minimal Node.js 20 image (Alpine Linux = tiny)
FROM node:20-alpine AS builder

# Set the working directory inside the container
WORKDIR /app

# Copy package files first (Docker caches this layer — if
# package.json hasn't changed, it skips reinstalling)
COPY package*.json ./

# Install ALL dependencies (including devDependencies)
RUN npm ci

# ---------- Stage 2: Production image ----------
FROM node:20-alpine

WORKDIR /app

# Copy only package files for production install
COPY package*.json ./

# Install ONLY production dependencies (smaller image)
RUN npm ci --omit=dev

# Copy your actual application code
COPY . .

# Tell Docker this container listens on port 3001
# (This is documentation — the actual port is set by your .env)
EXPOSE 3001

# The command that runs when the container starts
CMD ["node", "index.js"]
