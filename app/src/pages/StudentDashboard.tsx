import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Calendar, Clock, AlertCircle, CheckCircle, 
  ChevronRight, BookOpen, Shield, LogOut, User,
  PlayCircle, Timer
} from 'lucide-react';
import { cn, formatDateTime, formatDuration } from '@/lib/utils';
import type { Exam } from '@/types';
import { fetchApi } from '@/lib/api';
import { Empty, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Initial empty state for exams
const mockExams: Exam[] = [];


const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: 'easeOut' as const,
    },
  },
};

export function StudentDashboard() {
  const [exams, setExams] = useState<Exam[]>(mockExams);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadExams = () => {
    setLoading(true);
    setError(null);
    fetchApi('/dashboard/student/exams').then(res => {
      if (res.success && res.data) {
        setExams(res.data);
      } else {
        setError('Failed to load exams.');
      }
    }).catch(() => {
      setError('Network error tracking exams.');
    }).finally(() => {
      setLoading(false);
    });
  };

  useEffect(() => {
    loadExams();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const upcomingExams = exams.filter(e => e.status === 'upcoming');
  const activeExams = exams.filter(e => e.status === 'active' && e.enabled !== false);
  const completedExams = exams.filter(e => e.status === 'completed');

  const getStatusBadge = (status: Exam['status']) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-xs font-medium text-success border border-success/20">
            <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
            Live Now
          </span>
        );
      case 'upcoming':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100/50 px-3 py-1 text-xs font-medium text-blue-600 border border-blue-600/20">
            <Calendar strokeWidth={1} className="h-3 w-3" />
            Upcoming
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500 border border-slate-200">
            <CheckCircle strokeWidth={1} className="h-3 w-3" />
            Completed
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-slate-100 bg-slate-50/80 backdrop-blur-xl">
        <div className="flex items-center justify-between px-4 py-4 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100/50">
              <Shield strokeWidth={1} className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h1 className="font-sora text-lg font-bold text-slate-900">SecureGuard</h1>
              <p className="text-xs text-slate-500">Student Portal</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden text-right md:block">
              <p className="text-sm font-medium text-slate-900">John Doe</p>
              <p className="text-xs text-slate-500">Student ID: STU-2024-001</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100/50">
              <User strokeWidth={1} className="h-5 w-5 text-blue-600" />
            </div>
            <button 
              onClick={() => window.location.href = '/login'}
              className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-white hover:text-slate-900 transition-colors"
            >
              <LogOut strokeWidth={1} className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-4 py-8 lg:px-8">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="mx-auto max-w-6xl space-y-8"
        >
          {/* Welcome Section */}
          <motion.div variants={itemVariants} className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="font-sora text-3xl font-bold text-slate-900">
                Welcome back, John!
              </h2>
              <p className="mt-1 text-slate-500">
                You have {activeExams.length} active and {upcomingExams.length} upcoming exams
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 border border-slate-200">
              <Clock strokeWidth={1} className="h-5 w-5 text-blue-600" />
              <span className="font-mono text-sm text-slate-900">
                {currentTime.toLocaleTimeString('en-US', { hour12: false })}
              </span>
              <span className="text-slate-900/30">|</span>
              <span className="text-sm text-slate-500">
                {currentTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </span>
            </div>
          </motion.div>

          {/* Stats Cards */}
          <motion.div variants={itemVariants} className="grid gap-4 md:grid-cols-3">
            <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Active Exams</p>
                  <p className="mt-1 font-sora text-3xl font-bold text-success">{activeExams.length}</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success/10">
                  <PlayCircle strokeWidth={1} className="h-6 w-6 text-success" />
                </div>
              </div>
            </div>
            <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Upcoming</p>
                  <p className="mt-1 font-sora text-3xl font-bold text-blue-600">{upcomingExams.length}</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100/50">
                  <Calendar strokeWidth={1} className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </div>
            <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Completed</p>
                  <p className="mt-1 font-sora text-3xl font-bold text-slate-500">{completedExams.length}</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100">
                  <CheckCircle strokeWidth={1} className="h-6 w-6 text-slate-500" />
                </div>
              </div>
            </div>
          </motion.div>

          {/* State Handling (Loading, Error, Empty) */}
          {loading && (
            <motion.div variants={itemVariants} className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center space-x-4 bg-white p-6 rounded-xl border border-slate-200">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-[250px]" />
                    <Skeleton className="h-4 w-[200px]" />
                  </div>
                </div>
              ))}
            </motion.div>
          )}

          {error && !loading && (
            <motion.div variants={itemVariants}>
              <Alert variant="destructive" className="bg-red-50 border-red-200">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertTitle className="text-red-800">Error Loading Exams</AlertTitle>
                <AlertDescription className="text-red-700 flex items-center justify-between">
                  {error}
                  <button 
                    onClick={loadExams}
                    className="underline hover:text-red-900 font-medium"
                  >
                    Try Again
                  </button>
                </AlertDescription>
              </Alert>
            </motion.div>
          )}

          {!loading && !error && exams.length === 0 && (
            <motion.div variants={itemVariants}>
              <Empty className="bg-white border text-slate-500">
                <EmptyMedia variant="icon">
                  <Calendar className="text-slate-400" />
                </EmptyMedia>
                <EmptyTitle className="text-slate-700">No Exams Scheduled</EmptyTitle>
                <EmptyDescription>
                  You don't have any active or upcoming exams right now.
                </EmptyDescription>
              </Empty>
            </motion.div>
          )}

          {/* Active Exams Section */}
          {!loading && !error && activeExams.length > 0 && (
            <motion.div variants={itemVariants} className="space-y-4">
              <h3 className="font-sora text-xl font-semibold text-slate-900 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
                Active Exams
              </h3>
              <div className="grid gap-4">
                {activeExams.map((exam) => (
                  <ExamCard key={exam.id} exam={exam} statusBadge={getStatusBadge(exam.status)} />
                ))}
              </div>
            </motion.div>
          )}

          {/* Upcoming Exams Section */}
          {!loading && !error && upcomingExams.length > 0 && (
            <motion.div variants={itemVariants} className="space-y-4">
              <h3 className="font-sora text-xl font-semibold text-slate-900">Upcoming Exams</h3>
              <div className="grid gap-4">
                {upcomingExams.map((exam) => (
                  <ExamCard key={exam.id} exam={exam} statusBadge={getStatusBadge(exam.status)} />
                ))}
              </div>
            </motion.div>
          )}

          {/* Completed Exams Section */}
          {!loading && !error && completedExams.length > 0 && (
            <motion.div variants={itemVariants} className="space-y-4">
              <h3 className="font-sora text-xl font-semibold text-slate-500">Completed Exams</h3>
              <div className="grid gap-4">
                {completedExams.map((exam) => (
                  <ExamCard key={exam.id} exam={exam} statusBadge={getStatusBadge(exam.status)} />
                ))}
              </div>
            </motion.div>
          )}
        </motion.div>
      </main>
    </div>
  );
}

interface ExamCardProps {
  exam: Exam;
  statusBadge: React.ReactNode;
}

function ExamCard({ exam, statusBadge }: ExamCardProps) {
  const canStart = exam.status === 'active' && exam.enabled !== false;

  return (
    <motion.div
      whileHover={{ scale: 1.005 }}
      className={cn(
        'bg-white border border-slate-200 shadow-sm rounded-xl p-6 transition-all',
        exam.status === 'active' && 'border-success/30 shadow-glow-cyan'
      )}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            {statusBadge}
            <span className="text-xs text-slate-500 font-mono">
              ID: {exam.id}
            </span>
          </div>
          <h4 className="font-sora text-lg font-semibold text-slate-900">{exam.title}</h4>
          <p className="mt-1 text-sm text-slate-500 line-clamp-2">{exam.description}</p>
          
          <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5 text-slate-900/70">
              <Timer strokeWidth={1} className="h-4 w-4 text-blue-600" />
              <span>{formatDuration(exam.duration)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-900/70">
              <BookOpen strokeWidth={1} className="h-4 w-4 text-blue-600" />
              <span>{exam.totalQuestions} questions</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-900/70">
              <Calendar strokeWidth={1} className="h-4 w-4 text-blue-600" />
              <span>{formatDateTime(exam.startTime)}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {canStart && (
            <a
              href={`/exam/${exam.id}/start`}
              className="bg-blue-600 text-white hover:bg-blue-700 font-semibold py-3 px-6 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap"
            >
              Start Exam
              <ChevronRight strokeWidth={1} className="h-4 w-4" />
            </a>
          )}
          {exam.status === 'active' && exam.enabled === false && (
            <button
              disabled
              className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-slate-400 border border-slate-200 cursor-not-allowed whitespace-nowrap"
            >
              Disabled By Admin
            </button>
          )}
          {exam.status === 'upcoming' && (
            <button
              disabled
              className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-slate-400 border border-slate-200 cursor-not-allowed whitespace-nowrap"
            >
              Not Started
            </button>
          )}
          {exam.status === 'completed' && (
            <button
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors whitespace-nowrap"
            >
              View Results
            </button>
          )}
        </div>
      </div>

      {exam.status === 'active' && exam.instructions.length > 0 && (
        <div className="mt-4 rounded-xl bg-blue-50/50 p-4 border border-blue-600/10">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle strokeWidth={1} className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-600">Important Instructions</span>
          </div>
          <ul className="space-y-1">
            {exam.instructions.slice(0, 3).map((instruction, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-slate-900/70">
                <span className="mt-1.5 h-1 w-1 rounded-full bg-blue-600 flex-shrink-0" />
                {instruction}
              </li>
            ))}
          </ul>
        </div>
      )}
    </motion.div>
  );
}
