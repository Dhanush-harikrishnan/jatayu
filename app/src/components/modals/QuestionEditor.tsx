import { X, Plus, Trash2 } from 'lucide-react';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

export interface QuestionData {
  id?: string;
  examId?: string;
  sectionType: 'MCQ' | 'CODING' | 'APTITUDE' | 'LOGICAL';
  order: number;
  text: string;
  options: string[];
  correctAnswer: number | string;
  difficulty: 'easy' | 'medium' | 'hard';
  points: number;
  codingConfig?: {
    language: string;
    starterCode: string;
    testCases: { input: string; expectedOutput: string }[];
    timeLimit: number;
  };
}

interface Props {
  question: QuestionData;
  onChange: (q: QuestionData) => void;
  onRemove: () => void;
}

const STARTER_TEMPLATES: Record<string, string> = {
  javascript: 'function main() {\n  \n}',
  python: 'def main():\n  pass',
  java: 'public static void main(String[] args) {\n  \n}',
  cpp: 'int main() {\n  return 0;\n}'
};

const getDefaultPoints = (type: string) => {
  switch (type) {
    case 'MCQ': return 2;
    case 'APTITUDE': return 3;
    case 'LOGICAL': return 3;
    case 'CODING': return 10;
    default: return 1;
  }
};

export function QuestionEditor({ question, onChange, onRemove }: Props) {
  const isCoding = question.sectionType === 'CODING';

  // Step 5: Cap input between 1-100
  const handlePointsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = parseInt(e.target.value) || 1;
    if (val < 1) val = 1;
    if (val > 100) val = 100;
    onChange({ ...question, points: val });
  };

  const handleSectionTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newType = e.target.value as 'MCQ' | 'CODING' | 'APTITUDE' | 'LOGICAL';
    const newPoints = getDefaultPoints(newType);
    let newCodingConfig = question.codingConfig;
    
    // Step 6: Better default testcase when switching to CODING
    if (newType === 'CODING' && !newCodingConfig) {
      newCodingConfig = {
        language: 'javascript',
        timeLimit: 2000,
        starterCode: STARTER_TEMPLATES['javascript'],
        testCases: [{ input: '5', expectedOutput: '25' }]
      };
    }
    
    onChange({ 
      ...question, 
      sectionType: newType,
      points: newPoints,
      codingConfig: newCodingConfig
    });
  };

  return (
    <div className="rounded-lg border border-cyan/20 bg-cyan/5 p-4 mb-4 relative text-left">
      <button 
        type="button"
        onClick={onRemove}
        className="absolute top-4 right-4 p-1 rounded hover:bg-rose-500/20 text-rose-400 transition-colors"
      >
        <Trash2 className="h-4 w-4" />
      </button>

      <div className="grid gap-4 mt-2">
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label className="text-xs text-cyan pr-2">Section</Label>
            <select
              title="Section Type"
              value={question.sectionType}
              onChange={handleSectionTypeChange}
              className="w-full rounded-md border border-cyan/20 bg-black/50 px-3 py-2 text-sm text-white focus:border-cyan focus:outline-none focus:ring-1 focus:ring-cyan"
            >
              <option value="MCQ">MCQ</option>
              <option value="APTITUDE">Aptitude</option>
              <option value="LOGICAL">Logical</option>
              <option value="CODING">Coding</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-cyan pr-2">Difficulty</Label>
            <select
              title="Difficulty"
              value={question.difficulty}
              onChange={e => onChange({ ...question, difficulty: e.target.value as any })}
              className="w-full rounded-md border border-cyan/20 bg-black/50 px-3 py-2 text-sm text-white focus:border-cyan focus:outline-none focus:ring-1 focus:ring-cyan"
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-cyan pr-2">Points</Label>
            <Input 
              type="number" min="1" max="100"
              value={question.points}
              onChange={handlePointsChange}
              placeholder="e.g. 5"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-cyan">Question Text</Label>
          <textarea
            title="Question Text"
            value={question.text}
            onChange={e => onChange({ ...question, text: e.target.value })}
            className="w-full rounded-md border border-cyan/20 bg-black/50 px-3 py-2 text-sm text-white focus:border-cyan focus:outline-none focus:ring-1 focus:ring-cyan h-24 whitespace-pre-wrap"
            placeholder="Enter question text here..."
          />
        </div>

        {!isCoding ? (
          <div className="space-y-3">
            <Label className="text-xs text-cyan">Options & Correct Answer</Label>
            {question.options.map((opt, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <input
                  type="radio" title="Correct Answer"
                  name={`correct-${question.order}`}
                  checked={question.correctAnswer === idx}
                  onChange={() => onChange({ ...question, correctAnswer: idx })}
                  className="h-4 w-4 text-cyan bg-black border-cyan/20 focus:ring-cyan/50"
                />
                <Input
                  value={opt}
                  onChange={e => {
                    const newOpts = [...question.options];
                    newOpts[idx] = e.target.value;
                    onChange({ ...question, options: newOpts });
                  }}
                  placeholder={`Option ${idx + 1}`}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4 border-t border-cyan/10 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-cyan pr-2">Language</Label>
                <select
                  title="Language"
                  value={question.codingConfig?.language || 'javascript'}
                  onChange={e => {
                    const newLang = e.target.value;
                    const prevLang = question.codingConfig?.language || 'javascript';
                    const cfg = question.codingConfig || { language: 'javascript', timeLimit: 2000, starterCode: '', testCases: [] };
                    
                    // Step 4: Auto-fill starter code if empty or matches previous language default
                    let updatedCode = cfg.starterCode;
                    if (!updatedCode || updatedCode.trim() === '' || updatedCode === STARTER_TEMPLATES[prevLang]) {
                      updatedCode = STARTER_TEMPLATES[newLang];
                    }
                    
                    onChange({ ...question, codingConfig: { ...cfg, language: newLang, starterCode: updatedCode } });
                  }}
                  className="w-full rounded-md border border-cyan/20 bg-black/50 px-3 py-2 text-sm text-white focus:border-cyan focus:outline-none focus:ring-1 focus:ring-cyan"
                >
                  <option value="javascript">JavaScript</option>
                  <option value="python">Python</option>
                  <option value="java">Java</option>
                  <option value="cpp">C++</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-cyan pr-2">Time Limit (ms)</Label>
                <Input 
                  type="number" min="1000" step="500"
                  value={question.codingConfig?.timeLimit || 2000}
                  onChange={e => {
                    const cfg = question.codingConfig || { language: 'javascript', timeLimit: 2000, starterCode: '', testCases: [] };
                    onChange({ ...question, codingConfig: { ...cfg, timeLimit: parseInt(e.target.value) || 2000 } });
                  }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-cyan">Starter Code</Label>
              <textarea
                title="Starter Code"
                value={question.codingConfig?.starterCode || ''}
                onChange={e => {
                  const cfg = question.codingConfig || { language: 'javascript', timeLimit: 2000, starterCode: '', testCases: [] };
                  onChange({ ...question, codingConfig: { ...cfg, starterCode: e.target.value } });
                }}
                className="w-full rounded-md border border-cyan/20 bg-black/50 px-3 py-2 text-sm font-mono text-white focus:border-cyan focus:outline-none focus:ring-1 focus:ring-cyan h-32"
                placeholder="def main():..."
              />
            </div>

            <div className="space-y-3">
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-cyan">Test Cases</Label>
                  <button
                    type="button"
                    onClick={() => {
                      const cfg = question.codingConfig || { language: 'javascript', timeLimit: 2000, starterCode: '', testCases: [] };
                      onChange({
                        ...question,
                        codingConfig: {
                          ...cfg,
                          testCases: [...cfg.testCases, { input: '', expectedOutput: '' }]
                        }
                      });
                    }}
                    className="flex items-center gap-1 text-xs text-cyan hover:text-cyan/80 bg-cyan/10 px-2 py-1 rounded"
                  >
                    <Plus className="h-3 w-3" /> Add Test Case
                  </button>
                </div>
                <span className="text-[10px] text-cyan/70">Format: Standard input/output as strings. Ensure leading/trailing spaces are matched exactly.</span>
              </div>
              
              {(question.codingConfig?.testCases || []).map((tc, idx) => (
                <div key={idx} className="flex gap-2 items-start">
                  <Input
                    placeholder="Input (e.g. 5)"
                    value={tc.input}
                    onChange={e => {
                      const newTcs = [...question.codingConfig!.testCases];
                      newTcs[idx].input = e.target.value;
                      onChange({ ...question, codingConfig: { ...question.codingConfig!, testCases: newTcs } });
                    }}
                  />
                  <Input
                    placeholder="Expected Output (e.g. 25)"
                    value={tc.expectedOutput}
                    onChange={e => {
                      const newTcs = [...question.codingConfig!.testCases];
                      newTcs[idx].expectedOutput = e.target.value;
                      onChange({ ...question, codingConfig: { ...question.codingConfig!, testCases: newTcs } });
                    }}
                  />
                  <button
                    title="Remove Test Case"
                    type="button"
                    onClick={() => {
                      const newTcs = question.codingConfig!.testCases.filter((_, i) => i !== idx);
                      onChange({ ...question, codingConfig: { ...question.codingConfig!, testCases: newTcs } });
                    }}
                    className="p-2 text-rose-500/50 hover:text-rose-400 mt-1"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}