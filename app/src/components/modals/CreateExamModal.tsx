import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FileText, CheckCircle2, ChevronRight, ChevronLeft, Plus } from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { QuestionEditor } from './QuestionEditor';
import type { QuestionData } from './QuestionEditor';

interface CreateExamModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExamCreated: () => void;
  examId?: string;
}

const generateId = () => Math.random().toString(36).substring(2, 9);

export function CreateExamModal({ isOpen, onClose, onExamCreated }: CreateExamModalProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Exam Data
  const [examData, setExamData] = useState({
    title: '',
    description: '',
    duration: 60,
    startTime: '',
    endTime: '',
    enabled: true,
    requireFullscreen: true,
  });

  // Questions Data
  const [questions, setQuestions] = useState<QuestionData[]>([]);

  if (!isOpen) return null;

  const handleNext = () => {
    setError(null);
    if (step === 1 && (!examData.title || !examData.description)) {
      setError('Title and description are required.');
      return;
    }
    if (step === 2 && (!examData.startTime || !examData.endTime || examData.duration <= 0)) {
      setError('Start time, end time, and valid duration are required.');
      return;
    }
    setStep(s => s + 1);
  };

  const handleBack = () => {
    setError(null);
    setStep(s => s - 1);
  };

  const handleAddQuestion = (type: 'MCQ' | 'CODING' | 'APTITUDE' | 'LOGICAL') => {
    const newQ: QuestionData = {
      order: questions.length + 1,
      id: generateId(),
      sectionType: type,
      text: '',
      difficulty: 'medium',
      points: 1,
      options: ['MCQ', 'APTITUDE', 'LOGICAL'].includes(type) ? ['', '', '', ''] : [],
      correctAnswer: ['MCQ', 'APTITUDE', 'LOGICAL'].includes(type) ? 0 : '',
      codingConfig: type === 'CODING' ? {
        language: 'javascript',
        starterCode: '',
        testCases: [{ input: '', expectedOutput: '' }],
        timeLimit: 1000
      } : undefined
    };
    setQuestions([...questions, newQ]);
  };

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);

    try {
      // 1. Create Exam
      const examId = `EXAM-${generateId().toUpperCase()}`;
      const examPayload = {
        ...examData,
        examId,
        startTime: new Date(examData.startTime).toISOString(),
        endTime: new Date(examData.endTime).toISOString(),
        totalQuestions: questions.length
      };

      // Ensure /dashboard/admin/exams exists or use another route
      // From previous refactoring, creating an exam posts to /dashboard/admin/exams (or we updated it to use fetchApi appropriately)
      const res = await fetchApi('/dashboard/admin/exams', {
        method: 'POST',
        body: JSON.stringify(examPayload),
      });

      if (!res.success) {
        throw new Error(res.message || 'Failed to create exam metadata');
      }

      // 2. Batch Create Questions if any
      if (questions.length > 0) {
        const questionsPayload = questions.map((q, idx) => {
          const { id, ...rest } = q;
          return {
            ...rest,
            examId,
            order: idx
          };
        });

        const qRes = await fetchApi('/api/questions/batch', {
          method: 'POST',
          body: JSON.stringify({ questions: questionsPayload })
        });

        if (qRes.error) {
          throw new Error(qRes.error || 'Failed to populate questions');
        }
      }

      onExamCreated();
      onClose();
    } catch (err: any) {
      setError(err.message || 'An error occurred while creating the exam');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-navy-900/80 backdrop-blur-sm"
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-4xl overflow-hidden rounded-2xl border border-white/10 bg-white shadow-2xl flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="flex flex-shrink-0 items-center justify-between border-b border-slate-200 p-4 lg:p-6 bg-slate-50">
            <div>
              <h2 className="font-sora text-xl font-bold text-slate-900">Create Dynamic Exam</h2>
              <p className="mt-1 text-sm text-slate-500">Step {step} of 4</p>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-900 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-4 lg:p-6 flex-1 overflow-y-auto custom-scrollbar">
            {error && (
              <div className="mb-4 rounded-lg bg-red-100 p-3 text-sm text-red-600 border border-red-200">
                {error}
              </div>
            )}

            <div className="space-y-6">
              {step === 1 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700">Exam Title</label>
                    <input
                      type="text"
                      value={examData.title}
                      onChange={e => setExamData({ ...examData, title: e.target.value })}
                      className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="e.g. Midterm 2026"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700">Description & Instructions</label>
                    <textarea
                      value={examData.description}
                      onChange={e => setExamData({ ...examData, description: e.target.value })}
                      rows={4}
                      className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="Enter exam description..."
                    />
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700">Start Time</label>
                      <input
                        type="datetime-local"
                        value={examData.startTime}
                        onChange={e => setExamData({ ...examData, startTime: e.target.value })}
                        className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700">End Time</label>
                      <input
                        type="datetime-local"
                        value={examData.endTime}
                        onChange={e => setExamData({ ...examData, endTime: e.target.value })}
                        className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700">Duration (Minutes)</label>
                    <input
                      type="number"
                      min={1}
                      value={examData.duration}
                      onChange={e => setExamData({ ...examData, duration: parseInt(e.target.value) || 60 })}
                      className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <input 
                      type="checkbox" 
                      id="enable-exam"
                      checked={examData.enabled}
                      onChange={e => setExamData({ ...examData, enabled: e.target.checked })}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                    />
                    <div>
                      <label htmlFor="enable-exam" className="font-medium text-slate-900 block">Enable Exam Immediately</label>
                      <p className="text-sm text-slate-500">Students can see this exam on their dashboard if active.</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <input 
                      type="checkbox" 
                      id="fullscreen-exam"
                      checked={examData.requireFullscreen}
                      onChange={e => setExamData({ ...examData, requireFullscreen: e.target.checked })}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                    />
                    <div>
                      <label htmlFor="fullscreen-exam" className="font-medium text-slate-900 block">Require Fullscreen</label>
                      <p className="text-sm text-slate-500">Strict proctoring will flag an exit from fullscreen.</p>
                    </div>
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="space-y-6">
                  <div className="flex gap-2 mb-4 flex-wrap">
                    <button onClick={() => handleAddQuestion('MCQ')} className="flex items-center gap-1 bg-blue-100 text-blue-700 px-3 py-1.5 rounded-md hover:bg-blue-200 text-sm font-medium transition-colors"><Plus className="w-4 h-4"/> Add MCQ</button>
                    <button onClick={() => handleAddQuestion('APTITUDE')} className="flex items-center gap-1 bg-amber-100 text-amber-700 px-3 py-1.5 rounded-md hover:bg-amber-200 text-sm font-medium transition-colors"><Plus className="w-4 h-4"/> Add Aptitude</button>
                    <button onClick={() => handleAddQuestion('LOGICAL')} className="flex items-center gap-1 bg-purple-100 text-purple-700 px-3 py-1.5 rounded-md hover:bg-purple-200 text-sm font-medium transition-colors"><Plus className="w-4 h-4"/> Add Logical</button>
                    <button onClick={() => handleAddQuestion('CODING')} className="flex items-center gap-1 bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-md hover:bg-emerald-200 text-sm font-medium transition-colors"><Plus className="w-4 h-4"/> Add Coding</button>
                  </div>

                  {questions.length === 0 ? (
                    <div className="text-center py-10 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                      <FileText className="w-10 h-10 mx-auto text-slate-400 mb-2" />
                      <p className="text-slate-500">No questions added yet. Choose a question type above.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {questions.map((q, idx) => (
                        <QuestionEditor 
                          key={q.id}
                          question={q}
                          onChange={(updatedQ) => {
                            const max = [...questions];
                            max[idx] = updatedQ;
                            setQuestions(max);
                          }}
                          onRemove={() => {
                            const newQ = [...questions];
                            newQ.splice(idx, 1);
                            setQuestions(newQ);
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex flex-shrink-0 items-center justify-between border-t border-slate-200 p-4 bg-slate-50">
            <button
              type="button"
              onClick={step === 1 ? onClose : handleBack}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 rounded-lg transition-colors flex items-center"
            >
              {step === 1 ? 'Cancel' : <><ChevronLeft className="w-4 h-4 mr-1"/> Back</>}
            </button>
            <button
              onClick={step === 4 ? handleSubmit : handleNext}
              disabled={loading}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
              ) : step === 4 ? (
                <><CheckCircle2 className="w-4 h-4" /> Create Exam</>
              ) : (
                <>Next <ChevronRight className="w-4 h-4" /></>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}