pipeline {
    agent any

    tools {
        nodejs "node23"
    }

    environment {
        AWS_REGION = "ap-south-1"
        CLUSTER_NAME = "tyson-cluster"
        DOCKERHUB_USER = "varaprasadrenati"
        DOCKER_IMAGE = "varaprasadrenati/node-app"
        PATH = "${env.WORKSPACE}/bin:${env.PATH}"
    }

    stages {

        stage('Prepare Tools (kubectl & eksctl)') {
            steps {
                script {
                    echo "Installing kubectl and eksctl locally..."
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

        stage('Clone code from GitHub') {
            steps {
                checkout scm
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

        stage('Create/Check EKS Cluster') {
            steps {
                script {
                    echo "Checking if EKS Cluster '${CLUSTER_NAME}' exists..."
                    def clusterExists = sh(script: "eksctl get cluster --name ${CLUSTER_NAME} --region ${AWS_REGION}", returnStatus: true) == 0
                    if (!clusterExists) {
                        echo "Cluster does not exist. Creating EKS Cluster..."
                        sh """
                        eksctl create cluster \
                            --name ${CLUSTER_NAME} \
                            --region ${AWS_REGION} \
                            --nodegroup-name worker-nodes \
                            --node-type c7i-flex.large \
                            --nodes 2 \
                            --managed
                        """
                    } else {
                        echo "Cluster already exists. Skipping creation."
                    }
                    sh "aws eks update-kubeconfig --name ${CLUSTER_NAME} --region ${AWS_REGION}"
                }
            }
        }

        stage('Deploy NodeJS App on EKS') {
            steps {
                script {
                    echo "Deploying NodeJS App to EKS..."
                    sh '''
                    kubectl apply -f nodejsapp.yaml

                    echo "Waiting for LoadBalancer hostname and pod readiness..."
                    for i in {1..30}; do
                        HOSTNAME=$(kubectl get svc nodejs-service -o jsonpath="{.status.loadBalancer.ingress[0].hostname}" || true)
                        READY=$(kubectl get pods -l app=nodejs-app -o jsonpath="{.items[0].status.containerStatuses[0].ready}")
                        if [ ! -z "$HOSTNAME" ] && [ "$READY" == "true" ]; then
                            echo "==========================================="
                            echo "✅ NodeJS App URL: http://$HOSTNAME"
                            echo "==========================================="
                            break
                        fi
                        echo "Waiting for LoadBalancer and pod readiness... ($i/30)"
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
