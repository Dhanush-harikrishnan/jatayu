import { useState } from 'react';
import Editor from '@monaco-editor/react';
import { Play, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';

interface TestResult {
  input: string;
  expected: string;
  actual?: string;
  passed?: boolean;
  error?: string;
  status: 'pending' | 'running' | 'completed';
}

interface CodingQuestionProps {
  question: any;
  answer: string;
  onAnswerChange: (code: string) => void;
}

export function CodingQuestion({ question, answer, onAnswerChange }: CodingQuestionProps) {
  const language = question.codingConfig?.language || 'javascript';
  const starterCode = question.codingConfig?.starterCode || '';
  const testCases = question.codingConfig?.testCases || [];

  const [results, setResults] = useState<TestResult[]>(
    testCases.map((tc: any) => ({
      input: tc.input,
      expected: tc.expectedOutput,
      status: 'pending'
    }))
  );
  
  const [isRunning, setIsRunning] = useState(false);

  const runTests = async () => {
    setIsRunning(true);
    
    if (language === 'javascript') {
      try {
        const userFunc = new Function('input', `
          ${answer}
          if (typeof main !== 'undefined') return main(input);
          return null;
        `);
        
        const newResults = results.map(r => {
          try {
            const actual = String(userFunc(r.input));
            return {
              ...r,
              actual,
              passed: actual === String(r.expected).trim(),
              status: 'completed' as const
            };
          } catch (err: any) {
            return {
              ...r,
              error: err.message,
              passed: false,
              status: 'completed' as const
            };
          }
        });
        
        setResults(newResults);
      } catch (err: any) {
        setResults(results.map(r => ({
          ...r,
          error: `Syntax Error: ${err.message}`,
          passed: false,
          status: 'completed'
        })));
      }
    } else {
      // Simulate remote execution for non-JS languages
      const newResults = results.map(r => ({
        ...r,
        status: 'completed' as const,
        actual: 'Submitted for evaluation',
        passed: undefined, // pending backend check
        error: 'Remote execution not available in local mode'
      }));
      setResults(newResults);
    }
    
    setIsRunning(false);
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 bg-cyan/20 text-cyan text-xs font-semibold rounded uppercase">
            {language}
          </span>
          <span className="text-xs text-white/50 border border-white/10 px-2 py-0.5 rounded">
            Time Limit: {question.codingConfig?.timeLimit || 2000}ms
          </span>
        </div>
        <Button 
          onClick={runTests} 
          disabled={isRunning || !answer.trim()}
          className="bg-cyan hover:bg-cyan/80 text-black text-xs h-8"
        >
          <Play className="w-3.5 h-3.5 mr-1" />
          {isRunning ? 'Running...' : 'Run Tests'}
        </Button>
      </div>

      <div className="border border-cyan/20 rounded-md overflow-hidden flex-grow min-h-[400px]">
        <Editor
          height="100%"
          language={language}
          theme="vs-dark"
          value={answer || starterCode}
          onChange={(val) => onAnswerChange(val || '')}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            padding: { top: 16 },
            fontFamily: "'JetBrains Mono', monospace",
          }}
        />
      </div>

      <div className="bg-cyan/5 border border-cyan/20 rounded-md p-4">
        <h4 className="text-sm font-semibold text-cyan mb-3">Test Cases</h4>
        <div className="grid gap-3">
          {results.map((res, i) => (
            <div key={i} className="flex flex-col gap-2 p-3 bg-black/50 border border-white/5 rounded">
              <div className="flex justify-between items-start">
                <div className="text-xs font-mono">
                  <span className="text-white/50">Input:</span> <span className="text-white">{res.input}</span>
                </div>
                <div className="text-xs font-mono">
                  <span className="text-white/50">Expected:</span> <span className="text-emerald-400">{res.expected}</span>
                </div>
                {res.status === 'completed' && (
                  <div>
                    {res.passed === true ? (
                      <CheckCircle className="w-4 h-4 text-emerald-500" />
                    ) : res.passed === false ? (
                      <XCircle className="w-4 h-4 text-rose-500" />
                    ) : (
                      <span className="text-[10px] text-white/50 uppercase">Evaluated on submit</span>
                    )}
                  </div>
                )}
              </div>
              
              {res.status === 'completed' && res.actual && (
                <div className="text-xs font-mono mt-1 pt-2 border-t border-white/5">
                  <span className="text-white/50">Output:</span>{' '}
                  <span className={cn(res.passed ? "text-emerald-400" : "text-rose-400")}>
                    {res.actual}
                  </span>
                </div>
              )}
              {res.error && (
                <div className="text-xs font-mono mt-1 pt-2 border-t border-white/5 text-rose-400">
                  {res.error}
                </div>
              )}
            </div>
          ))}
          {results.length === 0 && (
            <div className="text-xs text-white/50 italic">No test cases provided.</div>
          )}
        </div>
      </div>
    </div>
  );
}
