import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, Mail, Lock, ArrowRight, CheckCircle, AlertCircle, Shield, User } from 'lucide-react';
import { AuthLayout } from '@/components/layouts/AuthLayout';
import { cn } from '@/lib/utils';
import { fetchApi } from '@/lib/api';

export function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);
  const [otpCode, setOtpCode] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      // For Admin, we still hit the same mock endpoint for demo
      const response = await fetchApi('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ userId: email, password, examId: 'ADMIN-PORTAL' }),
      });

      if (response.success && response.data?.token) {
        localStorage.setItem('adminToken', response.data.token);
        setRequires2FA(true);
      } else {
        setError('Invalid credentials. Please try again.');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handle2FASubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    await new Promise(resolve => setTimeout(resolve, 1000));

    if (otpCode.length === 6) {
      setSuccess(true);
      setTimeout(() => {
        window.location.href = '/admin/dashboard';
      }, 1000);
    } else {
      setError('Invalid verification code');
    }

    setIsLoading(false);
  };

  return (
    <AuthLayout
      title="Admin Portal"
      subtitle="Secure access for proctors and administrators"
    >
      <AnimatePresence mode="wait">
        {!requires2FA ? (
          <motion.form
            key="login"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            onSubmit={handleSubmit}
            className="space-y-5"
          >
            {/* Email Field */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-white/80">
                Admin Email
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/40" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@institution.edu"
                  className="input-dark w-full pl-12"
                  required
                  aria-label="Admin email"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-white/80">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/40" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input-dark w-full pl-12 pr-12"
                  required
                  minLength={6}
                  aria-label="Password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60 transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
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
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className={cn(
                'btn-primary w-full flex items-center justify-center gap-2',
                isLoading && 'opacity-70 cursor-not-allowed'
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
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>

            {/* Security Notice */}
            <div className="flex items-start gap-3 p-4 rounded-xl bg-cyan/5 border border-cyan/10">
              <Shield className="h-5 w-5 text-cyan flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-white/80">Enhanced Security Required</p>
                <p className="text-xs text-text-secondary mt-1">
                  All admin access requires two-factor authentication and is logged for compliance.
                </p>
              </div>
            </div>
          </motion.form>
        ) : (
          <motion.form
            key="2fa"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            onSubmit={handle2FASubmit}
            className="space-y-5"
          >
            {/* Back Button */}
            <button
              type="button"
              onClick={() => setRequires2FA(false)}
              className="text-sm text-cyan hover:text-cyan-light transition-colors"
            >
              ← Back to login
            </button>

            <div className="text-center">
              <div className="mx-auto h-16 w-16 rounded-full bg-cyan/10 flex items-center justify-center mb-4">
                <User className="h-8 w-8 text-cyan" />
              </div>
              <h3 className="font-sora text-lg font-semibold text-white">Two-Factor Authentication</h3>
              <p className="text-sm text-text-secondary mt-1">
                Enter the 6-digit code from your authenticator app
              </p>
            </div>

            {/* OTP Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-white/80">
                Verification Code
              </label>
              <input
                type="text"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="input-dark w-full text-center font-mono text-2xl tracking-[0.5em]"
                maxLength={6}
                inputMode="numeric"
                autoFocus
              />
            </div>

            {/* Success Message */}
            <AnimatePresence>
              {success && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex items-center gap-2 rounded-lg bg-success/10 p-3 text-sm text-success border border-success/20"
                >
                  <CheckCircle className="h-4 w-4 flex-shrink-0" />
                  Authentication successful! Redirecting...
                </motion.div>
              )}
            </AnimatePresence>

            {/* Error Message */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex items-center gap-2 rounded-lg bg-violation/10 p-3 text-sm text-violation border border-violation/20"
                >
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || otpCode.length !== 6}
              className={cn(
                'btn-primary w-full flex items-center justify-center gap-2',
                (isLoading || otpCode.length !== 6) && 'opacity-70 cursor-not-allowed'
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
                  Verify
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>

            <p className="text-center text-sm text-text-secondary">
              Didn't receive a code?{' '}
              <button type="button" className="text-cyan hover:text-cyan-light transition-colors">
                Resend
              </button>
            </p>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Help Link */}
      <p className="mt-6 text-center text-sm text-white/60">
        Need admin access?{' '}
        <a href="#" className="text-cyan hover:text-cyan-light transition-colors">
          Contact IT Support
        </a>
      </p>
    </AuthLayout>
  );
}
