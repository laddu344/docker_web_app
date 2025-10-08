pipeline {
    agent any

    tools {
        nodejs "node23"
    }

    environment {
        AWS_REGION = "eu-north-1"
        CLUSTER_NAME = "tyson-cluster-2"
        DOCKERHUB_USER = "varaprasadrenati"
        DOCKER_IMAGE = "varaprasadrenati/node-app"
        PATH = "${env.WORKSPACE}/bin:${env.PATH}"
    }

    stages {

        stage('Prepare Tools (kubectl & eksctl)') {
            steps {
                script {
                    sh '''
                    mkdir -p ${WORKSPACE}/bin

                    # kubectl
                    curl -LO https://dl.k8s.io/release/v1.34.1/bin/linux/amd64/kubectl
                    chmod +x kubectl
                    mv kubectl ${WORKSPACE}/bin/

                    # eksctl
                    curl -sLO https://github.com/eksctl-io/eksctl/releases/latest/download/eksctl_Linux_amd64.tar.gz
                    tar -xzf eksctl_Linux_amd64.tar.gz
                    mv eksctl ${WORKSPACE}/bin/

                    kubectl version --client
                    eksctl version
                    '''
                }
            }
        }

        stage('Clone NodeJS App') {
            steps {
                checkout([$class: 'GitSCM',
                    branches: [[name: '*/main']],
                    userRemoteConfigs: [[
                        url: 'https://github.com/laddu344/docker_web_app.git',
                        credentialsId: 'github-creds'
                    ]]
                ])
            }
        }

        stage('Install NodeJS Dependencies') {
            steps {
                sh 'npm install'
            }
        }

        stage('Build & Push Docker Image') {
            steps {
                script {
                    withCredentials([usernamePassword(credentialsId: 'docker-creds', usernameVariable: 'DOCKER_USER', passwordVariable: 'DOCKER_PASS')]) {
                        sh '''
                        echo $DOCKER_PASS | docker login -u $DOCKER_USER --password-stdin
                        docker build -t $DOCKER_IMAGE .
                        docker push $DOCKER_IMAGE
                        '''
                    }
                }
            }
        }

        stage('Create EKS Cluster') {
            steps {
                script {
                    sh '''
                    eksctl create cluster \
                        --name ${CLUSTER_NAME} \
                        --region ${AWS_REGION} \
                        --nodegroup-name worker-nodes \
                        --node-type t3.medium \
                        --nodes 2 \
                        --managed || echo "Cluster may already exist"
                    '''
                }
            }
        }

        stage('Deploy NodeJS App to EKS') {
            steps {
                script {
                    sh '''
                    aws eks update-kubeconfig --name ${CLUSTER_NAME} --region ${AWS_REGION}

                    # Apply Kubernetes deployment and service
                    kubectl apply -f nodejsapp.yaml

                    # Wait for LoadBalancer hostname
                    echo "Waiting for LoadBalancer hostname..."
                    for i in {1..30}; do
                        HOSTNAME=$(kubectl get svc nodejs-service -o jsonpath="{.status.loadBalancer.ingress[0].hostname}" || true)
                        if [ ! -z "$HOSTNAME" ]; then
                            echo "==========================================="
                            echo "✅ NodeJS App URL: http://$HOSTNAME:3000"
                            echo "==========================================="
                            break
                        fi
                        echo "Waiting... ($i/30)"
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
