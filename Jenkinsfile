pipeline {
    agent any

    tools {
        nodejs "node23"
    }

    environment {
        AWS_REGION = "eu-north-1"
        CLUSTER_NAME = "tyson-cluster"
        DOCKERHUB_USER = "varaprasadrenati"
        DOCKER_IMAGE = "varaprasadrenati/node-app-1.0"
    }

    stages {

        stage('Install kubectl & eksctl') {
            steps {
                script {
                    echo "Installing kubectl and eksctl..."
                    sh '''
                    # Install kubectl (latest version for EKS)
                    curl -o kubectl https://s3.us-west-2.amazonaws.com/amazon-eks/1.30.0/2024-09-20/bin/linux/amd64/kubectl
                    chmod +x ./kubectl
                    sudo mv ./kubectl /usr/local/bin/kubectl
                    kubectl version --client

                    # Install eksctl
                    curl -sLO "https://github.com/eksctl-io/eksctl/releases/latest/download/eksctl_$(uname -s)_amd64.tar.gz"
                    tar -xzf eksctl_$(uname -s)_amd64.tar.gz
                    sudo mv eksctl /usr/local/bin
                    eksctl version
                    '''
                }
            }
        }

        stage('Clone code from GitHub') {
            steps {
                script {
                    checkout scmGit(
                        branches: [[name: '*/main']],
                        extensions: [],
                        userRemoteConfigs: [[
                            credentialsId: 'GITHUB_CREDENTIALS',
                            url: 'https://github.com/devopshint/Deploy-NodeApp-to-AWS-EKS-using-Jenkins-Pipeline'
                        ]]
                    )
                }
            }
        }

        stage('Node JS Build') {
            steps {
                sh 'npm install'
            }
        }

        stage('Build & Push Docker Image') {
            steps {
                script {
                    withCredentials([string(credentialsId: 'varaprasadrenati_dockerhub_token', variable: 'DOCKER_PASS')]) {
                        sh '''
                        echo "Logging into DockerHub..."
                        echo $DOCKER_PASS | docker login -u ${DOCKERHUB_USER} --password-stdin
                        docker build -t ${DOCKER_IMAGE} .
                        docker push ${DOCKER_IMAGE}
                        '''
                    }
                }
            }
        }

        stage('Create EKS Cluster (tyson-cluster)') {
            steps {
                script {
                    echo "Creating EKS Cluster 'tyson-cluster' with 2 nodes in eu-north-1..."
                    sh '''
                    eksctl create cluster \
                        --name ${CLUSTER_NAME} \
                        --region ${AWS_REGION} \
                        --nodegroup-name worker-nodes \
                        --node-type t3.medium \
                        --nodes 2 \
                        --managed
                    '''
                }
            }
        }

        stage('Deploy NodeJS App on EKS') {
            steps {
                script {
                    echo "Deploying NodeJS App to EKS..."
                    sh '''
                    aws eks update-kubeconfig --name ${CLUSTER_NAME} --region ${AWS_REGION}
                    kubectl apply -f nodejsapp.yaml

                    echo "Waiting for LoadBalancer URL..."
                    for i in {1..30}; do
                        URL=$(kubectl get svc nodejs-service -o jsonpath="{.status.loadBalancer.ingress[0].hostname}" || true)
                        if [ ! -z "$URL" ]; then
                            echo "==========================================="
                            echo "✅ NodeJS App URL: http://$URL:3000"
                            echo "==========================================="
                            break
                        fi
                        echo "Waiting for LoadBalancer to be ready... ($i/30)"
                        sleep 20
                    done
                    '''
                }
            }
        }
    }

    post {
        always {
            echo 'Pipeline execution finished ✅'
        }
    }
}
