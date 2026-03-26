type SessionStatus = 'online' | 'away' | 'violation' | 'offline';

export type SessionRecord = {
  sessionId: string;
  studentId: string;
  studentName: string;
  examId: string;
  joinTime: string;
  lastActivity: string;
  status: SessionStatus;
};

const sessions = new Map<string, SessionRecord>();

export const sessionRegistry = {
  upsert(input: {
    sessionId: string;
    studentId: string;
    studentName: string;
    examId: string;
    status?: SessionStatus;
  }) {
    const nowIso = new Date().toISOString();
    const existing = sessions.get(input.sessionId);

    if (!existing) {
      sessions.set(input.sessionId, {
        sessionId: input.sessionId,
        studentId: input.studentId,
        studentName: input.studentName,
        examId: input.examId,
        joinTime: nowIso,
        lastActivity: nowIso,
        status: input.status || 'online',
      });
      return;
    }

    sessions.set(input.sessionId, {
      ...existing,
      studentId: input.studentId,
      studentName: input.studentName,
      examId: input.examId,
      status: input.status || existing.status,
      lastActivity: nowIso,
    });
  },

  touch(sessionId: string, status?: SessionStatus) {
    const existing = sessions.get(sessionId);
    if (!existing) return;

    sessions.set(sessionId, {
      ...existing,
      lastActivity: new Date().toISOString(),
      status: status || existing.status,
    });
  },

  list(): SessionRecord[] {
    return Array.from(sessions.values());
  },
};
