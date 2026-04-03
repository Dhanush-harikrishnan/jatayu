import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Shield, Lock, Server, Globe, Play,
  Eye, Smartphone, Users, BarChart3,
  ArrowRight, Menu, X, Star
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { StudentLogin } from '@/pages/StudentLogin';
import { StudentDashboard } from '@/pages/StudentDashboard';
import { ExamLaunch } from '@/pages/ExamLaunch';
import { LiveProctoring } from '@/pages/LiveProctoring';
import { MobileCamera } from '@/pages/MobileCamera';
import { AdminLogin } from '@/pages/AdminLogin';
import { AdminDashboard } from '@/pages/AdminDashboard';
import { ExamReport } from '@/pages/ExamReport';

// Simple router based on URL path
function useRouter() {
  const [path, setPath] = useState(window.location.pathname);

  useEffect(() => {
    const handlePopState = () => setPath(window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (newPath: string) => {
    window.history.pushState({}, '', newPath);
    setPath(newPath);
  };

  return { path, navigate };
}

function App() {
  const { path, navigate } = useRouter();

  // Route matching
  const renderRoute = () => {
    // Student routes
    if (path === '/login') return <StudentLogin />;
    if (path === '/dashboard') return <StudentDashboard />;
    if (path.startsWith('/exam/') && path.endsWith('/start')) {
      const examId = path.split('/')[2];
      return <ExamLaunch examId={examId} />;
    }
    if (path.startsWith('/exam/') && path.endsWith('/proctor')) {
      const examId = path.split('/')[2];
      return <LiveProctoring examId={examId} />;
    }
    if (path === '/exam-report') {
      return <ExamReport />;
    }
    if (path.startsWith('/mobile-pair')) {
      const searchParams = new URLSearchParams(window.location.search);
      const code = searchParams.get('code') || undefined;
      const token = searchParams.get('token') || undefined;
      return <MobileCamera pairingCode={code} pairingToken={token} />;
    }
    
    // Mobile PWA route
    if (path === '/mobile-camera') return <MobileCamera />;
    
    // Admin routes
    if (path === '/admin/login') return <AdminLogin />;
    if (path === '/admin/dashboard') return <AdminDashboard />;
    
    // Default: Landing page
    return <LandingPage navigate={navigate} />;
  };

  return (
    <div className="min-h-screen bg-navy-900">
      <AnimatePresence mode="wait">
        <motion.div
          key={path}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {renderRoute()}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// Landing Page Component
function LandingPage({ navigate }: { navigate: (path: string) => void }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const features = [
    {
      icon: Eye,
      title: 'AI-Powered Monitoring',
      description: 'Real-time face detection, gaze tracking, and behavior analysis using advanced machine learning.',
    },
    {
      icon: Smartphone,
      title: 'Multi-Device Coverage',
      description: 'Pair mobile devices for room scans and secondary angle coverage without additional hardware.',
    },
    {
      icon: Users,
      title: 'Live Proctor Dashboard',
      description: 'Monitor hundreds of candidates simultaneously with real-time violation alerts and telemetry.',
    },
    {
      icon: BarChart3,
      title: 'Comprehensive Analytics',
      description: 'Detailed session reports, anomaly scoring, and audit trails for complete transparency.',
    },
  ];

  const stats = [
    { value: '99.9%', label: 'Uptime SLA' },
    { value: '<800ms', label: 'Detection Latency' },
    { value: '500K+', label: 'Exams Secured' },
    { value: '200+', label: 'Institutions' },
  ];

  const testimonials = [
    {
      quote: "SecureGuard Pro reduced our exam administration time by 40% while improving integrity confidence.",
      author: "Dr. A. Mensah",
      role: "Dean of Digital Learning",
      institution: "Stanford University",
    },
    {
      quote: "The AI detection is remarkably accurate. We've caught violations we would have never noticed before.",
      author: "Prof. James Chen",
      role: "Director of Online Education",
      institution: "MIT",
    },
  ];

  return (
    <div className="min-h-screen bg-navy-900 overflow-x-hidden">
      {/* Navigation */}
      <nav className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
        scrolled ? 'bg-navy-900/90 backdrop-blur-xl border-b border-white/5' : 'bg-transparent'
      )}>
        <div className="flex items-center justify-between px-4 py-4 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan/10">
              <Shield strokeWidth={1} className="h-6 w-6 text-cyan" />
            </div>
            <span className="font-sora text-xl font-bold text-white">SecureGuard</span>
          </div>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-8">
            <a href="#features" className="text-sm text-white/70 hover:text-white transition-colors">Features</a>
            <a href="#how-it-works" className="text-sm text-white/70 hover:text-white transition-colors">How It Works</a>
            <a href="#testimonials" className="text-sm text-white/70 hover:text-white transition-colors">Testimonials</a>
            <a href="#pricing" className="text-sm text-white/70 hover:text-white transition-colors">Pricing</a>
          </div>

          <div className="hidden lg:flex items-center gap-4">
            <button 
              onClick={() => navigate('/admin/login')}
              className="text-sm text-white/70 hover:text-white transition-colors"
            >
              Admin Portal
            </button>
            <button 
              onClick={() => navigate('/login')}
              className="text-sm text-white/70 hover:text-white transition-colors"
            >
              Student Log in
            </button>
            <button 
              onClick={() => navigate('/login')}
              className="btn-outline text-sm"
            >
              Request Demo
            </button>
          </div>

          {/* Mobile Menu Button */}
          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="lg:hidden h-10 w-10 flex items-center justify-center text-white"
          >
            {isMenuOpen ? <X strokeWidth={1} className="h-6 w-6" /> : <Menu strokeWidth={1} className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="lg:hidden bg-navy-900/95 backdrop-blur-xl border-b border-white/5"
            >
              <div className="px-4 py-4 space-y-4">
                <a href="#features" className="block text-white/70 hover:text-white">Features</a>
                <a href="#how-it-works" className="block text-white/70 hover:text-white">How It Works</a>
                <a href="#testimonials" className="block text-white/70 hover:text-white">Testimonials</a>
                <a href="#pricing" className="block text-white/70 hover:text-white">Pricing</a>
                <hr className="border-white/10" />
                <button 
                  onClick={() => navigate('/admin/login')}
                  className="block w-full text-left text-white/70 hover:text-white"
                >
                  Admin Portal
                </button>
                <button 
                  onClick={() => navigate('/login')}
                  className="block w-full text-left text-white/70 hover:text-white"
                >
                  Student Log in
                </button>
                <button 
                  onClick={() => navigate('/login')}
                  className="btn-primary w-full text-center"
                >
                  Request Demo
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center pt-20">
        {/* Background Effects */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -left-1/4 -top-1/4 h-[800px] w-[800px] rounded-full bg-cyan/10 blur-[150px]" />
          <div className="absolute -right-1/4 bottom-0 h-[600px] w-[600px] rounded-full bg-cyan/5 blur-[120px]" />
          <div 
            className="absolute inset-0 opacity-[0.02]"
            style={{
              backgroundImage: `linear-gradient(rgba(0, 240, 255, 0.5) 1px, transparent 1px),
                               linear-gradient(90deg, rgba(0, 240, 255, 0.5) 1px, transparent 1px)`,
              backgroundSize: '60px 60px',
            }}
          />
        </div>

        <div className="relative z-10 w-full px-4 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              {/* Left Content */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
              >
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan/10 border border-cyan/20 mb-6">
                  <span className="h-2 w-2 rounded-full bg-cyan animate-pulse" />
                  <span className="text-sm text-cyan">Now with GPT-4 Integration</span>
                </div>
                
                <h1 className="font-sora text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight">
                  Secure Exams.
                  <br />
                  <span className="text-gradient-cyan">Zero Compromise.</span>
                </h1>
                
                <p className="mt-6 text-lg text-text-secondary max-w-lg">
                  AI proctoring that protects integrity without sacrificing the candidate experience. 
                  Real-time monitoring, multi-device coverage, and comprehensive analytics.
                </p>

                <div className="mt-8 flex flex-wrap gap-4">
                  <button 
                    onClick={() => navigate('/login')}
                    className="btn-primary flex items-center gap-2"
                  >
                    Request a Demo
                    <ArrowRight strokeWidth={1} className="h-4 w-4" />
                  </button>
                  <button className="btn-outline flex items-center gap-2">
                    <Play strokeWidth={1} className="h-4 w-4" />
                    Watch Video
                  </button>
                </div>

                <div className="mt-12 flex items-center gap-6 text-sm text-text-secondary">
                  <span className="flex items-center gap-2">
                    <Lock strokeWidth={1} className="h-4 w-4" />
                    SOC 2 Type II
                  </span>
                  <span className="flex items-center gap-2">
                    <Globe strokeWidth={1} className="h-4 w-4" />
                    GDPR Ready
                  </span>
                  <span className="flex items-center gap-2">
                    <Server strokeWidth={1} className="h-4 w-4" />
                    WCAG 2.1 AA
                  </span>
                </div>
              </motion.div>

              {/* Right Content - Dashboard Preview */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                className="relative"
              >
                <div className="glass-card p-6 relative overflow-hidden">
                  {/* Mock Dashboard UI */}
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-center justify-between pb-4 border-b border-white/10">
                      <div className="flex items-center gap-3">
                        <Shield strokeWidth={1} className="h-5 w-5 text-cyan" />
                        <span className="font-medium text-white">SecureGuard Pro</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
                        <span className="text-xs text-success">Protected</span>
                      </div>
                    </div>

                    {/* Student List */}
                    <div className="space-y-2">
                      {[
                        { name: 'Alice Johnson', status: 'online', time: '45m' },
                        { name: 'Bob Smith', status: 'violation', time: '32m' },
                        { name: 'Carol White', status: 'online', time: '51m' },
                      ].map((student, i) => (
                        <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-cyan/20 flex items-center justify-center">
                              <Users strokeWidth={1} className="h-4 w-4 text-cyan" />
                            </div>
                            <span className="text-sm text-white">{student.name}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-text-secondary">{student.time}</span>
                            <span className={cn(
                              'h-2 w-2 rounded-full',
                              student.status === 'online' && 'bg-success',
                              student.status === 'violation' && 'bg-violation animate-pulse'
                            )} />
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Scanning Animation */}
                    <div className="relative h-32 rounded-lg bg-navy-800 flex items-center justify-center overflow-hidden">
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-24 h-24 rounded-full border border-cyan/30 animate-ping" />
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-16 h-16 rounded-full border-2 border-cyan/50 animate-pulse" />
                      </div>
                      <Eye strokeWidth={1} className="h-8 w-8 text-cyan relative z-10" />
                      
                      {/* Scan line */}
                      <div className="absolute inset-x-0 h-px bg-cyan/50 animate-scan-line" />
                    </div>
                  </div>

                  {/* Glow Effect */}
                  <div className="absolute -inset-1 bg-cyan/20 blur-2xl -z-10 opacity-50" />
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 border-y border-white/5">
        <div className="px-4 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {stats.map((stat, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="text-center"
                >
                  <div className="font-sora text-3xl md:text-4xl font-bold text-cyan">{stat.value}</div>
                  <div className="mt-1 text-sm text-text-secondary">{stat.label}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24">
        <div className="px-4 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="text-center mb-16">
              <h2 className="font-sora text-3xl md:text-4xl font-bold text-white">
                Built for Precision
              </h2>
              <p className="mt-4 text-text-secondary max-w-2xl mx-auto">
                Our AI-powered platform combines cutting-edge computer vision with 
                human-in-the-loop verification for unmatched exam integrity.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {features.map((feature, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="glass-card p-6 hover:border-cyan/30 transition-colors"
                >
                  <div className="h-12 w-12 rounded-xl bg-cyan/10 flex items-center justify-center mb-4">
                    <feature.icon className="h-6 w-6 text-cyan" />
                  </div>
                  <h3 className="font-sora text-xl font-semibold text-white mb-2">{feature.title}</h3>
                  <p className="text-text-secondary">{feature.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-24 bg-navy-800/30">
        <div className="px-4 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="text-center mb-16">
              <h2 className="font-sora text-3xl md:text-4xl font-bold text-white">
                Three Steps to Secure Exams
              </h2>
              <p className="mt-4 text-text-secondary">
                Set up in an hour. Run exams at scale.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                { step: '01', title: 'Configure', desc: 'Set rules, ID checks, and browser policies per exam.' },
                { step: '02', title: 'Invite', desc: 'Candidates verify identity and pair their mobile camera.' },
                { step: '03', title: 'Monitor', desc: 'Review live telemetry, chat, and escalate when needed.' },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="relative"
                >
                  <div className="font-mono text-5xl font-bold text-cyan/20 mb-4">{item.step}</div>
                  <h3 className="font-sora text-xl font-semibold text-white mb-2">{item.title}</h3>
                  <p className="text-text-secondary">{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-24">
        <div className="px-4 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="text-center mb-16">
              <h2 className="font-sora text-3xl md:text-4xl font-bold text-white">
                What Institutions Say
              </h2>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {testimonials.map((testimonial, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="glass-card p-6"
                >
                  <div className="flex gap-1 mb-4">
                    {[...Array(5)].map((_, j) => (
                      <Star strokeWidth={1} key={j} className="h-4 w-4 text-cyan fill-cyan" />
                    ))}
                  </div>
                  <p className="text-lg text-white/90 mb-6">"{testimonial.quote}"</p>
                  <div>
                    <p className="font-medium text-white">{testimonial.author}</p>
                    <p className="text-sm text-text-secondary">{testimonial.role}</p>
                    <p className="text-sm text-cyan">{testimonial.institution}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-navy-800/30">
        <div className="px-4 lg:px-8">
          <div className="mx-auto max-w-4xl text-center">
            <h2 className="font-sora text-3xl md:text-4xl font-bold text-white mb-4">
              Ready to Secure Your Exams?
            </h2>
            <p className="text-text-secondary mb-8 max-w-2xl mx-auto">
              Join hundreds of institutions running fair, scalable assessments with SecureGuard Pro.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <button 
                onClick={() => navigate('/login')}
                className="btn-primary flex items-center gap-2"
              >
                Request a Demo
                <ArrowRight strokeWidth={1} className="h-4 w-4" />
              </button>
              <button className="btn-outline">
                Talk to Sales
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-white/5">
        <div className="px-4 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="grid md:grid-cols-4 gap-8 mb-12">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan/10">
                    <Shield strokeWidth={1} className="h-6 w-6 text-cyan" />
                  </div>
                  <span className="font-sora text-lg font-bold text-white">SecureGuard</span>
                </div>
                <p className="text-sm text-text-secondary">
                  AI-powered exam proctoring for the modern education era.
                </p>
              </div>
              
              <div>
                <h4 className="font-medium text-white mb-4">Product</h4>
                <ul className="space-y-2 text-sm text-text-secondary">
                  <li><a href="#" className="hover:text-white transition-colors">Features</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">Pricing</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">Security</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">Integrations</a></li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-medium text-white mb-4">Resources</h4>
                <ul className="space-y-2 text-sm text-text-secondary">
                  <li><a href="#" className="hover:text-white transition-colors">Documentation</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">API Reference</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">Case Studies</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-medium text-white mb-4">Support</h4>
                <ul className="space-y-2 text-sm text-text-secondary">
                  <li><a href="#" className="hover:text-white transition-colors">Help Center</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">Contact Us</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">Status</a></li>
                </ul>
              </div>
            </div>
            
            <div className="flex flex-col md:flex-row justify-between items-center pt-8 border-t border-white/5">
              <p className="text-sm text-text-secondary">
                Â© 2024 SecureGuard Pro. A collaborative effort by the team. All rights reserved.
              </p>
              <div className="flex items-center gap-6 mt-4 md:mt-0">
                <a href="#" className="text-sm text-text-secondary hover:text-white transition-colors">Privacy</a>
                <a href="#" className="text-sm text-text-secondary hover:text-white transition-colors">Terms</a>
                <a href="#" className="text-sm text-text-secondary hover:text-white transition-colors">Cookies</a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
