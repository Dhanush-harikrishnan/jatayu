# 1. ACTIVE MISSION — Dynamic Exam Management System
- **Current State (70% Built):**
  - Exams are hardcoded in-memory `examConfigs` Map inside `dashboardController.ts` (7 static exams).
  - Questions are hardcoded per-exam in `QUESTION_BANK` inside `LiveProctoring.tsx` (MCQ only).
  - Admin can toggle enable/disable, set duration/startTime, and create new exams via `CreateExamModal` — but all stored in volatile server memory (lost on restart).
  - No question types beyond MCQ. No coding editor. No aptitude/logical reasoning sections.

- **Goal:** Persistent, dynamic exam CRUD with DynamoDB. Multi-section exams (Coding, Aptitude, Logical Reasoning). Admin scheduling UI with date/time picker. Student-facing dynamic question rendering.

---

## Build Plan — 18 Steps

### Phase A — DynamoDB Exam Persistence (Steps 1–4)
1. **New DynamoDB Table: `SecureGuardExams`** — PK: `examId` (S). Attributes: `title`, `description`, `duration` (N, minutes), `startTime` (S, ISO), `endTime` (S, ISO), `enabled` (BOOL), `requireFullscreen` (BOOL), `sections` (L — list of section objects), `createdBy` (S), `createdAt` (S), `updatedAt` (S). Add a GSI on `enabled` + `startTime` for efficient student queries. Document in `DATABASE_STRUCTURE.md`.
2. **`awsService.ts` — Exam CRUD Methods** — Add `createExam`, `getExam`, `updateExam`, `deleteExam`, `listExams`, `listActiveExams` (query GSI where enabled=true and now is between startTime and endTime). All use DynamoDB SDK v3 with proper marshalling.
3. **Migrate `dashboardController.ts`** — Remove the in-memory `examConfigs` Map. Rewrite `getAdminExams`, `getStudentExams`, `createCustomExam`, `updateAdminExamSettings` to call the new `awsService` exam CRUD methods. The `resolveExamStatus()` helper stays pure.
4. **Migrate `examRoute.ts`** — Add `DELETE /:examId` route. Add `GET /:examId` route for fetching a single exam. Wire to new controller functions.

### Phase B — Question Bank with Multi-Type Support (Steps 5–9)
5. **New DynamoDB Table: `SecureGuardQuestions`** — PK: `questionId` (S). Attributes: `examId` (S, GSI), `sectionType` (S — `MCQ` | `CODING` | `APTITUDE` | `LOGICAL`), `order` (N), `text` (S), `options` (L, for MCQ/Aptitude/Logical), `correctAnswer` (N or S), `difficulty` (S — `easy` | `medium` | `hard`), `points` (N), `codingConfig` (M — `{ language, starterCode, testCases, timeLimit }` for coding questions). Add GSI on `examId` for batch fetch. Document in `DATABASE_STRUCTURE.md`.
6. **`awsService.ts` — Question CRUD** — Add `createQuestion`, `batchCreateQuestions`, `getQuestionsByExamId`, `updateQuestion`, `deleteQuestion`. For `getQuestionsByExamId`, query the GSI and sort by `order`.
7. **`questionController.ts` [NEW]** — `POST /api/questions/:examId` (bulk create), `GET /api/questions/:examId` (list by exam), `PUT /api/questions/:questionId`, `DELETE /api/questions/:questionId`. Admin-only for create/update/delete; student-authenticated for GET (strip `correctAnswer` from response).
8. **`questionRoute.ts` [NEW]** — Wire the controller. Register in `app.ts` under `/api/questions`.
9. **Remove Hardcoded Questions** — Delete the `QUESTION_BANK` object from `LiveProctoring.tsx`. Instead, fetch questions dynamically from `GET /api/questions/:examId` on component mount.

### Phase C — Admin Exam Builder UI (Steps 10–13)
10. **Upgrade `CreateExamModal.tsx`** — Transform into a multi-step wizard:
    - Step 1: Exam metadata (title, description, category tag).
    - Step 2: Schedule (date picker for start/end, duration slider, timezone display).
    - Step 3: Settings (fullscreen toggle, proctoring level, max attempts).
    - Step 4: Sections — add section cards (MCQ, Coding, Aptitude, Logical). Each section is independently configurable with question count, time allocation, points.
    - On submit, call `POST /api/dashboard/admin/exams` then per-section `POST /api/questions/:examId` with the question array.
11. **Admin Question Editor Panel** — New component `QuestionEditor.tsx` embedded inside the CreateExamModal Step 4. Per question type:
    - **MCQ / Aptitude / Logical:** Text, 4 options, correct answer radio, difficulty dropdown.
    - **Coding:** Question text, language selector (Python/JS/Java/C++), starter code textarea, test cases array (input/expectedOutput pairs), time limit.
    Add bulk import via JSON paste.
12. **Admin Exam List View** — In `AdminDashboard.tsx`, replace the simple select dropdown with a sortable/filterable exam table. Columns: Title, Status (badge), Start Date, Duration, Sections, Actions (Edit/Delete/Duplicate). Click row → opens edit modal.
13. **Admin Date/Time Scheduling** — Use Radix UI `Popover` + a lightweight date picker (or native `datetime-local` inputs already present). Add recurrence option (one-time / weekly). Show countdown-to-start on active exam cards.

### Phase D — Student Exam Experience (Steps 14–17)
14. **Dynamic `LiveProctoring.tsx` Overhaul** — On mount, fetch exam data from `GET /api/exam/:examId` and questions from `GET /api/questions/:examId`. Group questions by `sectionType`. Render a section sidebar/nav: student can switch between Aptitude, Logical, Coding sections. Timer is per-exam (not per-section).
15. **Coding Section Renderer [NEW]** — Component `CodingQuestion.tsx`. Embed a Monaco Editor (via `@monaco-editor/react`) with syntax highlighting. Show starter code, language badge, and test case panel. On "Run Tests" → evaluate locally via `Function()` for JS or display "submitted for evaluation" placeholder for other languages. Store user code in exam answers state.
16. **Aptitude & Logical Renderer** — Reuse the MCQ component but with section-specific styling. Aptitude: quantitative/data-interpretation UI with optional attached images. Logical: pattern-matching, series completion, arrangement questions. Both are still option-based but visually distinguished with section color coding and icons.
17. **Student Dashboard Exam Cards** — Update `StudentDashboard.tsx` exam cards to show section breakdown (e.g., "MCQ: 20 | Coding: 5 | Aptitude: 15 | Logical: 10"). Show difficulty distribution bar. Show "Starts in X hours" countdown for upcoming exams instead of raw ISO date.

### Phase E — Submission & Verification (Step 18)
18. **Answer Persistence & Scoring** — On exam submit (`POST /api/exam/:examId/submit`), save answers to a new DynamoDB table `SecureGuardSubmissions` (PK: `submissionId`, attributes: `sessionId`, `examId`, `studentId`, `answers` (M), `score` (N), `submittedAt` (S), `autoSubmitted` (BOOL)). Backend auto-grades MCQ/Aptitude/Logical sections. Coding section stores code; grading is deferred. Include score summary in the PDF report.
