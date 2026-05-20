# ============================================================
# NAQSH Frontend — Production Dockerfile
# ============================================================
# WHAT THIS DOES:
# This is a TWO-STAGE build:
#   Stage 1 ("builder"): Uses Node.js to run "npm run build",
#     which compiles your React JSX into plain HTML/CSS/JS.
#   Stage 2 ("production"): Uses Nginx to serve those files.
#
# The final image is ~25MB (just Nginx + your built files).
# No Node.js in production = smaller, faster, more secure.
# ============================================================

# ---------- Stage 1: Build the React app ----------
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

# Copy all source code
COPY . .

# This build-arg lets us inject the backend URL at build time.
# In Kubernetes, the backend will be at a different address
# than localhost:3001, so we need to pass it here.
ARG VITE_SERVER=http://localhost:3001
ENV VITE_SERVER=$VITE_SERVER

# Build the production bundle (output goes to /app/dist/)
RUN npm run build

# ---------- Stage 2: Serve with Nginx ----------
FROM nginx:alpine

# Remove the default Nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy our custom Nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy the built files from Stage 1
COPY --from=builder /app/dist /usr/share/nginx/html

# Nginx listens on port 80
EXPOSE 80

# Start Nginx in the foreground (required for Docker)
CMD ["nginx", "-g", "daemon off;"]
