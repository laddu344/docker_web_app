pipeline {
    agent any

    tools {
        nodejs "node23" // NodeJS tool configured in Jenkins
    }

    environment {
        DOCKER_HUB_USER = 'varaprasadrenati'
        DOCKER_CREDENTIALS_ID = 'docker-creds'
        IMAGE_NAME = 'nodejsapp'
        AWS_REGION = 'eu-north-1'
        EKS_CLUSTER = 'nodejs-cluster'
        HOME_BIN = "$HOME/bin"
    }

    stages {

        stage('Clone NodeJS App') {
            steps {
                checkout([$class: 'GitSCM',
                    branches: [[name: '*/main']],
                    userRemoteConfigs: [[
                        url: 'https://github.com/laddu344/docker_web_app.git',
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

        stage('Push Docker Image') {
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
                        echo "Cluster not found. Creating EKS cluster in default VPC..."
                        eksctl create cluster \
                            --name ${EKS_CLUSTER} \
                            --region ${AWS_REGION} \
                            --nodegroup-name worker-nodes \
                            --node-type t3.medium \
                            --nodes 2 \
                            --managed
                    else
                        echo "Cluster ${EKS_CLUSTER} already exists."
                    fi
                    '''
                }
            }
        }

        stage('Deploy NodeJS App to EKS') {
            steps {
                script {
                    sh '''
                    export PATH=$HOME/bin:$PATH

                    # Configure kubeconfig
                    aws eks update-kubeconfig --name ${EKS_CLUSTER} --region ${AWS_REGION}

                    DEPLOY_FILE="nodejsapp.yaml"
                    if [ ! -f "$DEPLOY_FILE" ]; then
                        echo "❌ ${DEPLOY_FILE} not found!"
                        exit 1
                    fi

                    # Replace Docker image with current build
                    sed -i "s|image: .*|image: ${DOCKER_HUB_USER}/${IMAGE_NAME}:${BUILD_NUMBER}|" $DEPLOY_FILE

                    # Deploy to Kubernetes
                    kubectl apply -f $DEPLOY_FILE
                    kubectl rollout status deployment/nodejsapp-deployment

                    # Get LoadBalancer URL
                    APP_URL=$(kubectl get svc nodejsapp-service -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
                    if [ -z "$APP_URL" ]; then
                        echo "⚠️ LoadBalancer URL not ready yet. Check AWS console."
                    else
                        echo "✅ NodeJS app is live at: http://$APP_URL"
                    fi
                    '''
                }
            }
        }
    }

    post {
        success {
            echo "✅ NodeJS app deployment completed successfully!"
        }
        failure {
            echo "❌ Deployment failed. Check logs above."
        }
    }
}
