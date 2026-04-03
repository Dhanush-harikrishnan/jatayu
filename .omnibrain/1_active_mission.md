# Active Mission - Fix Exam Creation Pipeline and Harden Dynamic Exam System

## Root Cause Analysis

### BUG 1: 400 Bad Request on POST /dashboard/admin/exams
- File: dashboardController.ts line 449
- Cause: Backend destructures `req.body.id` but frontend sends `req.body.examId`
- The controller checks `if (!id)` which is always true since the key is `examId`
- Fix: Accept both `id` and `examId` from body

### BUG 2: LiveProctoring questions never load (double-parse)
- File: LiveProctoring.tsx line 41-42
- Cause: `fetchApi()` already returns parsed JSON via `response.json()`.
  Code then calls `.then(res => res.json())` on the already-parsed object.
  `.json()` is not a function on a plain object, so it throws.
- Fix: Remove the `.then(res => res.json())` chain

### BUG 3: Starter code placeholder shows Python for all languages
- File: QuestionEditor.tsx line 160
- Cause: Hardcoded placeholder `def main():...` regardless of language selection
- Fix: Make placeholder dynamic based on codingConfig.language

### BUG 4: Default points inverted (MCQ=1, no guidance)
- File: CreateExamModal.tsx line 63
- Cause: All question types default to `points: 1` with no type-specific defaults
- Fix: MCQ/Aptitude/Logical default to 2 points, Coding defaults to 10 points

### BUG 5: Empty test cases on coding questions
- File: CreateExamModal.tsx line 69
- Cause: Default test case is `{ input: '', expectedOutput: '' }` with no validation
- Fix: Pre-populate with example data, validate non-empty on submit

### BUG 6: No submit-time validation for question content
- File: CreateExamModal.tsx handleSubmit
- Cause: Questions with empty text, empty options, or invalid correctAnswer index can be saved
- Fix: Validate all fields before API call, show per-question error messages

---

## Build Plan - 12 Steps

### Phase A: Fix Critical Bugs (Steps 1-3) - ✅ COMPLETED

✅ Step 1: dashboardController.ts - Fix createCustomExam
- Accept both `id` and `examId` from req.body
- Auto-compute endTime = startTime + duration if endTime is missing
- Clamp duration to 10-480 range

✅ Step 2: LiveProctoring.tsx - Fix double-parse
- Change fetchApi call to use returned JSON directly
- Remove the `.then(res => res.json())` chain
- Handle empty/error responses gracefully

✅ Step 3: CreateExamModal.tsx - Fix payload key
- Ensure POST body sends `id: examId` alongside `examId` for backward compat

### Phase B: Validation and Smart Defaults (Steps 4-7) - ✅ COMPLETED

✅ Step 4: QuestionEditor.tsx - Dynamic starter code placeholder
- Switch placeholder based on selected language
- JS: `function main() { }`, Python: `def main():`, Java: `public static void main`, C++: `int main() { }`
- Auto-fill starter code template when language changes and code is empty

✅ Step 5: QuestionEditor.tsx - Smart point defaults per type
- When sectionType changes, auto-set: MCQ=2, Aptitude=3, Logical=3, Coding=10
- Cap input between 1-100

✅ Step 6: QuestionEditor.tsx - Better default test case
- Pre-populate first test case with `{ input: '5', expectedOutput: '25' }`
- Show helper text explaining test case format

✅ Step 7: CreateExamModal.tsx - Submit-time validation
- Every question must have non-empty text
- MCQ/Aptitude/Logical: at least 2 non-empty options, correctAnswer within bounds
- Coding: at least 1 test case with non-empty input AND expectedOutput
- Coding: warn if starter code syntax mismatches language (def in JS, function in Python)
- Points must be 1-100 per question
- Show inline per-question error badges with clear messages

### Phase C: Backend Hardening (Steps 8-10)

Step 8: dashboardController.ts - Server-side validation
- Validate sections array structure if provided
- Validate startTime is a parseable ISO string
- Auto-compute endTime if missing
- Reject if totalQuestions is negative

Step 9: questionController.ts - Validate batch questions
- Each question needs examId, sectionType, non-empty text
- Coding questions need codingConfig with language and at least 1 testCase
- Return per-question errors in response body

Step 10: awsService.ts - Guard createExam
- Throw early if examId is falsy
- Ensure enabledStatus stringification is consistent

### Phase D: Student Experience Polish (Steps 11-12)

Step 11: LiveProctoring.tsx - Render by section type
- After loading questions from API, group into sections
- MCQ/Aptitude/Logical render with radio buttons
- Coding renders with textarea code editor
- Section tabs/navigation sidebar

Step 12: StudentDashboard.tsx - Show section breakdown on exam cards
- Display section badges: MCQ: 20, Coding: 5, etc.
- Show difficulty distribution if available
