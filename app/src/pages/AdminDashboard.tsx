import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Shield, Search, Grid3X3, LayoutList, 
  AlertTriangle, Users, Activity, Clock, LogOut,
  Video, MoreVertical, Download, Bell
} from 'lucide-react';
import { cn, getRelativeTime } from '@/lib/utils';
import type { StudentCard, Violation } from '@/types';
import { ViolationModal } from '@/components/modals/ViolationModal';
import { CreateExamModal } from '@/components/modals/CreateExamModal';
import { RiskHeatmap } from '@/components/RiskHeatmap';
import { fetchApi } from '@/lib/api';
import { useSocket } from '@/hooks/useSocket';
import { X } from 'lucide-react';
import { Empty, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty';

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
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'heatmap'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedStudent, setSelectedStudent] = useState<StudentCard | null>(null);
  const [showViolationModal, setShowViolationModal] = useState(false);
  const [showLiveDrawer, setShowLiveDrawer] = useState(false);
  const [showCreateExamModal, setShowCreateExamModal] = useState(false);
  const [notifications] = useState(3);
  const [liveFeeds, setLiveFeeds] = useState<Record<string, string>>({});

  const adminToken = typeof window !== 'undefined' ? localStorage.getItem('adminToken') || undefined : undefined;
  const { socket, connect, disconnect } = useSocket(adminToken);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  useEffect(() => {
    if (!socket) return;
    
    const handleFrame = (data: { sessionId: string; imageBase64: string }) => {
      setLiveFeeds(prev => ({
        ...prev,
        [data.sessionId]: data.imageBase64
      }));
    };

    const handleTrustScoreUpdate = (data: { sessionId: string; score: number }) => {
      setStudents(prev => prev.map(s => 
        s.sessionId === data.sessionId ? { ...s, trustScore: data.score } : s
      ));
    };

    const handleAiSummary = (data: { sessionId: string; aiSummary: string }) => {
      setStudents(prev => prev.map(s => 
        s.sessionId === data.sessionId ? { ...s, aiSummary: data.aiSummary } : s
      ));
    };

    socket.on('admin_mobile_feed_frame', handleFrame);
    socket.on('trust_score_update', handleTrustScoreUpdate);
    socket.on('ai_summary_ready', handleAiSummary);
    
    return () => {
      socket.off('admin_mobile_feed_frame', handleFrame);
      socket.off('trust_score_update', handleTrustScoreUpdate);
      socket.off('ai_summary_ready', handleAiSummary);
    };
  }, [socket]);

  const fetchExams = async () => {
    const examsRes = await fetchApi('/dashboard/admin/exams');
    if (examsRes.success && examsRes.data) {
      setExamConfigs(examsRes.data);
      if (!selectedExamId && examsRes.data.length > 0) {
        setSelectedExamId(examsRes.data[0].id);
      }
    }
  };

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



  const setActionMessage = (message: string | null) => {
    setActionMessage(message);
    setTimeout(() => setActionMessage(null), 3000);
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
    setShowLiveDrawer(true);
  };

  const handleTerminate = async (sessionId: string) => {
    try {
      const res = await fetchApi(`/dashboard/admin/sessions/${sessionId}`, {
        method: 'DELETE',
      });
      if (res?.success) {
        setStudents(prev => prev.filter(s => s.sessionId !== sessionId));
        setViolations(prev => prev.filter(v => v.sessionId !== sessionId));
        setActionMessage(res.message || 'Session terminated successfully');
        setTimeout(() => setActionMessage(null), 4000);
      }
    } catch (err: any) {
      setActionMessage(err?.message || 'Failed to terminate session');
      setTimeout(() => setActionMessage(null), 4000);
    }
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
          
            {/* EXAM DATA TABLE */}
            <section className="mb-5 rounded-2xl border border-cyan/20 bg-cyan/5 p-4 flex flex-col gap-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center justify-between w-full lg:w-auto">
                    <h3 className="font-sora text-base font-semibold text-white">Exam Controls</h3>
                    <button
                      onClick={() => setShowCreateExamModal(true)}
                      className="flex items-center gap-1.5 rounded bg-cyan/20 px-3 py-1.5 text-xs font-medium text-cyan hover:bg-cyan/30 transition-colors ml-4 lg:ml-0"
                    >
                      <Grid3X3 className="h-3.5 w-3.5" />
                      New Exam
                    </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-cyan/10 text-cyan/70 text-xs uppercase bg-cyan/5">
                    <tr>
                      <th className="px-4 py-3 font-medium rounded-tl-lg">Title</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Start Date</th>
                      <th className="px-4 py-3 font-medium">Duration</th>
                      <th className="px-4 py-3 font-medium text-right rounded-tr-lg">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cyan/10">
                    {examConfigs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-white/50">
                          No exams found. Create your first exam above.
                        </td>
                      </tr>
                    ) : (
                      examConfigs.map((exam) => (
                        <tr key={exam.id} className="hover:bg-cyan/5 transition-colors">
                          <td className="px-4 py-3 font-medium text-white">{exam.title}</td>
                          <td className="px-4 py-3">
                            <span
                              className={cn(
                                "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
                                exam.status === 'active'
                                  ? 'bg-rose-500/20 text-rose-400'
                                  : exam.status === 'upcoming'
                                  ? 'bg-blue-500/20 text-blue-400'
                                  : 'bg-emerald-500/20 text-emerald-400'
                              )}
                            >
                              {exam.status.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-white/70">
                            {new Date(exam.startTime).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-white/70">{exam.duration}m</td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => {
                                  setSelectedExamId(exam.id);
                                  setShowCreateExamModal(true);
                                }}
                                className="p-1 hover:text-cyan text-white/50 transition-colors"
                              >
                                Edit
                              </button>
                              <button
                                onClick={async () => {
                                  if (confirm('Delete exam?')) {
                                    try {
                                      await fetchApi(`/api/exam/${exam.id}`, { method: 'DELETE' }); // adminToken not needed
                                      setExamConfigs(prev => prev.filter(e => e.id !== exam.id));
                                    } catch (err) {
                                      console.error('Failed to delete exam', err);
                                    }
                                  }
                                }}
                                className="p-1 hover:text-rose-400 text-white/50 transition-colors"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
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

          {viewMode === 'heatmap' ? (
            <RiskHeatmap 
              students={filteredStudents} 
              onStudentClick={handleStudentClick} 
            />
          ) : viewMode === 'grid' ? (
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
            <div className="flex flex-col items-center justify-center p-8 text-white/50 h-64">
              <Empty className="border-white/10 bg-white/5">
                <EmptyMedia variant="icon">
                  <Users strokeWidth={1} className="h-6 w-6 text-white/50" />
                </EmptyMedia>
                <EmptyTitle className="text-white">No students found</EmptyTitle>
                <EmptyDescription className="text-white/60">
                  Nobody is matching your filters or no one has started the exam yet.
                </EmptyDescription>
              </Empty>
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
            {violations.length === 0 && (
              <Empty className="border-white/10 bg-white/5 py-8">
                <EmptyMedia variant="icon" className="bg-success/10">
                  <Activity strokeWidth={1} className="h-6 w-6 text-success" />
                </EmptyMedia>
                <EmptyTitle className="text-white text-sm">All Clear</EmptyTitle>
                <EmptyDescription className="text-white/60 text-xs">
                  No anomalies detected.
                </EmptyDescription>
              </Empty>
            )}
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

      {/* Side Drawer for Student Live Feed */}
      <AnimatePresence>
        {showLiveDrawer && selectedStudent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="flex h-full w-full max-w-md flex-col bg-navy-900 border-l border-white/10 shadow-2xl"
            >
              {/* Drawer Header */}
              <div className="flex items-center justify-between border-b border-white/10 p-4 bg-navy-800">
                <div className="flex items-center gap-3">
                  <div className="relative h-10 w-10 overflow-hidden rounded-full border border-white/10 bg-navy-800">
                    {selectedStudent.studentAvatar ? (
                      <img
                        src={selectedStudent.studentAvatar}
                        alt="Avatar"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Users strokeWidth={1} className="h-6 w-6 text-white/30" />
                    )}
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">{selectedStudent.studentName}</h2>
                    <p className="text-xs text-text-secondary">{selectedStudent.studentId}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowLiveDrawer(false)}
                  className="rounded-lg p-2 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
                >
                  <X strokeWidth={1} className="h-5 w-5" />
                </button>
              </div>

              {/* Drawer Body */}
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6">
                
                {/* Mobile Feed */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-white flex items-center gap-2">
                      <Video strokeWidth={1} className="h-4 w-4 text-cyan" />
                      Mobile Live Feed
                    </h3>
                    <span className="flex items-center gap-1 text-xs text-violation px-2 py-0.5 bg-violation/10 rounded-full animate-pulse">
                      <span className="h-1.5 w-1.5 rounded-full bg-violation"></span>
                      LIVE
                    </span>
                  </div>
                  <div className="aspect-video w-full rounded-xl overflow-hidden bg-black border border-white/10 flex items-center justify-center">
                    {liveFeeds[selectedStudent.sessionId] ? (
                      <img 
                        src={liveFeeds[selectedStudent.sessionId]} 
                        alt="Mobile Feed" 
                        className="h-full w-full object-cover" 
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-white/30 space-y-2">
                        <Video strokeWidth={1} className="h-8 w-8" />
                        <span className="text-xs">Connecting feed...</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Real-time Violation Badges */}
                <div>
                  <h3 className="text-sm font-medium text-white flex items-center gap-2 mb-3">
                    <AlertTriangle strokeWidth={1} className="h-4 w-4 text-warning" />
                    Recent Violations
                  </h3>
                  <div className="space-y-2">
                    {violations
                      .filter((v) => v.sessionId === selectedStudent.sessionId)
                      .slice(0, 5)
                      .map((v) => (
                        <div key={v.id} className="flex flex-col bg-white/5 border border-white/10 rounded-lg p-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-white">{v.description}</span>
                            <span className={cn(
                              "text-[10px] px-2 py-0.5 rounded-full",
                              v.severity === 'high' ? 'bg-violation/20 text-violation' : 'bg-warning/20 text-warning'
                            )}>
                              {v.severity.toUpperCase()}
                            </span>
                          </div>
                          <span className="text-xs text-text-secondary mt-1">{getRelativeTime(v.timestamp)}</span>
                        </div>
                      ))}
                    {violations.filter((v) => v.sessionId === selectedStudent.sessionId).length === 0 && (
                      <div className="text-xs text-text-secondary text-center py-4 bg-white/5 rounded-lg border border-white/10">
                        No active violations detected.
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* Drawer Footer Actions */}
              <div className="border-t border-white/10 bg-navy-800 p-4 flex gap-3">
                <button
                  onClick={() => setShowViolationModal(true)}
                  className="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
                >
                  Full Report
                </button>
                <button
                  onClick={() => handleTerminate(selectedStudent.sessionId)}
                  className="flex-1 rounded-lg bg-violation/20 border border-violation/30 px-4 py-2 text-sm font-semibold text-violation hover:bg-violation/30 transition-colors"
                >
                  Terminate
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Violation Modal */}
      <ViolationModal
        isOpen={showViolationModal}
        onClose={() => setShowViolationModal(false)}
        student={selectedStudent}
        violations={violations.filter(v => v.sessionId === selectedStudent?.sessionId)}
        onTerminate={handleTerminate}
      />

      <CreateExamModal
        isOpen={showCreateExamModal}
        onClose={() => {
          setShowCreateExamModal(false);
          setSelectedExamId('');
        }}
        examId={selectedExamId}
        onExamCreated={fetchExams}
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
        <div className="flex justify-between items-start">
          <div className="min-w-0 flex-1">
            <h4 className="font-medium text-white truncate">{student.studentName}</h4>
            <p className="text-xs text-text-secondary truncate">{student.studentId}</p>
          </div>
          <div className="flex flex-col items-end shrink-0 ml-2">
            <span className={cn(
              "text-sm font-bold leading-none",
              (student.trustScore ?? 100) >= 80 ? "text-emerald-400" :
              (student.trustScore ?? 100) >= 50 ? "text-warning" : "text-violation"
            )}>
              {Math.round(student.trustScore ?? 100)}%
            </span>
            <span className="text-[9px] text-text-secondary uppercase tracking-wider mt-0.5">Trust</span>
          </div>
        </div>
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
          <h4 className="font-medium text-white truncate">{student.studentName}</h4>
          {student.violationCount > 0 && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-violation/20 text-violation text-xs">
              <AlertTriangle strokeWidth={1} className="h-3 w-3" />
              {student.violationCount}
            </span>
          )}
          <span className={cn(
            "px-1.5 py-0.5 rounded text-[10px] font-medium border uppercase tracking-wide",
            (student.trustScore ?? 100) >= 80 ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
            (student.trustScore ?? 100) >= 50 ? "bg-warning/10 text-warning border-warning/20" : 
            "bg-violation/10 text-violation border-violation/20"
          )}>
            Trust: {Math.round(student.trustScore ?? 100)}%
          </span>
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





