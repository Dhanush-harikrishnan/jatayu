import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CalendarDays, Clock, FileText, CheckCircle2 } from 'lucide-react';
import { fetchApi } from '@/lib/api';

interface CreateExamModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExamCreated: () => void;
}

export function CreateExamModal({ isOpen, onClose, onExamCreated }: CreateExamModalProps) {
  const [formData, setFormData] = useState({
    id: '',
    title: '',
    description: '',
    duration: 60,
    totalQuestions: 10,
    requireFullscreen: true,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetchApi('/dashboard/admin/exams', {
        method: 'POST',
        body: JSON.stringify(formData),
      });

      if (res.success) {
        onExamCreated();
        onClose();
      } else {
        setError(res.message || 'Failed to create exam');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while creating the exam');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? Number(value) : value
    }));
  };

  if (!isOpen) return null;

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
          className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-navy-800 shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 p-4 lg:p-6 bg-navy-900/50">
            <div>
              <h2 className="font-sora text-xl font-bold text-white">Create Custom Exam</h2>
              <p className="mt-1 text-sm text-text-secondary">Deploy a new assessment instantly.</p>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-text-secondary hover:bg-white/5 hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-4 lg:p-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
            {error && (
              <div className="mb-4 rounded-lg bg-violation/10 p-3 text-sm text-violation border border-violation/20">
                {error}
              </div>
            )}

            <form id="create-exam-form" onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 focus-within:text-cyan transition-colors">
                  <label className="text-xs font-medium text-text-secondary">Exam ID (e.g. EXAM-201)</label>
                  <input
                    required
                    name="id"
                    value={formData.id}
                    onChange={handleChange}
                    className="input-dark w-full"
                    placeholder="Must be unique"
                  />
                </div>
                <div className="space-y-1.5 focus-within:text-cyan transition-colors">
                  <label className="text-xs font-medium text-text-secondary">Total Questions</label>
                  <input
                    required
                    type="number"
                    name="totalQuestions"
                    min="1"
                    defaultChecked
                    value={formData.totalQuestions}
                    onChange={handleChange}
                    className="input-dark w-full"
                  />
                </div>
              </div>

              <div className="space-y-1.5 focus-within:text-cyan transition-colors">
                <label className="flex items-center gap-2 text-xs font-medium text-text-secondary">
                  <FileText className="h-4 w-4" /> Exam Title
                </label>
                <input
                  required
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  className="input-dark w-full"
                  placeholder="E.g. Midterm Computer Science"
                />
              </div>

              <div className="space-y-1.5 focus-within:text-cyan transition-colors">
                <label className="text-xs font-medium text-text-secondary">Description</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={3}
                  className="input-dark w-full resize-none"
                  placeholder="Optional description"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 focus-within:text-cyan transition-colors">
                  <label className="flex items-center gap-2 text-xs font-medium text-text-secondary">
                    <Clock className="h-4 w-4" /> Duration (minutes)
                  </label>
                  <input
                    required
                    type="number"
                    name="duration"
                    min="10"
                    max="480"
                    value={formData.duration}
                    onChange={handleChange}
                    className="input-dark w-full"
                  />
                </div>
                <div className="space-y-1.5 focus-within:text-cyan transition-colors">
                  <label className="flex items-center gap-2 text-xs font-medium text-text-secondary">
                    <CalendarDays className="h-4 w-4" /> Require Fullscreen
                  </label>
                  <select
                    name="requireFullscreen"
                    value={formData.requireFullscreen ? 'true' : 'false'}
                    onChange={(e) => setFormData(p => ({ ...p, requireFullscreen: e.target.value === 'true' }))}
                    className="input-dark w-full"
                  >
                    <option value="true">Yes</option>
                    <option value="false">No (Practice Mode)</option>
                  </select>
                </div>
              </div>
            </form>
          </div>

          {/* Footer */}
          <div className="border-t border-white/10 bg-navy-900/50 p-4 lg:p-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-white transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="create-exam-form"
              disabled={loading || !formData.id || !formData.title}
              className="flex items-center gap-2 rounded-lg bg-cyan px-6 py-2 text-sm font-semibold text-navy-900 hover:bg-cyan-light transition-colors disabled:opacity-50"
            >
              {loading ? (
                <span className="h-4 w-4 rounded-full border-2 border-navy-900 border-t-transparent animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Create Exam
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
