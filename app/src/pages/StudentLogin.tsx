import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, Mail, Lock, ArrowRight, CheckCircle, AlertCircle } from 'lucide-react';
import { AuthLayout } from '@/components/layouts/AuthLayout';
import { cn } from '@/lib/utils';
import { fetchApi } from '@/lib/api';

export function StudentLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetchApi('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password, examId: 'EXAM-101' }), // Real authentication
      });

      if (response.success && response.data?.token) {
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('sessionId', response.data.sessionId);
        setSuccess(true);
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 1000);
      } else {
        setError('Invalid email or password. Please try again.');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Student Login"
      subtitle="Access your exams securely with AI proctoring"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Email Field */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-800">
            Email Address
          </label>
          <div className="relative">
            <Mail strokeWidth={1} className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="student@university.edu"
              className="border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 transition-all rounded-lg w-full pl-12"
              required
              aria-label="Email address"
            />
          </div>
        </div>

        {/* Password Field */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-800">
            Password
          </label>
          <div className="relative">
            <Lock strokeWidth={1} className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 transition-all rounded-lg w-full pl-12 pr-12"
              required
              minLength={6}
              aria-label="Password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-500 transition-colors"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff strokeWidth={1} className="h-5 w-5" /> : <Eye strokeWidth={1} className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Remember Me & Forgot Password */}
        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 bg-white text-blue-600 focus:ring-blue-600/30"
            />
            <span className="text-slate-500">Remember me</span>
          </label>
          <a
            href="#"
            className="text-blue-600 hover:text-blue-600-light transition-colors"
          >
            Forgot password?
          </a>
        </div>

        {/* Error Message */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-center gap-2 rounded-lg bg-violation/10 p-3 text-sm text-violation border border-violation/20"
            >
              <AlertCircle strokeWidth={1} className="h-4 w-4 flex-shrink-0" />
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Success Message */}
        <AnimatePresence>
          {success && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-center gap-2 rounded-lg bg-success/10 p-3 text-sm text-success border border-success/20"
            >
              <CheckCircle strokeWidth={1} className="h-4 w-4 flex-shrink-0" />
              Login successful! Redirecting...
            </motion.div>
          )}
        </AnimatePresence>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading || success}
          className={cn(
            'bg-blue-600 text-white hover:bg-blue-700 font-semibold py-3 px-6 rounded-lg transition-colors w-full flex items-center justify-center gap-2',
            (isLoading || success) && 'opacity-70 cursor-not-allowed'
          )}
        >
          {isLoading ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="h-5 w-5 border-2 border-navy-900 border-t-transparent rounded-full"
            />
          ) : (
            <>
              Sign In
              <ArrowRight strokeWidth={1} className="h-4 w-4" />
            </>
          )}
        </button>

        {/* Divider */}
        <div className="relative py-2">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-white px-4 text-xs text-slate-400">
              Or continue with
            </span>
          </div>
        </div>

        {/* SSO Button */}
        <button
          type="button"
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 transition-all hover:bg-slate-100 hover:border-slate-300 flex items-center justify-center gap-2"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Continue with Google
        </button>
      </form>

      {/* Help Link & Admin */}
      <div className="mt-6 flex flex-col items-center gap-2 text-sm text-slate-500">
        <p>
          Need help?{' '}
          <a href="#" className="text-blue-600 hover:text-blue-600-light transition-colors">
            Contact Support
          </a>
        </p>
        <p>
          Are you an administrator?{' '}
          <button onClick={() => window.location.href = '/admin/login'} className="text-blue-600 hover:text-blue-600-light transition-colors">
            Admin Login
          </button>
        </p>
      </div>
    </AuthLayout>
  );
}
