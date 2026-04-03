import { useEffect, useState } from 'react';
import { Shield, CheckCircle, AlertTriangle, LayoutDashboard } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchApi } from '@/lib/api';

interface Violation {
  violationType: string;
  timestamp: string;
  evidenceKey?: string;
  evidenceUrl?: string; // This would typically be resolved by backend, or frontend needs to fetch presigned URL
}

export function ExamReport() {
  const [violations, setViolations] = useState<Violation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const searchParams = new URLSearchParams(window.location.search);
  const sessionId = searchParams.get('sessionId') || '';

  useEffect(() => {
    if (!sessionId) {
      setError('No session ID provided');
      setLoading(false);
      return;
    }

    const loadReport = async () => {
      try {
        const res = await fetchApi(`/dashboard/violations/${sessionId}`);
        if (res?.success && Array.isArray(res?.data)) {
          setViolations(res.data);
        } else {
          setError('Failed to load exam report.');
        }
      } catch (err) {
        setError('Network error loading report.');
      } finally {
        setLoading(false);
      }
    };

    loadReport();
  }, [sessionId]);

  const severityColor = (type: string) => {
    switch (type) {
      case 'MULTIPLE_PERSONS_DETECTED':
      case 'PHONE_DETECTED':
      case 'BOOK_DETECTED':
      case 'TAB_SWITCH':
      case 'COPY_PASTE':
      case 'MULTIPLE_LAPTOPS_DETECTED':
      case 'MULTIPLE_PERSONS_DETECTED_MOBILE':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-amber-100 text-amber-800';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-10 px-4">
      <div className="w-full max-w-4xl space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center">
            <CheckCircle className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900">Exam Completed</h1>
          <p className="text-slate-500">Your session has been successfully submitted and reviewed.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Proctoring Report</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            ) : error ? (
              <div className="text-center py-10 text-red-500">{error}</div>
            ) : violations.length === 0 ? (
              <div className="text-center py-10">
                <Shield className="w-12 h-12 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-900">Zero Violations</h3>
                <p className="text-slate-500">No suspicious activities were detected during your exam.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle className="text-amber-500 w-5 h-5" />
                  <span className="font-semibold text-slate-800">{violations.length} Flags Detected</span>
                </div>
                {violations.map((v, i) => (
                  <div key={i} className="flex gap-4 p-4 border border-slate-200 rounded-lg bg-white shadow-sm">
                    {v.evidenceUrl ? (
                      <img src={v.evidenceUrl} alt="Evidence" className="w-32 h-24 object-cover rounded-md bg-slate-100 border" />
                    ) : (
                      <div className="w-32 h-24 bg-slate-100 rounded-md border flex items-center justify-center flex-shrink-0">
                        <span className="text-xs text-slate-400">No Image</span>
                      </div>
                    )}
                    <div className="flex flex-col justify-center">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className={severityColor(v.violationType)}>{v.violationType}</Badge>
                      </div>
                      <p className="text-sm text-slate-500 font-mono">
                        {new Date(v.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            <div className="mt-8 flex justify-center">
              <Button onClick={() => window.location.href = '/dashboard'} className="flex items-center gap-2">
                <LayoutDashboard className="w-4 h-4" /> Back to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
