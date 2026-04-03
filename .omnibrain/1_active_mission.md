# ACTIVE MISSION - Hackathon Winning Features for Virtusa Jatayu

## What We Already Have (Competitive Baseline)
- Multi-camera proctoring (laptop webcam + mobile secondary camera)
- AWS Rekognition (face detection, liveness, label detection)
- 11-rule Correlation Engine with sliding window
- Keystroke dynamics via Welford algorithm
- Real-time Socket.io telemetry
- Admin dashboard with live feeds and violation timeline
- Dynamic exam CRUD with DynamoDB (MCQ, Coding, Aptitude, Logical)
- PDF report generation with evidence snapshots
- Session termination with S3/DynamoDB cleanup

## Hackathon Judge Criteria (What Wins)
1. Innovation that solves a REAL problem
2. Technical depth (AI/ML, not just CRUD)
3. Live demo impact (wow factor in 5 minutes)
4. Scalability story
5. Polished UI/UX

---

## 7 KILLER FEATURES TO IMPLEMENT

### FEATURE 1: AI Trust Score Engine (THE signature differentiator)
- Composite 0-100 real-time score per student combining ALL signals
- Inputs: face confidence, gaze stability, keystroke anomaly score, tab switches, mobile camera violations, copy/paste count, time-between-answers pattern
- Algorithm: Weighted moving average with decay. Each violation type has a weight. Score starts at 100 and decays.
- Display: Animated circular gauge on admin dashboard per student card. Color shifts green-yellow-red.
- WHY IT WINS: Turns complex multi-signal data into ONE actionable number. No competitor will have this.

Files to modify:
- NEW: src/services/trustScoreEngine.ts (core scoring algorithm)
- MODIFY: src/services/correlationEngine.ts (feed violations into trust score)
- MODIFY: src/socket/telemetryHandler.ts (emit trust score updates via socket)
- MODIFY: app/src/pages/AdminDashboard.tsx (render trust gauge per student)

### FEATURE 2: AI-Generated Natural Language Report (via AWS Bedrock / Gemini API)
- After exam ends, feed all violation data + timestamps + trust score history to an LLM
- Generate a paragraph like: "During the 60-minute exam, Student X maintained a Trust Score of 87/100. At 14:32, trust dropped to 62 due to a tab switch coinciding with face-not-detected. The student recovered within 15 seconds. One phone detection event at 14:45 from secondary camera was flagged as HIGH severity. Overall assessment: LOW RISK."
- Embed this AI summary into the PDF report as a new section
- Admin can also see this summary in the violation modal drawer
- WHY IT WINS: Transforms raw data into human-readable intelligence. Judges LOVE LLM integration.

Files to modify:
- NEW: src/services/aiReportGenerator.ts (LLM prompt construction + API call)
- MODIFY: src/services/pdfService.ts (add AI Summary section before violation log)
- MODIFY: src/controllers/examController.ts (call AI generator on exam submit)
- MODIFY: app/src/components/modals/ViolationModal.tsx (show AI summary)

### FEATURE 3: Live Risk Heatmap on Admin Dashboard
- Replace the flat student grid with a visual heatmap
- Each student is a cell. Cell color = trust score (green/yellow/orange/red)
- Cell pulses/glows when active violation is happening
- Click cell opens the existing live drawer
- Bird's eye view of entire exam room at a glance
- WHY IT WINS: Visually stunning. Judges see it and immediately understand the value.

Files to modify:
- MODIFY: app/src/pages/AdminDashboard.tsx (add heatmap view mode alongside grid/list)
- NEW: app/src/components/RiskHeatmap.tsx (heatmap grid component)

### FEATURE 4: Anti-Cheat Browser Lockdown Detection
- Detect and flag: VM/emulator (navigator.userAgent sniffing), remote desktop (screen dimensions vs window), DevTools open (debugger timing attack), screen recording software (getDisplayMedia enumeration)
- Send detection results as telemetry events to correlation engine
- New violation types: VM_DETECTED, REMOTE_DESKTOP_DETECTED, DEVTOOLS_DETECTED
- WHY IT WINS: Shows deep security thinking. No student can cheat this system.

Files to modify:
- NEW: app/src/lib/antiCheat.ts (detection utilities)
- MODIFY: app/src/pages/LiveProctoring.tsx (run anti-cheat checks on mount, emit via socket)
- MODIFY: src/services/correlationEngine.ts (add Rules L, M, N for new violation types)

### FEATURE 5: Post-Exam Analytics Dashboard
- New page: /admin/analytics
- Charts: Violation frequency over time (line chart), Violation type distribution (donut), Trust score distribution across students (histogram), Exam completion rate, Average time per question
- Use lightweight charting: recharts or Chart.js (already common in React)
- Export analytics as CSV
- WHY IT WINS: Demonstrates data-driven decision making. Shows the platform is not just proctoring but an analytics tool.

Files to modify:
- NEW: app/src/pages/AdminAnalytics.tsx (full analytics page)
- NEW: src/controllers/analyticsController.ts (aggregate queries)
- MODIFY: src/routes/dashboardRoute.ts (add analytics endpoints)
- MODIFY: app/src/App.tsx or router (add /admin/analytics route)

### FEATURE 6: Exam Integrity Certificate with QR Verification
- After exam, generate a tamper-proof integrity certificate
- Contains: Student name, exam title, trust score, violation count, SHA-256 hash of all session data
- QR code on certificate links to a verification page showing if hash matches
- PDF certificate with professional design (university-style)
- WHY IT WINS: Blockchain-lite approach without the complexity. Shows real-world applicability.

Files to modify:
- NEW: src/services/certificateService.ts (hash generation + certificate PDF)
- MODIFY: src/controllers/examController.ts (generate certificate on submit)
- NEW: app/src/pages/CertificateVerify.tsx (QR verification page)

### FEATURE 7: Voice Activity Monitoring (using Web Audio API)
- Capture ambient audio during exam via getUserMedia audio track
- Use Web Audio API AnalyserNode to detect speech-level frequencies
- When sustained voice activity detected (not just noise), emit VOICE_DETECTED event
- Correlation engine already has SUSPECTED_TRANSCRIPTION rule - wire it up
- WHY IT WINS: Completes the multi-modal proctoring story (video + audio + keystroke + mobile)

Files to modify:
- NEW: app/src/lib/voiceDetector.ts (Web Audio API frequency analysis)
- MODIFY: app/src/pages/LiveProctoring.tsx (initialize voice detector, emit events)
- MODIFY: src/socket/telemetryHandler.ts (handle voice_activity events)

---

## PRIORITY ORDER (Build Sequence)

### Sprint 1: Core Differentiators (Do These First - 4 hours)
- Step 1: Trust Score Engine (feature 1) - backend service + socket emission
- Step 2: Trust Score UI - animated gauge on admin student cards
- Step 3: Anti-Cheat Detection (feature 4) - browser lockdown utilities
- Step 4: Voice Activity Monitor (feature 7) - Web Audio API integration

### Sprint 2: AI Intelligence Layer (Next - 3 hours)
- Step 5: AI Report Generator (feature 2) - LLM integration
- Step 6: Embed AI summary in PDF reports
- Step 7: Show AI summary in admin violation modal

### Sprint 3: Visual Impact (Final Polish - 3 hours)
- Step 8: Risk Heatmap (feature 3) - admin dashboard view
- Step 9: Post-Exam Analytics (feature 5) - charts page
- Step 10: Integrity Certificate (feature 6) - hash + QR + PDF

### Sprint 4: Demo Prep (Last hour)
- Step 11: Seed realistic demo data (multiple students, varied trust scores)
- Step 12: Rehearse 5-minute demo flow: Login -> Create Exam -> Student Takes Exam -> Admin Watches Heatmap -> Trust Score Drops -> AI Report Generated -> Certificate Issued

---

## DEMO SCRIPT (5 Minutes)

1. OPEN: "SecureGuard Pro is an AI-powered exam proctoring platform" (show student login)
2. SHOW: Admin creates exam with MCQ + Coding sections (15 seconds)
3. SHOW: Student starts exam - liveness check, mobile pairing (30 seconds)
4. SHOW: Split screen - student taking exam + admin heatmap view (30 seconds)
5. TRIGGER: Student looks away -> Trust Score drops from 95 to 72 -> Heatmap cell turns orange (20 seconds)
6. TRIGGER: Tab switch -> Score drops to 58 -> Admin gets real-time alert (15 seconds)
7. SHOW: Admin clicks student -> Live drawer with mobile feed + violations (15 seconds)
8. SHOW: Exam submits -> AI Report generates: "During the exam, Student X exhibited..." (30 seconds)
9. SHOW: PDF report with evidence snapshots + AI summary (20 seconds)
10. SHOW: Integrity Certificate with QR code (15 seconds)
11. SHOW: Analytics dashboard with charts across all students (20 seconds)
12. CLOSE: "Multi-camera, multi-modal, AI-analyzed, certificate-verified proctoring" (10 seconds)

Total: ~4 minutes with buffer

---

## TECH STACK ADDITIONS NEEDED
- recharts or chart.js (for analytics charts)
- AWS Bedrock SDK or Google Generative AI SDK (for AI report)
- qrcode.react (already installed for pairing - reuse for certificates)
- crypto (Node.js built-in for SHA-256 hashing)
- No new infrastructure needed. Everything runs on existing AWS + Express + React stack.
