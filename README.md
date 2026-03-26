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
