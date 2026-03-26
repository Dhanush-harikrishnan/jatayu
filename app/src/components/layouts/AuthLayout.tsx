import { motion } from 'framer-motion';
import { Shield, Lock, Server, Globe } from 'lucide-react';

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-navy-900">
      {/* Background Effects */}
      <div className="absolute inset-0">
        {/* Gradient orbs */}
        <div className="absolute -left-1/4 -top-1/4 h-[600px] w-[600px] rounded-full bg-cyan/10 blur-[120px]" />
        <div className="absolute -right-1/4 bottom-0 h-[500px] w-[500px] rounded-full bg-cyan/5 blur-[100px]" />
        
        {/* Grid pattern */}
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(0, 240, 255, 0.5) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0, 240, 255, 0.5) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px',
          }}
        />
      </div>

      {/* Navigation */}
      <motion.nav 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 flex items-center justify-between px-6 py-4 lg:px-12"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan/10">
            <Shield className="h-6 w-6 text-cyan" />
          </div>
          <span className="font-sora text-xl font-bold text-white">
            SecureGuard
          </span>
        </div>
        
        <div className="flex items-center gap-6 text-sm text-text-secondary">
          <div className="hidden items-center gap-2 md:flex">
            <Lock className="h-4 w-4" />
            <span>256-bit Encryption</span>
          </div>
          <div className="hidden items-center gap-2 md:flex">
            <Server className="h-4 w-4" />
            <span>SOC 2 Compliant</span>
          </div>
        </div>
      </motion.nav>

      {/* Main Content */}
      <div className="relative z-10 flex min-h-[calc(100vh-80px)] items-center justify-center px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-md"
        >
          {/* Glass Card */}
          <div className="glass-card p-8">
            {/* Header */}
            <div className="mb-8 text-center">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan/10"
              >
                <Shield className="h-8 w-8 text-cyan" />
              </motion.div>
              <h1 className="font-sora text-2xl font-bold text-white">
                {title}
              </h1>
              {subtitle && (
                <p className="mt-2 text-sm text-text-secondary">
                  {subtitle}
                </p>
              )}
            </div>

            {/* Form Content */}
            {children}
          </div>

          {/* Footer */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mt-8 text-center"
          >
            <div className="flex items-center justify-center gap-4 text-xs text-text-secondary">
              <span className="flex items-center gap-1">
                <Globe className="h-3 w-3" />
                GDPR Ready
              </span>
              <span className="flex items-center gap-1">
                <Lock className="h-3 w-3" />
                TLS 1.3
              </span>
            </div>
            <p className="mt-4 text-xs text-text-secondary/60">
              © 2024 SecureGuard Pro. All rights reserved.
            </p>
          </motion.div>
        </motion.div>
      </div>

      {/* Decorative Elements */}
      <div className="pointer-events-none absolute bottom-8 left-8 hidden lg:block">
        <div className="flex flex-col gap-2">
          <div className="h-1 w-12 rounded-full bg-cyan/30" />
          <div className="h-1 w-8 rounded-full bg-cyan/20" />
          <div className="h-1 w-16 rounded-full bg-cyan/10" />
        </div>
      </div>
    </div>
  );
}
