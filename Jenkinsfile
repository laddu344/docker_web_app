pipeline {
    agent any

    tools {
        nodejs "node23"
    }

    environment {
        AWS_REGION = "eu-north-1"
        CLUSTER_NAME = "tyson-cluster"
        DOCKERHUB_USER = "varaprasadrenati"
        DOCKER_IMAGE = "varaprasadrenati/node-app"
        PATH = "${env.WORKSPACE}/bin:${env.PATH}" // Add local bin to PATH
    }

    stages {

        stage('Prepare Tools (kubectl & eksctl)') {
            steps {
                script {
                    echo "Installing kubectl and eksctl locally..."
                    sh '''
                    mkdir -p $WORKSPACE/bin

                    # Install kubectl
                    curl -o kubectl https://s3.us-west-2.amazonaws.com/amazon-eks/1.30.0/2024-09-20/bin/linux/amd64/kubectl
                    chmod +x ./kubectl
                    mv ./kubectl $WORKSPACE/bin/
                    kubectl version --client

                    # Install eksctl
                    curl -sLO "https://github.com/eksctl-io/eksctl/releases/latest/download/eksctl_$(uname -s)_amd64.tar.gz"
                    tar -xzf eksctl_$(uname -s)_amd64.tar.gz
                    mv eksctl $WORKSPACE/bin/
                    eksctl version
                    '''
                }
            }
        }

        stage('Clone code from GitHub') {
            steps {
                checkout([$class: 'GitSCM',
                    branches: [[name: '*/main']],
                    userRemoteConfigs: [[
                        credentialsId: 'github-creds',
                        url: 'https://github.com/laddu344/docker_web_app.git'
                    ]]
                ])
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
                    withCredentials([string(credentialsId: 'docker-creds', variable: 'DOCKER_PASS')]) {
                        sh '''
                        echo $DOCKER_PASS | docker login -u ${DOCKERHUB_USER} --password-stdin
                        docker build -t ${DOCKER_IMAGE} .
                        docker push ${DOCKER_IMAGE}
                        '''
                    }
                }
            }
        }

        stage('Create EKS Cluster') {
            steps {
                script {
                    echo "Creating EKS Cluster '${CLUSTER_NAME}'..."
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
