import { useState, useEffect } from 'react';
import { 
  BarChart3, PieChart, Activity, Clock, 
  Users, AlertTriangle, Download, ArrowLeft
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart as RePieChart, Pie, Cell, Legend,
  BarChart, Bar
} from 'recharts';

interface AnalyticsData {
  violationTimeData: any[];
  violationTypeData: any[];
  scoreDistribution: any[];
  stats: {
    completionRate: number;
    avgTimePerQuestion: number;
    activeViolations: number;
    criticalRisks: number;
  };
}

export function AdminAnalytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const res = await fetchApi('/admin/analytics');
      setData(res.data);
    } catch (err) {
      console.error('Failed to load analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (!data) return;
    
    // Generate CSV for violation time data
    const headers = ['Time', 'Tab Switch', 'Face Missing', 'Multiple Faces'];
    const csvContent = [
      headers.join(','),
      ...data.violationTimeData.map(row => 
        `${row.time},${row.tabSwitch},${row.faceMissing},${row.multipleFaces}`
      )
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'analytics_export.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading || !data) {
    return (
      <div className="flex h-screen items-center justify-center bg-navy-900">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-cyan border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-navy-900 text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-white/5 bg-navy-800/50 p-4 lg:px-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => window.location.href = '/admin/dashboard'}
            className="p-2 -ml-2 rounded-lg hover:bg-white/5 transition-colors text-white/60 hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-xl font-sora font-semibold flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-cyan" />
              Post-Exam Analytics
            </h1>
            <p className="text-sm text-white/60">Comprehensive insights and metrics</p>
          </div>
        </div>

        <button 
          onClick={handleExportCSV}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan/20 text-cyan hover:bg-cyan/30 transition-colors font-medium text-sm"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </button>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto p-4 lg:p-6 space-y-6">
        
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard 
            title="Completion Rate" 
            value={`${data.stats.completionRate}%`}
            icon={<Activity className="h-5 w-5 text-emerald-400" />}
            trend="+5% from last week"
            trendUp
          />
          <StatCard 
            title="Avg Time / Question" 
            value={`${data.stats.avgTimePerQuestion}m`}
            icon={<Clock className="h-5 w-5 text-cyan" />}
          />
          <StatCard 
            title="Active Violations" 
            value={data.stats.activeViolations.toString()}
            icon={<AlertTriangle className="h-5 w-5 text-warning" />}
            trend="-2% vs average"
            trendUp={false}
          />
          <StatCard 
            title="Critical Risks" 
            value={data.stats.criticalRisks.toString()}
            icon={<Users className="h-5 w-5 text-violation" />}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Violation Frequency Chart */}
          <div className="lg:col-span-2 glass-card p-5 rounded-xl border border-white/10">
            <h3 className="font-sora font-semibold mb-6 flex items-center gap-2">
              <Activity className="h-4 w-4 text-cyan" />
              Violation Frequency Over Time
            </h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.violationTimeData}>
                  <defs>
                    <linearGradient id="colorTab" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorFace" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                  <XAxis dataKey="time" stroke="#ffffff40" fontSize={12} tickMargin={10} />
                  <YAxis stroke="#ffffff40" fontSize={12} tickMargin={10} />
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Area type="monotone" dataKey="tabSwitch" name="Tab Switches" stroke="#06b6d4" strokeWidth={2} fillOpacity={1} fill="url(#colorTab)" />
                  <Area type="monotone" dataKey="faceMissing" name="Face Missing" stroke="#f59e0b" strokeWidth={2} fillOpacity={1} fill="url(#colorFace)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Violation Types Donut */}
          <div className="glass-card p-5 rounded-xl border border-white/10">
            <h3 className="font-sora font-semibold mb-6 flex items-center gap-2">
              <PieChart className="h-4 w-4 text-cyan" />
              Distribution Types
            </h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RePieChart>
                  <Pie
                    data={data.violationTypeData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {data.violationTypeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                </RePieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Trust Score Histogram */}
          <div className="lg:col-span-3 glass-card p-5 rounded-xl border border-white/10">
            <h3 className="font-sora font-semibold mb-6 flex items-center gap-2">
              <Users className="h-4 w-4 text-cyan" />
              Trust Score Distribution
            </h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.scoreDistribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                  <XAxis dataKey="range" stroke="#ffffff40" fontSize={12} tickMargin={10} />
                  <YAxis stroke="#ffffff40" fontSize={12} tickMargin={10} />
                  <RechartsTooltip cursor={{fill: '#ffffff05'}} contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px' }} />
                  <Bar dataKey="count" name="Students" fill="#10b981" radius={[4, 4, 0, 0]}>
                    {data.scoreDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={
                        entry.range === '<60' ? '#ef4444' : 
                        entry.range === '60-69' || entry.range === '70-79' ? '#f59e0b' : '#10b981'
                      } />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}

function StatCard({ title, value, icon, trend, trendUp }: any) {
  return (
    <div className="glass-card p-5 rounded-xl border border-white/10 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-white/60 text-sm font-medium">{title}</span>
        <div className="h-10 w-10 rounded-lg bg-white/5 flex items-center justify-center">
          {icon}
        </div>
      </div>
      <div>
        <div className="text-3xl font-sora font-bold text-white">{value}</div>
        {trend && (
          <div className={`text-xs mt-2 font-medium ${trendUp ? 'text-emerald-400' : 'text-warning'}`}>
            {trend}
          </div>
        )}
      </div>
    </div>
  );
}
