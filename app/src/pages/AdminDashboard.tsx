import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Shield, Search, Grid3X3, LayoutList, 
  AlertTriangle, Users, Activity, Clock, LogOut,
  Video, MoreVertical, Download, Bell, Mail, CalendarDays, ToggleLeft, ToggleRight, SendHorizontal
} from 'lucide-react';
import { cn, getRelativeTime } from '@/lib/utils';
import type { StudentCard, Violation } from '@/types';
import { ViolationModal } from '@/components/modals/ViolationModal';
import { fetchApi } from '@/lib/api';

// Empty initial states
const mockStudents: StudentCard[] = [];
const mockViolations: Violation[] = [];

interface AdminExamConfig {
  id: string;
  title: string;
  status: 'upcoming' | 'active' | 'completed';
  startTime: string;
  duration: number;
  enabled: boolean;
  requireFullscreen: boolean;
}

export function AdminDashboard() {
  const [students, setStudents] = useState<StudentCard[]>(mockStudents);
  const [violations, setViolations] = useState<Violation[]>(mockViolations);
  const [examConfigs, setExamConfigs] = useState<AdminExamConfig[]>([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [savingExam, setSavingExam] = useState(false);
  const [emailRecipients, setEmailRecipients] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [adminActionMessage, setAdminActionMessage] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedStudent, setSelectedStudent] = useState<StudentCard | null>(null);
  const [showViolationModal, setShowViolationModal] = useState(false);
  const [notifications] = useState(3);

  // Poll real dashboard backend
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [studentsRes, violationsRes, examsRes] = await Promise.all([
          fetchApi('/dashboard/admin/students'),
          fetchApi('/dashboard/admin/violations'),
          fetchApi('/dashboard/admin/exams')
        ]);
        if (studentsRes.success && studentsRes.data) setStudents(studentsRes.data);
        if (violationsRes.success && violationsRes.data) setViolations(violationsRes.data);
        if (examsRes.success && examsRes.data) {
          setExamConfigs(examsRes.data);
          if (!selectedExamId && examsRes.data.length > 0) {
            setSelectedExamId(examsRes.data[0].id);
          }
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Data fetch error';
        if (message.toLowerCase().includes('forbidden') || message.toLowerCase().includes('invalid or expired token')) {
          localStorage.removeItem('adminToken');
          window.location.href = '/admin/login';
          return;
        }
        console.error('Data fetch error:', e);
      }
    };
    
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [selectedExamId]);

  const selectedExam = examConfigs.find(exam => exam.id === selectedExamId);

  const setActionMessage = (message: string) => {
    setAdminActionMessage(message);
    setTimeout(() => setAdminActionMessage(null), 3000);
  };

  const updateExamSettings = async (payload: Partial<Pick<AdminExamConfig, 'enabled' | 'duration' | 'startTime' | 'requireFullscreen'>>) => {
    if (!selectedExam) return;
    setSavingExam(true);
    try {
      const res = await fetchApi(`/dashboard/admin/exams/${selectedExam.id}/settings`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      if (res?.success) {
        const updated = res.data as AdminExamConfig;
        setExamConfigs(prev => prev.map(exam => (exam.id === updated.id ? updated : exam)));
        setActionMessage('Exam settings saved');
      }
    } catch (error: any) {
      setActionMessage(error?.message || 'Failed to save exam settings');
    } finally {
      setSavingExam(false);
    }
  };

  const handleSendExamNotification = async () => {
    if (!selectedExam) return;
    const recipients = emailRecipients
      .split(',')
      .map(v => v.trim())
      .filter(Boolean);

    if (recipients.length === 0) {
      setActionMessage('Enter at least one recipient email');
      return;
    }

    try {
      const res = await fetchApi(`/dashboard/admin/exams/${selectedExam.id}/notify`, {
        method: 'POST',
        body: JSON.stringify({ recipients, message: emailMessage.trim() || undefined }),
      });

      if (res?.success) {
        setActionMessage(`Email sent to ${res.sentTo || recipients.length} recipient(s)`);
      }
    } catch (error: any) {
      setActionMessage(error?.message || 'Failed to send notification email');
    }
  };

  const filteredStudents = students.filter(s => {
    const matchesSearch = s.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         s.studentId.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const gridColumns = Math.max(1, Math.ceil(Math.sqrt(filteredStudents.length)));

  const stats = {
    total: students.length,
    online: students.filter(s => s.status === 'online').length,
    away: students.filter(s => s.status === 'away').length,
    violations: students.filter(s => s.status === 'violation').length,
    offline: students.filter(s => s.status === 'offline').length,
    totalViolations: violations.length,
  };

  const handleStudentClick = (student: StudentCard) => {
    setSelectedStudent(student);
    setShowViolationModal(true);
  };

  const handleTerminate = (studentId: string) => {
    setStudents(prev => prev.map(s => 
      s.studentId === studentId ? { ...s, status: 'offline' } : s
    ));
    setShowViolationModal(false);
  };

  return (
    <div className="min-h-screen bg-navy-900">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-navy-900/90 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center justify-between px-4 py-3 lg:px-6">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan/10">
              <Shield strokeWidth={1} className="h-6 w-6 text-cyan" />
            </div>
            <div>
              <h1 className="font-sora text-lg font-bold text-white">SecureGuard Pro</h1>
              <p className="text-xs text-text-secondary">Admin Command Center</p>
            </div>
          </div>

          {/* Center Stats */}
          <div className="hidden lg:flex items-center gap-6">
            <StatBadge label="Active" value={stats.online} color="success" />
            <StatBadge label="Away" value={stats.away} color="warning" />
            <StatBadge label="Violations" value={stats.violations} color="violation" />
            <div className="h-8 w-px bg-white/10" />
            <div className="text-sm">
              <span className="text-text-secondary">Total: </span>
              <span className="text-white font-medium">{stats.total}</span>
            </div>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-3">
            <button className="relative flex h-10 w-10 items-center justify-center rounded-lg bg-white/5 text-white/60 hover:bg-white/10 transition-colors">
              <Bell strokeWidth={1} className="h-5 w-5" />
              {notifications > 0 && (
                <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-violation text-xs text-white flex items-center justify-center">
                  {notifications}
                </span>
              )}
            </button>
            <button 
              onClick={() => {
                if (window.confirm("Are you sure you want to log out?")) {
                  window.location.href = '/admin/login';
                }
              }}
              title="Log Out"
              className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/5 text-white/60 hover:bg-white/10 transition-colors"
            >
              <LogOut strokeWidth={1} className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Sub Header */}
      <div className="border-b border-white/5 bg-navy-800/50">
        <div className="flex flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-6">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search strokeWidth={1} className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search students..."
              className="input-dark w-full pl-12"
            />
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input-dark py-2 text-sm"
            >
              <option value="all">All Status</option>
              <option value="online">Online</option>
              <option value="away">Away</option>
              <option value="violation">Violation</option>
              <option value="offline">Offline</option>
            </select>

            <div className="flex items-center gap-1 rounded-lg bg-white/5 p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded transition-colors',
                  viewMode === 'grid' ? 'bg-cyan/20 text-cyan' : 'text-white/40 hover:text-white'
                )}
              >
                <Grid3X3 strokeWidth={1} className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded transition-colors',
                  viewMode === 'list' ? 'bg-cyan/20 text-cyan' : 'text-white/40 hover:text-white'
                )}
              >
                <LayoutList strokeWidth={1} className="h-4 w-4" />
              </button>
            </div>

            <button className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 text-white/60 hover:bg-white/10 transition-colors">
              <Download strokeWidth={1} className="h-4 w-4" />
              <span className="hidden sm:inline text-sm">Export</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex h-[calc(100vh-140px)]">
        {/* Student Grid/List */}
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          <section className="mb-5 rounded-2xl border border-cyan/20 bg-cyan/5 p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="font-sora text-base font-semibold text-white">Exam Controls</h3>
                <p className="text-xs text-text-secondary">Enable tests, set timing, require fullscreen, and notify students</p>
              </div>
              {adminActionMessage && (
                <div className="rounded-lg border border-cyan/30 bg-cyan/10 px-3 py-2 text-xs text-cyan">
                  {adminActionMessage}
                </div>
              )}
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <div className="space-y-3 rounded-xl border border-white/10 bg-navy-800/40 p-3">
                <label className="text-xs text-text-secondary">Select Exam</label>
                <select
                  value={selectedExamId}
                  onChange={(e) => setSelectedExamId(e.target.value)}
                  className="input-dark w-full py-2 text-sm"
                >
                  {examConfigs.map(exam => (
                    <option key={exam.id} value={exam.id}>{exam.id} - {exam.title}</option>
                  ))}
                </select>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button
                    onClick={() => selectedExam && updateExamSettings({ enabled: !selectedExam.enabled })}
                    disabled={!selectedExam || savingExam}
                    className="flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white hover:bg-white/10 disabled:opacity-50"
                  >
                    {selectedExam?.enabled ? <ToggleRight strokeWidth={1} className="h-4 w-4 text-white/60" /> : <ToggleLeft strokeWidth={1} className="h-4 w-4 text-warning" />}
                    {selectedExam?.enabled ? 'Disable Test' : 'Enable Test'}
                  </button>
                  <button
                    onClick={() => selectedExam && updateExamSettings({ requireFullscreen: !selectedExam.requireFullscreen })}
                    disabled={!selectedExam || savingExam}
                    className="flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white hover:bg-white/10 disabled:opacity-50"
                  >
                    <CalendarDays strokeWidth={1} className="h-4 w-4 text-cyan" />
                    {selectedExam?.requireFullscreen ? 'Fullscreen: ON' : 'Fullscreen: OFF'}
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div>
                    <label className="text-xs text-text-secondary">Duration (minutes)</label>
                    <input
                      type="number"
                      min={10}
                      max={480}
                      value={selectedExam?.duration || ''}
                      onChange={(e) => {
                        const value = Number(e.target.value || 0);
                        setExamConfigs(prev => prev.map(exam => (
                          exam.id === selectedExamId ? { ...exam, duration: value } : exam
                        )));
                      }}
                      onBlur={() => selectedExam && updateExamSettings({ duration: selectedExam.duration })}
                      className="input-dark mt-1 w-full py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-text-secondary">Start Time</label>
                    <input
                      type="datetime-local"
                      value={selectedExam ? new Date(selectedExam.startTime).toISOString().slice(0, 16) : ''}
                      onChange={(e) => {
                        if (!e.target.value) return;
                        const parsed = new Date(e.target.value);
                        if (Number.isNaN(parsed.getTime())) return;
                        const iso = parsed.toISOString();
                        setExamConfigs(prev => prev.map(exam => (
                          exam.id === selectedExamId ? { ...exam, startTime: iso } : exam
                        )));
                      }}
                      onBlur={() => selectedExam && updateExamSettings({ startTime: selectedExam.startTime })}
                      className="input-dark mt-1 w-full py-2 text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3 rounded-xl border border-white/10 bg-navy-800/40 p-3">
                <label className="text-xs text-text-secondary">Send Exam Email Notification</label>
                <div className="relative">
                  <Mail strokeWidth={1} className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                  <input
                    type="text"
                    value={emailRecipients}
                    onChange={(e) => setEmailRecipients(e.target.value)}
                    placeholder="student1@college.edu, student2@college.edu"
                    className="input-dark w-full py-2 pl-10 text-sm"
                  />
                </div>
                <textarea
                  value={emailMessage}
                  onChange={(e) => setEmailMessage(e.target.value)}
                  placeholder="Optional custom message"
                  rows={4}
                  className="input-dark w-full resize-none py-2 text-sm"
                />
                <button
                  onClick={handleSendExamNotification}
                  disabled={!selectedExam}
                  className="flex items-center gap-2 rounded-lg bg-cyan px-4 py-2 text-sm font-semibold text-navy-900 hover:bg-cyan-light disabled:opacity-60"
                >
                  <SendHorizontal strokeWidth={1} className="h-4 w-4" />
                  Send Email
                </button>
              </div>
            </div>
          </section>

          <section className="mb-5 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-sora text-base font-semibold text-white">Attended Students</h3>
              <span className="text-xs text-text-secondary">{students.length} total</span>
            </div>

            {students.length === 0 ? (
              <p className="text-sm text-text-secondary">No attended students yet.</p>
            ) : (
              <div className="max-h-48 overflow-auto rounded-lg border border-white/10">
                <table className="w-full text-left text-sm">
                  <thead className="bg-white/5 text-xs text-text-secondary">
                    <tr>
                      <th className="px-3 py-2">Student</th>
                      <th className="px-3 py-2">Exam</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Last Activity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((student) => (
                      <tr key={student.sessionId} className="border-t border-white/5">
                        <td className="px-3 py-2 text-white">{student.studentName}</td>
                        <td className="px-3 py-2 text-text-secondary">{student.examTitle}</td>
                        <td className="px-3 py-2">
                          <span className={cn(
                            'rounded-full px-2 py-0.5 text-xs',
                            student.status === 'online' && 'bg-white/20/20 text-white/60',
                            student.status === 'violation' && 'bg-violation/20 text-violation',
                            student.status === 'away' && 'bg-warning/20 text-warning',
                            student.status === 'offline' && 'bg-white/10 text-white/60'
                          )}>
                            {student.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-text-secondary">{getRelativeTime(student.lastActivity)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {viewMode === 'grid' ? (
            <div
              className="grid gap-1"
              style={{ gridTemplateColumns: `repeat(${gridColumns}, minmax(250px, 1fr))` }}
            >
              {filteredStudents.map((student) => (
                <StudentGridCard
                  key={student.sessionId}
                  student={student}
                  onClick={() => handleStudentClick(student)}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredStudents.map((student) => (
                <StudentListRow
                  key={student.sessionId}
                  student={student}
                  onClick={() => handleStudentClick(student)}
                />
              ))}
            </div>
          )}

          {filteredStudents.length === 0 && (
            <div className="flex flex-col items-center justify-center h-64 text-text-secondary">
              <Users strokeWidth={1} className="h-12 w-12 mb-4 opacity-30" />
              <p>No students found</p>
            </div>
          )}
        </main>

        {/* Right Sidebar - Violation Timeline */}
        <aside className="hidden xl:block w-80 border-l border-white/5 bg-navy-800/30 overflow-auto">
          <div className="p-4 border-b border-white/5">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-white flex items-center gap-2">
                <Activity strokeWidth={1} className="h-4 w-4 text-cyan" />
                Violation Timeline
              </h3>
              <span className="text-xs text-text-secondary">{violations.length} events</span>
            </div>
          </div>

          <div className="p-4 space-y-3">
            {violations.map((violation, index) => {
              const student = students.find(s => s.sessionId === violation.sessionId);
              return (
                <motion.div
                  key={violation.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  onClick={() => student && handleStudentClick(student)}
                  className={cn(
                    'p-3 rounded-xl cursor-pointer transition-all',
                    violation.severity === 'high' 
                      ? 'bg-violation/10 border border-violation/30 hover:bg-violation/20' 
                      : 'bg-white/5 border border-white/10 hover:bg-white/10'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      'h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0',
                      violation.severity === 'high' ? 'bg-violation/20' : 'bg-warning/20'
                    )}>
                      <AlertTriangle strokeWidth={1} className={cn(
                        'h-4 w-4',
                        violation.severity === 'high' ? 'text-violation' : 'text-warning'
                      )} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {student?.studentName || 'Unknown'}
                      </p>
                      <p className="text-xs text-text-secondary mt-0.5">
                        {violation.description}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={cn(
                          'text-xs px-2 py-0.5 rounded-full',
                          violation.severity === 'high' 
                            ? 'bg-violation/20 text-violation' 
                            : 'bg-warning/20 text-warning'
                        )}>
                          {violation.severity}
                        </span>
                        <span className="text-xs text-text-secondary">
                          {getRelativeTime(violation.timestamp)}
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Quick Stats */}
          <div className="p-4 border-t border-white/5 mt-auto">
            <h4 className="text-sm font-medium text-white mb-3">Session Overview</h4>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Avg. Session Time</span>
                <span className="text-white">42m 15s</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Anomaly Rate</span>
                <span className="text-warning">8.3%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Detection Latency</span>
                <span className="text-white/60">&lt; 800ms</span>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Violation Modal */}
      <ViolationModal
        isOpen={showViolationModal}
        onClose={() => setShowViolationModal(false)}
        student={selectedStudent}
        violations={violations.filter(v => v.sessionId === selectedStudent?.sessionId)}
        onTerminate={handleTerminate}
      />
    </div>
  );
}

interface StatBadgeProps {
  label: string;
  value: number;
  color: 'success' | 'warning' | 'violation';
}

function StatBadge({ label, value, color }: StatBadgeProps) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn(
        'h-2 w-2 rounded-full',
        color === 'success' && 'bg-white/20',
        color === 'warning' && 'bg-warning',
        color === 'violation' && 'bg-violation'
      )} />
      <span className="text-sm text-text-secondary">{label}:</span>
      <span className="text-sm font-medium text-white">{value}</span>
    </div>
  );
}

interface StudentGridCardProps {
  student: StudentCard;
  onClick: () => void;
}

function StudentGridCard({ student, onClick }: StudentGridCardProps) {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      onClick={onClick}
      className={cn(
        'glass-card overflow-hidden cursor-pointer transition-all',
        student.status === 'violation' && 'border-violation/50 animate-violation-pulse',
        student.status === 'away' && 'border-warning/30'
      )}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video bg-navy-800">
        {student.studentAvatar ? (
          <img
            src={student.studentAvatar}
            alt={student.studentName}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Users strokeWidth={1} className="h-12 w-12 text-white/20" />
          </div>
        )}
        
        {/* Status Overlay */}
        <div className="absolute top-2 left-2 flex items-center gap-2">
          <span className={cn(
            'h-2.5 w-2.5 rounded-full',
            student.status === 'online' && 'bg-white/20 animate-pulse',
            student.status === 'away' && 'bg-warning',
            student.status === 'violation' && 'bg-violation animate-pulse',
            student.status === 'offline' && 'bg-white/30'
          )} />
          <span className="text-xs text-white bg-black/60 px-2 py-0.5 rounded">
            {student.status}
          </span>
        </div>

        {/* Violation Badge */}
        {student.violationCount > 0 && (
          <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded bg-violation/90 text-white text-xs">
            <AlertTriangle strokeWidth={1} className="h-3 w-3" />
            {student.violationCount}
          </div>
        )}

        {/* Live Indicator */}
        {student.status === 'online' && (
          <div className="absolute bottom-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded bg-violation/80 text-white text-xs">
            <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
            LIVE
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <h4 className="font-medium text-white truncate">{student.studentName}</h4>
        <p className="text-xs text-text-secondary">{student.studentId}</p>
        <div className="flex items-center justify-between mt-2 text-xs text-text-secondary">
          <span>{getRelativeTime(student.joinTime)}</span>
          <span className="flex items-center gap-1">
            <Clock strokeWidth={1} className="h-3 w-3" />
            {getRelativeTime(student.lastActivity)}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

interface StudentListRowProps {
  student: StudentCard;
  onClick: () => void;
}

function StudentListRow({ student, onClick }: StudentListRowProps) {
  return (
    <motion.div
      whileHover={{ x: 4 }}
      onClick={onClick}
      className={cn(
        'flex items-center gap-4 p-3 rounded-xl bg-white/5 border border-white/10 cursor-pointer transition-all',
        student.status === 'violation' && 'border-violation/50 bg-violation/5'
      )}
    >
      {/* Avatar */}
      <div className="relative h-12 w-12 rounded-full overflow-hidden bg-navy-800 flex-shrink-0">
        {student.studentAvatar ? (
          <img
            src={student.studentAvatar}
            alt={student.studentName}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Users strokeWidth={1} className="h-6 w-6 text-white/20" />
          </div>
        )}
        <span className={cn(
          'absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-navy-900',
          student.status === 'online' && 'bg-white/20',
          student.status === 'away' && 'bg-warning',
          student.status === 'violation' && 'bg-violation',
          student.status === 'offline' && 'bg-white/30'
        )} />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="font-medium text-white">{student.studentName}</h4>
          {student.violationCount > 0 && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-violation/20 text-violation text-xs">
              <AlertTriangle strokeWidth={1} className="h-3 w-3" />
              {student.violationCount}
            </span>
          )}
        </div>
        <p className="text-sm text-text-secondary">{student.studentId}</p>
      </div>

      {/* Status */}
      <div className="hidden sm:block">
        <span className={cn(
          'px-3 py-1 rounded-full text-xs font-medium',
          student.status === 'online' && 'bg-white/20/20 text-white/60',
          student.status === 'away' && 'bg-warning/20 text-warning',
          student.status === 'violation' && 'bg-violation/20 text-violation',
          student.status === 'offline' && 'bg-white/10 text-white/60'
        )}>
          {student.status}
        </span>
      </div>

      {/* Time */}
      <div className="hidden md:block text-sm text-text-secondary">
        {getRelativeTime(student.joinTime)}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button className="h-8 w-8 rounded-lg bg-white/5 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors">
          <Video strokeWidth={1} className="h-4 w-4" />
        </button>
        <button className="h-8 w-8 rounded-lg bg-white/5 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors">
          <MoreVertical strokeWidth={1} className="h-4 w-4" />
        </button>
      </div>
    </motion.div>
  );
}
