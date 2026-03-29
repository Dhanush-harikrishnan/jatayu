# SecureGuard Pro - Architecture & Database Structure

This document outlines the current data storage strategy, how tables and objects are linked, and important notes for future refactoring or scaling.

## 1. Database Core: AWS DynamoDB
We use DynamoDB as our primary persistent datastore. We currently manage two single-table structures.

### A. `SecureGuardUsers` Table
Stores basic user profiles, authentication secrets, and ephemeral login tokens (OTPs).
- **Partition Key (HASH)**: `email` (String)
- **Attributes**:
  - `name` (String): Full name of the user.
  - `passwordHash` (String): Bycrypt hashed password.
  - `role` (String): Access control role (`'admin'` | `'student'`).
  - `otp` (String) *(Optional)*: Ephemeral code for Magic Links / Password resets.
  - `otpExpiry` (Number) *(Optional)*: Unix timestamp for OTP expiration.

### B. `ProctoringEvents` Table
Stores every piece of telemetry and tracked violation across the system. 
- **Partition Key (HASH)**: `id` (String) - *Currently a uniquely generated compound string (e.g., `<sessionId>_<timestamp>_<random>`)*
- **Attributes**:
  - `SessionId` (String): Auto-generated unique session string when a test starts.
  - `EventTime` (String): ISO-8601 timestamp.
  - `ViolationType` (String): e.g., `'MULTIPLE_FACES'`, `'PHONE_DETECTED'`, `'BOOK_DETECTED'`, etc.
  - `EvidenceKey` (String): The object key reference pointing to the S3 bucket where the image frame is stored.
  - `Metadata` (Stringified JSON, *Optional*): Contains extra Rekognition responses (e.g. Bounding Boxes, Confidence scores).
  - `UserId`, `StudentName`, `ExamId`: Denormalized context attributes pushed down during logging.

> ⚠️ **Technical Debt / Scaling Note**: 
> At present, the Admin Dashboard retrieves "Active Sessions" and "Violations" by executing a `.ScanCommand()` on `ProctoringEvents` (see `dashboardController.ts`). For future optimization, we should either add a **Global Secondary Index (GSI)** to `ProctoringEvents` on `SessionId` (for fast querying) OR create a dedicated `ProctoringSessions` table. 

---

## 2. Object Storage: AWS S3
We use an S3 Bucket (defined in `.env` as `AWS_S3_BUCKET`) to store binary evidence securely.

- **Structure**: Flat structure with keys formatted loosely as `evidence/<session_id>/<timestamp>.jpg` (Refer to `dashboardController.ts` / `correlationEngine.ts` for exact structures).
- **Security Check**: This bucket is entirely **Private**.
- **Access Flow**:
  1. The Frontend detects a violation or the Backend validates a violation frame via AWS Rekognition.
  2. A presigned URL is requested.
  3. The image is uploaded directly to S3.
  4. S3 returns success, and the Node.js backend pushes the S3 `EvidenceKey` to DynamoDB `ProctoringEvents`.
  5. When the Admin Dashboard needs to view the image, it requests a `GetObject` Presigned URL to temporarily unlock the JPG for the React UI.

---

## 3. Real-Time Memory: In-Memory `sessionRegistry`
For real-time Socket.io heartbeats and tracking "Online/Offline" statuses, we use Node memory.

- **Location**: `src/services/sessionRegistry.ts`
- **Data Model**: `Map<string, SessionRecord>`
- **Fields Provided**: `sessionId`, `studentId`, `studentName`, `examId`, `joinTime`, `lastActivity`, `status` (`online`|`away`|`violation`|`offline`).
- **Future Mod**: Since it relies on a local `Map()`, if you scale up the Express app to multiple load-balanced instances, the map will fragment. **You must replace `sessions = new Map()` with a Redis cache cluster** in future multi-server phases.

---

## Roadmap & Future Mod Suggestions
1. **Separation of Concerns**: Migrate active exam sessions from the heavy `ScanCommand()` onto a new `ProctoringSessions` DynamoDB Table (PK: SessionId).
2. **Move In-Memory mapping to Redis**: So multiple backends can correctly process websocket drops without losing track.
3. **S3 Lifecycle Rules**: Ensure you construct a Lifecycle Policy on your S3 Bucket to archive or automatically delete Evidence images after X days to stay within AWS budget.