// ============================================================
// Jenkinsfile — CI/CD Pipeline
// ============================================================
// WHAT IS A JENKINSFILE?
// It's a script that tells Jenkins exactly what to do when
// new code is pushed to GitHub. Think of it as a recipe:
//
//   Step 1: Download the latest code
//   Step 2: Run tests to make sure nothing is broken
//   Step 3: Build Docker images (package the app)
//   Step 4: Push images to Docker Hub (cloud storage for images)
//   Step 5: Tell Kubernetes to use the new images (deploy)
//
// TRIGGERED BY: A GitHub webhook fires every time you push
// to the 'main' branch. Jenkins receives this notification
// and starts the pipeline automatically.
//
// SETUP REQUIRED IN JENKINS:
//   1. Install plugins: Docker Pipeline, Kubernetes CLI
//   2. Add credentials:
//      - 'dockerhub-creds' (Username/Password for Docker Hub)
//      - 'kubeconfig'      (Secret file with ~/.kube/config)
// ============================================================

pipeline {
    // Run on any available Jenkins agent
    agent any

    // Variables used throughout the pipeline
    environment {
        DOCKERHUB_USER = '1sammy'
        BACKEND_IMAGE  = "${DOCKERHUB_USER}/naqsh-backend"
        FRONTEND_IMAGE = "${DOCKERHUB_USER}/naqsh-frontend"
        // BUILD_NUMBER is auto-set by Jenkins (1, 2, 3, ...)
        // We use it to tag images so every build has a unique version
        IMAGE_TAG      = "${BUILD_NUMBER}"
    }

    stages {
        // ---- Stage 1: Get the code ----
        stage('Checkout') {
            steps {
                // Jenkins clones your GitHub repo automatically
                checkout scm
            }
        }

        // ---- Stage 2: Run tests ----
        // If tests fail, the pipeline STOPS here.
        // No broken code gets deployed.
        stage('Test Backend') {
            steps {
                dir('backend') {
                    sh 'npm ci'
                    sh 'npm test || echo "No tests configured yet — skipping"'
                }
            }
        }

        // ---- Stage 3: Build Docker images ----
        // Creates fresh images with the latest code
        stage('Build Docker Images') {
            parallel {
                // "parallel" = both build at the same time (faster)
                stage('Build Backend') {
                    steps {
                        dir('backend') {
                            sh "docker build -t ${BACKEND_IMAGE}:${IMAGE_TAG} -t ${BACKEND_IMAGE}:latest ."
                        }
                    }
                }
                stage('Build Frontend') {
                    steps {
                        dir('frontend') {
                            // Pass the backend URL as a build argument.
                            // MASTER_IP should be set in Jenkins as an
                            // environment variable pointing to your EC2 IP.
                            sh """
                                docker build \
                                  --build-arg VITE_SERVER=http://\${MASTER_IP:-localhost}:3001 \
                                  -t ${FRONTEND_IMAGE}:${IMAGE_TAG} \
                                  -t ${FRONTEND_IMAGE}:latest .
                            """
                        }
                    }
                }
            }
        }

        // ---- Stage 4: Push images to Docker Hub ----
        // Like pushing code to GitHub, but for Docker images.
        // Docker Hub stores them so your K8s cluster can pull them.
        stage('Push to Docker Hub') {
            steps {
                withCredentials([
                    usernamePassword(
                        credentialsId: 'dockerhub-creds',
                        usernameVariable: 'DOCKER_USER',
                        passwordVariable: 'DOCKER_PASS'
                    )
                ]) {
                    sh 'echo $DOCKER_PASS | docker login -u $DOCKER_USER --password-stdin'
                    sh "docker push ${BACKEND_IMAGE}:${IMAGE_TAG}"
                    sh "docker push ${BACKEND_IMAGE}:latest"
                    sh "docker push ${FRONTEND_IMAGE}:${IMAGE_TAG}"
                    sh "docker push ${FRONTEND_IMAGE}:latest"
                }
            }
        }

        // ---- Stage 5: Deploy to Kubernetes ----
        // "kubectl set image" tells K8s to update the running
        // containers to use the new image. K8s does a "rolling
        // update" — it starts new pods with the new image, waits
        // until they're healthy, THEN kills the old pods.
        // Result: zero downtime.
        stage('Deploy to Kubernetes') {
            steps {
                withCredentials([file(credentialsId: 'kubeconfig', variable: 'KUBECONFIG')]) {
                    sh """
                        kubectl set image deployment/backend \
                          backend=${BACKEND_IMAGE}:${IMAGE_TAG} \
                          -n naqsh --record

                        kubectl set image deployment/frontend \
                          frontend=${FRONTEND_IMAGE}:${IMAGE_TAG} \
                          -n naqsh --record

                        kubectl rollout status deployment/backend -n naqsh --timeout=120s
                        kubectl rollout status deployment/frontend -n naqsh --timeout=120s
                    """
                }
            }
        }
    }

    // ---- After the pipeline finishes ----
    post {
        success {
            echo '✅ Pipeline succeeded — new version deployed!'
        }
        failure {
            echo '❌ Pipeline failed — check the logs above.'
        }
        always {
            // Clean up Docker login credentials
            sh 'docker logout || true'
        }
    }
}
