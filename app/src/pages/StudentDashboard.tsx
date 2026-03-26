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

  useEffect(() => {
    fetchApi('/dashboard/student/exams').then(res => {
      if (res.success && res.data) {
        setExams(res.data);
      }
    });
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
          <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan/10 px-3 py-1 text-xs font-medium text-cyan border border-cyan/20">
            <Calendar className="h-3 w-3" />
            Upcoming
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/60 border border-white/10">
            <CheckCircle className="h-3 w-3" />
            Completed
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-navy-900">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-navy-900/80 backdrop-blur-xl">
        <div className="flex items-center justify-between px-4 py-4 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan/10">
              <Shield className="h-6 w-6 text-cyan" />
            </div>
            <div>
              <h1 className="font-sora text-lg font-bold text-white">SecureGuard</h1>
              <p className="text-xs text-text-secondary">Student Portal</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden text-right md:block">
              <p className="text-sm font-medium text-white">John Doe</p>
              <p className="text-xs text-text-secondary">Student ID: STU-2024-001</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan/10">
              <User className="h-5 w-5 text-cyan" />
            </div>
            <button 
              onClick={() => window.location.href = '/login'}
              className="flex h-10 w-10 items-center justify-center rounded-xl text-white/60 hover:bg-white/5 hover:text-white transition-colors"
            >
              <LogOut className="h-5 w-5" />
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
              <h2 className="font-sora text-3xl font-bold text-white">
                Welcome back, John!
              </h2>
              <p className="mt-1 text-text-secondary">
                You have {activeExams.length} active and {upcomingExams.length} upcoming exams
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-white/5 px-4 py-2 border border-white/10">
              <Clock className="h-5 w-5 text-cyan" />
              <span className="font-mono text-sm text-white">
                {currentTime.toLocaleTimeString('en-US', { hour12: false })}
              </span>
              <span className="text-white/30">|</span>
              <span className="text-sm text-text-secondary">
                {currentTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </span>
            </div>
          </motion.div>

          {/* Stats Cards */}
          <motion.div variants={itemVariants} className="grid gap-4 md:grid-cols-3">
            <div className="glass-card p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-text-secondary">Active Exams</p>
                  <p className="mt-1 font-sora text-3xl font-bold text-success">{activeExams.length}</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success/10">
                  <PlayCircle className="h-6 w-6 text-success" />
                </div>
              </div>
            </div>
            <div className="glass-card p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-text-secondary">Upcoming</p>
                  <p className="mt-1 font-sora text-3xl font-bold text-cyan">{upcomingExams.length}</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan/10">
                  <Calendar className="h-6 w-6 text-cyan" />
                </div>
              </div>
            </div>
            <div className="glass-card p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-text-secondary">Completed</p>
                  <p className="mt-1 font-sora text-3xl font-bold text-white/60">{completedExams.length}</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10">
                  <CheckCircle className="h-6 w-6 text-white/60" />
                </div>
              </div>
            </div>
          </motion.div>

          {/* Active Exams Section */}
          {activeExams.length > 0 && (
            <motion.div variants={itemVariants} className="space-y-4">
              <h3 className="font-sora text-xl font-semibold text-white flex items-center gap-2">
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
          {upcomingExams.length > 0 && (
            <motion.div variants={itemVariants} className="space-y-4">
              <h3 className="font-sora text-xl font-semibold text-white">Upcoming Exams</h3>
              <div className="grid gap-4">
                {upcomingExams.map((exam) => (
                  <ExamCard key={exam.id} exam={exam} statusBadge={getStatusBadge(exam.status)} />
                ))}
              </div>
            </motion.div>
          )}

          {/* Completed Exams Section */}
          {completedExams.length > 0 && (
            <motion.div variants={itemVariants} className="space-y-4">
              <h3 className="font-sora text-xl font-semibold text-white/60">Completed Exams</h3>
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
        'glass-card p-6 transition-all',
        exam.status === 'active' && 'border-success/30 shadow-glow-cyan'
      )}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            {statusBadge}
            <span className="text-xs text-text-secondary font-mono">
              ID: {exam.id}
            </span>
          </div>
          <h4 className="font-sora text-lg font-semibold text-white">{exam.title}</h4>
          <p className="mt-1 text-sm text-text-secondary line-clamp-2">{exam.description}</p>
          
          <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5 text-white/70">
              <Timer className="h-4 w-4 text-cyan" />
              <span>{formatDuration(exam.duration)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-white/70">
              <BookOpen className="h-4 w-4 text-cyan" />
              <span>{exam.totalQuestions} questions</span>
            </div>
            <div className="flex items-center gap-1.5 text-white/70">
              <Calendar className="h-4 w-4 text-cyan" />
              <span>{formatDateTime(exam.startTime)}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {canStart && (
            <a
              href={`/exam/${exam.id}/start`}
              className="btn-primary flex items-center gap-2 whitespace-nowrap"
            >
              Start Exam
              <ChevronRight className="h-4 w-4" />
            </a>
          )}
          {exam.status === 'active' && exam.enabled === false && (
            <button
              disabled
              className="rounded-xl bg-white/5 px-4 py-2 text-sm font-medium text-white/40 border border-white/10 cursor-not-allowed whitespace-nowrap"
            >
              Disabled By Admin
            </button>
          )}
          {exam.status === 'upcoming' && (
            <button
              disabled
              className="rounded-xl bg-white/5 px-4 py-2 text-sm font-medium text-white/40 border border-white/10 cursor-not-allowed whitespace-nowrap"
            >
              Not Started
            </button>
          )}
          {exam.status === 'completed' && (
            <button
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/60 hover:bg-white/10 hover:text-white transition-colors whitespace-nowrap"
            >
              View Results
            </button>
          )}
        </div>
      </div>

      {exam.status === 'active' && exam.instructions.length > 0 && (
        <div className="mt-4 rounded-xl bg-cyan/5 p-4 border border-cyan/10">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="h-4 w-4 text-cyan" />
            <span className="text-sm font-medium text-cyan">Important Instructions</span>
          </div>
          <ul className="space-y-1">
            {exam.instructions.slice(0, 3).map((instruction, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-white/70">
                <span className="mt-1.5 h-1 w-1 rounded-full bg-cyan flex-shrink-0" />
                {instruction}
              </li>
            ))}
          </ul>
        </div>
      )}
    </motion.div>
  );
}
