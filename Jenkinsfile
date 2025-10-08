pipeline {
    agent any

    tools {
        nodejs "node23" // NodeJS configured in Jenkins
    }

    environment {
        AWS_REGION      = "eu-north-1"
        CLUSTER_NAME    = "tyson-cluster-5"
        DOCKERHUB_USER  = "varaprasadrenati"
        DOCKER_IMAGE    = "varaprasadrenati/node-app"
        PATH            = "${env.WORKSPACE}/bin:${env.PATH}"
    }

    stages {

        stage('Prepare Tools') {
            steps {
                script {
                    echo "Installing kubectl and eksctl..."
                    sh '''
                    mkdir -p ${WORKSPACE}/bin

                    # Install kubectl
                    curl -LO https://dl.k8s.io/release/v1.34.1/bin/linux/amd64/kubectl
                    chmod +x kubectl
                    mv kubectl ${WORKSPACE}/bin/

                    # Install eksctl
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

        stage('Install Dependencies') {
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

        stage('Create EKS Cluster (Default VPC)') {
            steps {
                script {
                    echo "Creating EKS Cluster '${CLUSTER_NAME}' in default VPC if not exists..."
                    sh '''
                    export PATH=${WORKSPACE}/bin:$PATH

                    if ! eksctl get cluster --name ${CLUSTER_NAME} --region ${AWS_REGION} >/dev/null 2>&1; then
                        echo "Cluster not found. Creating EKS cluster using default VPC..."
                        eksctl create cluster \
                            --name ${CLUSTER_NAME} \
                            --region ${AWS_REGION} \
                            --nodegroup-name worker-nodes \
                            --node-type t3.medium \
                            --nodes 2 \
                            --managed
                    else
                        echo "Cluster ${CLUSTER_NAME} already exists."
                    fi
                    '''
                }
            }
        }

        stage('Deploy NodeJS App to EKS') {
            steps {
                script {
                    echo "Deploying NodeJS app..."
                    sh '''
                    export PATH=${WORKSPACE}/bin:$PATH

                    # Configure kubeconfig
                    aws eks update-kubeconfig --name ${CLUSTER_NAME} --region ${AWS_REGION}

                    # Ensure Kubernetes manifest exists
                    if [ ! -f nodejsapp.yaml ]; then
                        echo "❌ nodejsapp.yaml not found!"
                        exit 1
                    fi

                    # Update Docker image in YAML
                    sed -i "s|image: .*|image: ${DOCKER_IMAGE}|" nodejsapp.yaml

                    # Deploy to Kubernetes
                    kubectl apply -f nodejsapp.yaml
                    kubectl rollout status deployment/nodejs-deployment

                    # Wait for LoadBalancer URL
                    for i in {1..30}; do
                        HOSTNAME=$(kubectl get svc nodejs-service -o jsonpath="{.status.loadBalancer.ingress[0].hostname}" || true)
                        if [ ! -z "$HOSTNAME" ]; then
                            echo "✅ NodeJS App URL: http://$HOSTNAME:3000"
                            break
                        fi
                        echo "Waiting for LoadBalancer ($i/30)..."
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
        success {
            echo 'NodeJS App deployed successfully!'
        }
        failure {
            echo '❌ Deployment failed. Check logs above.'
        }
    }
}
