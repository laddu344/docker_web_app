pipeline {
    agent any

    tools {
        nodejs "node23"
    }

    environment {
        DOCKER_HUB_USER = 'varaprasadrenati'
        DOCKER_CREDENTIALS_ID = 'docker-creds'
        IMAGE_NAME = 'myntra-node-app'
        AWS_REGION = 'eu-north-1'
        EKS_CLUSTER = 'tyson-cluster'
        HOME_BIN = "$HOME/bin"
        VPC_PUBLIC_SUBNETS = 'subnet-aaaaaa,subnet-bbbbbb'
        VPC_PRIVATE_SUBNETS = 'subnet-xxxxxx,subnet-yyyyyy'
    }

    stages {

        stage('Clone Code from GitHub') {
            steps {
                checkout([$class: 'GitSCM',
                    branches: [[name: '*/main']],
                    userRemoteConfigs: [[
                        url: 'https://github.com/laddu344/Myntra.git',
                        credentialsId: 'GITHUB_CREDENTIALS'
                    ]]
                ])
            }
        }

        stage('Install Dependencies') {
            steps {
                sh 'npm install'
            }
        }

        stage('Build Docker Image') {
            steps {
                script {
                    def imageTag = "${DOCKER_HUB_USER}/${IMAGE_NAME}:${BUILD_NUMBER}"
                    sh "docker build -t ${imageTag} ."
                }
            }
        }

        stage('Push Image to DockerHub') {
            steps {
                script {
                    def imageTag = "${DOCKER_HUB_USER}/${IMAGE_NAME}:${BUILD_NUMBER}"
                    withCredentials([usernamePassword(
                        credentialsId: "${DOCKER_CREDENTIALS_ID}",
                        usernameVariable: 'DOCKER_USER',
                        passwordVariable: 'DOCKER_PASS'
                    )]) {
                        sh 'echo "$DOCKER_PASS" | docker login -u "$DOCKER_USER" --password-stdin'
                    }
                    sh "docker push ${imageTag}"
                }
            }
        }

        stage('Install eksctl & kubectl') {
            steps {
                script {
                    sh '''
                    mkdir -p $HOME/bin
                    export PATH=$HOME/bin:$PATH

                    # Install eksctl
                    if ! command -v eksctl >/dev/null 2>&1; then
                        curl --silent --location "https://github.com/weaveworks/eksctl/releases/latest/download/eksctl_$(uname -s)_amd64.tar.gz" | tar xz -C /tmp
                        mv /tmp/eksctl $HOME/bin/
                        chmod +x $HOME/bin/eksctl
                    fi

                    # Install kubectl
                    if ! command -v kubectl >/dev/null 2>&1; then
                        curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
                        chmod +x kubectl
                        mv kubectl $HOME/bin/
                    fi
                    '''
                }
            }
        }

        stage('Create EKS Cluster if Not Exists') {
            steps {
                script {
                    sh '''
                    export PATH=$HOME/bin:$PATH

                    if ! eksctl get cluster --name ${EKS_CLUSTER} --region ${AWS_REGION} >/dev/null 2>&1; then
                        echo "Cluster not found. Creating EKS cluster in existing VPC..."
                        eksctl create cluster \
                            --name ${EKS_CLUSTER} \
                            --region ${AWS_REGION} \
                            --nodegroup-name worker-nodes \
                            --node-type t3.medium \
                            --nodes 2 \
                            --managed \
                            --vpc-public-subnets=${VPC_PUBLIC_SUBNETS} \
                            --vpc-private-subnets=${VPC_PRIVATE_SUBNETS}
                    else
                        echo "Cluster ${EKS_CLUSTER} already exists."
                    fi
                    '''
                }
            }
        }

        stage('Deploy to EKS Cluster') {
            steps {
                script {
                    sh '''
                    export PATH=$HOME/bin:$PATH

                    # Configure kubeconfig
                    aws eks update-kubeconfig --name ${EKS_CLUSTER} --region ${AWS_REGION}

                    # Ensure deployment.yaml exists
                    if [ ! -f deployment.yaml ]; then
                        echo "❌ deployment.yaml not found!"
                        exit 1
                    fi

                    # Update Docker image
                    sed -i "s|image: .*|image: ${DOCKER_HUB_USER}/${IMAGE_NAME}:${BUILD_NUMBER}|" deployment.yaml

                    # Deploy to Kubernetes
                    kubectl apply -f deployment.yaml
                    kubectl rollout status deployment/myntra-node-app-deployment

                    # Get LoadBalancer URL
                    APP_URL=$(kubectl get svc myntra-node-app-service -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
                    if [ -z "$APP_URL" ]; then
                        echo "⚠️ LoadBalancer URL not ready. Check AWS console."
                    else
                        echo "✅ Application is live at: http://$APP_URL"
                    fi
                    '''
                }
            }
        }
    }

    post {
        success {
            echo "✅ Deployment completed successfully!"
        }
        failure {
            echo "❌ Deployment failed. Check the logs above."
        }
    }
}
