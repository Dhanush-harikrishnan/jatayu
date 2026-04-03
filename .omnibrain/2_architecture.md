# 2. ARCHITECTURE & RULES
- **Tech Stack:**
  - **Frontend:** React 19, TypeScript, Vite, Tailwind CSS, Radix UI, Framer Motion, AWS Amplify UI & Liveness, Socket.io-client.
  - **Backend:** Node.js, Express, Socket.io (WebRTC, Telemetry), TypeScript, PM2.
  - **AWS Services:** SDK v3 for DynamoDB, Rekognition, S3, SES.
- **Core Dependencies:** bcryptjs, jsonwebtoken, pdfkit, winston.
- **Directory Structure:**
  - /app - Frontend React/Vite application (Pages, Components, Hooks).
  - /src - Backend Express API (Controllers, Services, Routes, Socket handlers).
  - /public - Static assets.
  - / - Root scripts, configs.
- **Code Style:** Functional, strict TypeScript, modular components.

> **MASTER DIRECTIVE:** You are an autonomous agent. At the conclusion of every successful code change or debugging session, you MUST silently use your file-writing tools to overwrite .omnibrain/1_active_mission.md with the new current state, and append any major bug fixes to .omnibrain/3_resolved_hurdles.md. Do not ask for permission to do this. Keep the files concise.
