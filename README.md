# SecureGuard Pro Backend

This repository contains the backend service for SecureGuard Pro, a multi-camera proctoring solution built with Node.js, Express, Socket.io, and AWS services.

## Features
- **Tokenized Pairing**: Link a laptop and a mobile phone to the same session using ephemeral JWT magic links powered by AWS SES.
- **WebRTC Signaling**: Pure WebRTC connection negotiation across rooms using SDP offers and ICE candidates.
- **Correlation Engine**: A sliding 5-second window analyzer correlating primary and secondary camera frames with ambient metrics (audio transcripts, gyro).
- **AWS Integration**: Leverages Rekognition (DetectFaces / DetectLabels), S3, DynamoDB, and SES.
- **Keystroke Dynamics**: Offloads keystroke vector analysis to a Python `child_process` running Isolation Forest models.

## Tech Stack
Node.js 20, Express, Socket.io v4 (websocket-only), AWS SDK v3, TypeScript, PM2.

## Getting Started

### Prerequisites
- Node.js >= 20
- Python 3 with `numpy` (and `scikit-learn` for actual inference)
- AWS Account configured with proper IAM permissions for Rekognition, S3, DynamoDB, and SES.

### Installation

1. Clone the repository and install dependencies:
   ```bash
   npm install
   ```
2. Set up environment variables:
   Copy `.env.example` to `.env` and fill in your AWS credentials and JWT secret.
   Make sure to provision the following AWS services:
   - **IAM User** with access to Rekognition, S3, DynamoDB, and SES.
   - **Rekognition** in the Mumbai region (`ap-south-1`).
   - **S3 Bucket** and **DynamoDB** in the Hyderabad region (`ap-south-2`).
   - **SES** verified email addresses for sending pairing links and PDF reports.
   ```bash
   cp .env.example .env
   ```
3. Install Python dependencies:
   ```bash
   pip install numpy
   ```

### Running Locally
To run the server in development mode:
```bash
npm run dev
```

### Production Deployment
To build and run in cluster mode using PM2:
```bash
npm run build
npm start
```

## DynamoDB Schema Provisioning
Ensure you provision the following DynamoDB table beforehand:
- **TableName**: `ProctoringEvents`
- **Partition Key**: `SessionId` (String)
- **Sort Key**: `EventTime#ViolationType` (String)
- **GSI-1**: Partition Key over `ViolationType` + Sort Key `EventTime`

## Notes
- To operate correctly, ensure Nginx or your load balancer leverages **Sticky Sessions** / IP hashing since WebSocket rooms rely on local server instances unless a Redis adapter is added.
- The Python keystroke model currently implements a mock return algorithm. Replace the commented `scikit-learn` logic with your pre-trained `isolation_forest_model.pkl`.

## EC2 One-Time Deployment (PowerShell)

Use this section when you want to create a new EC2 instance and deploy this repo from GitHub automatically.

### 1. Set values in PowerShell

```powershell
$Region = "ap-south-2"
$RepoUrl = "https://github.com/Dhanush-harikrishnan/jatayu.git"

# Required values - replace these
$KeyPairName = "YOUR_KEYPAIR_NAME"
$SecurityGroupId = "sg-xxxxxxxx"
$SubnetId = "subnet-xxxxxxxx"
$IamInstanceProfileName = "YOUR_EC2_IAM_ROLE_NAME"
$AwsAccountId = "YOUR_AWS_ACCOUNT_ID"
$JwtSecret = "CHANGE_THIS_JWT_SECRET"

# Optional values
$SesSourceEmail = "dhanushhari150504@gmail.com"
$AdminEmail = "dhanushhari150504@gmail.com"
$S3Bucket = "myapp-face-liveness-$AwsAccountId"
```

### 2. Create EC2 + auto-deploy using User Data

```powershell
$AmiId = aws ssm get-parameter `
   --region $Region `
   --name /aws/service/canonical/ubuntu/server/24.04/stable/current/amd64/hvm/ebs-gp3/ami-id `
   --query Parameter.Value `
   --output text

$UserData = @"
#!/bin/bash
set -e
exec > >(tee /var/log/secureguard-bootstrap.log | logger -t user-data -s 2>/dev/console) 2>&1

export DEBIAN_FRONTEND=noninteractive
apt update
apt install -y nginx git curl
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
npm i -g pm2

mkdir -p /var/www
cd /var/www
git clone __REPO_URL__ secureguard

cd /var/www/secureguard
npm ci

PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)

cat > .env <<EOF
NODE_ENV=production
PORT=3000
JWT_SECRET=__JWT_SECRET__
AWS_REGION=ap-south-2
AWS_REKOGNITION_REGION=ap-south-1
AWS_S3_BUCKET=__S3_BUCKET__
DYNAMODB_TABLE_NAME=ProctoringEvents
AWS_SES_SOURCE_EMAIL=__SES_EMAIL__
ADMIN_EMAIL=__ADMIN_EMAIL__
EOF

npm run build
pm2 start dist/server.js --name secureguard-api
pm2 save
pm2 startup systemd -u ubuntu --hp /home/ubuntu || true

cd /var/www/secureguard/app
npm ci
echo "VITE_API_URL=http://$PUBLIC_IP" > .env.production
npm run build

cat > /etc/nginx/sites-available/secureguard <<NGINX
server {
   listen 80 default_server;
   server_name _;

   root /var/www/secureguard/app/dist;
   index index.html;

   location / {
      try_files \$uri /index.html;
   }

   location /auth {
      proxy_pass http://127.0.0.1:3000;
      proxy_http_version 1.1;
      proxy_set_header Host \$host;
      proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
   }

   location /dashboard {
      proxy_pass http://127.0.0.1:3000;
      proxy_http_version 1.1;
      proxy_set_header Host \$host;
      proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
   }

   location /exam {
      proxy_pass http://127.0.0.1:3000;
      proxy_http_version 1.1;
      proxy_set_header Host \$host;
      proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
   }

   location /socket.io/ {
      proxy_pass http://127.0.0.1:3000/socket.io/;
      proxy_http_version 1.1;
      proxy_set_header Upgrade \$http_upgrade;
      proxy_set_header Connection "upgrade";
      proxy_set_header Host \$host;
   }

   location /health {
      proxy_pass http://127.0.0.1:3000/health;
   }
}
NGINX

ln -sf /etc/nginx/sites-available/secureguard /etc/nginx/sites-enabled/secureguard
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable nginx
systemctl restart nginx
"@

$UserData = $UserData.Replace("__REPO_URL__", $RepoUrl)
$UserData = $UserData.Replace("__JWT_SECRET__", $JwtSecret)
$UserData = $UserData.Replace("__S3_BUCKET__", $S3Bucket)
$UserData = $UserData.Replace("__SES_EMAIL__", $SesSourceEmail)
$UserData = $UserData.Replace("__ADMIN_EMAIL__", $AdminEmail)

$InstanceId = aws ec2 run-instances `
   --region $Region `
   --image-id $AmiId `
   --instance-type t3.medium `
   --key-name $KeyPairName `
   --security-group-ids $SecurityGroupId `
   --subnet-id $SubnetId `
   --iam-instance-profile Name=$IamInstanceProfileName `
   --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=SecureGuard-Prod}]" `
   --user-data ([Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($UserData))) `
   --query "Instances[0].InstanceId" `
   --output text

"Created instance: $InstanceId"
```

### 3. Get public IP and open app

```powershell
$PublicIp = aws ec2 describe-instances `
   --region $Region `
   --instance-ids $InstanceId `
   --query "Reservations[0].Instances[0].PublicIpAddress" `
   --output text

"Open: http://$PublicIp"
```

### 4. Required security group inbound rules

- TCP 22 from your IP (SSH)
- TCP 80 from `0.0.0.0/0` (HTTP)
- TCP 443 from `0.0.0.0/0` (HTTPS, if later enabled)
