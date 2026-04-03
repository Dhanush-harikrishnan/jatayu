import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { StudentCard } from '@/types';
import { AlertTriangle } from 'lucide-react';

interface RiskHeatmapProps {
  students: StudentCard[];
  onStudentClick: (student: StudentCard) => void;
}

export function RiskHeatmap({ students, onStudentClick }: RiskHeatmapProps) {
  // Sort students by trustScore (lowest first -> highest risk)
  const sortedStudents = [...students].sort((a, b) => {
    return (a.trustScore ?? 100) - (b.trustScore ?? 100);
  });

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2 p-2">
      {sortedStudents.map((student) => {
        const score = student.trustScore ?? 100;
        
        // Define color and pulse based on score
        let bgColor = '';
        let isPulsing = false;
        
        if (student.status === 'offline') {
          bgColor = 'bg-gray-800 border-gray-700 opacity-50';
        } else if (score >= 80) {
          bgColor = 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400';
        } else if (score >= 50) {
          bgColor = 'bg-warning/20 border-warning/40 text-warning';
          if (score < 65) isPulsing = true;
        } else {
          bgColor = 'bg-violation/30 border-violation/50 text-violation';
          isPulsing = true;
        }

        if (student.status === 'violation') {
           bgColor = 'bg-violation/50 border-violation/80 text-white';
           isPulsing = true;
        }

        return (
          <motion.button
            key={student.sessionId}
            layout
            onClick={() => onStudentClick(student)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={cn(
              "relative group aspect-square rounded-xl border flex flex-col items-center justify-center p-2 transition-all overflow-hidden",
              bgColor,
              isPulsing && "animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.3)]"
            )}
          >
            {/* Score */}
            <div className="text-2xl font-bold font-sora">
              {Math.round(score)}
            </div>
            
            {/* Name */}
            <div className="text-[10px] uppercase tracking-wider font-medium truncate w-full text-center mt-1 opacity-80">
              {student.studentName.split(' ')[0]}
            </div>

            {/* Violation Count Bubble */}
            {student.violationCount > 0 && (
              <div className="absolute top-1 right-1 bg-black/60 rounded-full px-1.5 py-0.5 flex items-center gap-0.5">
                <AlertTriangle className="h-2 w-2 text-violation" />
                <span className="text-[8px] text-white font-bold">{student.violationCount}</span>
              </div>
            )}
            
            {/* Hover Toolkit */}
            <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs font-medium text-white">
              View
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}
