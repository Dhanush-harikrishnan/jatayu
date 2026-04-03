const fs = require('fs');

let code = fs.readFileSync('src/pages/LiveProctoring.tsx', 'utf8');

const startTag = '      {/* Main Content Area - Split Layout */}';
const endTag = '        {/* Right Side - Picture-in-Picture feeds */}';

const startIdx = code.indexOf(startTag);
const endIdx = code.indexOf(endTag);

const newLayout = `      {/* Main Content Area - Split Layout */}
      <main className="flex-1 mt-32 mb-4 mx-4 flex gap-6 relative">
        {/* Left Nav - Section Switcher */}
        <div className="w-56 bg-white border border-slate-200 shadow-sm rounded-xl p-4 flex flex-col hidden lg:flex">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4 px-2">Sections</h3>
            <div className="space-y-2">
                {availableSections.map(sec => (
                    <button
                        key={sec}
                        onClick={() => {
                            setActiveSection(sec);
                            setCurrentQuestionIdx(0);
                        }}
                        className={cn(
                            "w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                            activeSection === sec ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50"
                        )}
                    >
                        {sec}
                    </button>
                ))}
            </div>
            
            <div className="mt-8">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4 px-2">Progress</h3>
                <div className="grid grid-cols-4 gap-2 px-2">
                    {sectionQuestions.map((q, idx) => (
                        <button
                            key={idx}
                            onClick={() => setCurrentQuestionIdx(idx)}
                            className={cn(
                                "w-8 h-8 rounded flex items-center justify-center text-xs font-medium transition-colors",
                                idx === currentQuestionIdx ? "bg-blue-600 text-white" :
                                answers[q.id || idx] !== undefined ? "bg-blue-50 text-blue-600 border border-blue-200" : "bg-slate-100 text-slate-500 border border-transparent hover:border-slate-300"
                            )}
                        >
                            {idx + 1}
                        </button>
                    ))}
                </div>
            </div>
        </div>

        {/* Center - The Exam Interface */}
        <div className="flex-1 bg-white border border-slate-200 shadow-sm rounded-xl p-8 flex flex-col relative z-10 w-full max-w-[calc(100vw-350px)]">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-200">
                <h2 className="text-xl font-sora font-semibold text-slate-900">Question {currentQuestionIdx + 1} <span className="text-slate-400 text-base font-normal">of {sectionQuestions.length}</span></h2>
                <div className="bg-slate-100 px-3 py-1 rounded text-xs font-medium text-slate-600">{currentQ?.difficulty?.toUpperCase() || 'MEDIUM'} | {currentQ?.points || 1} PTS</div>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 pb-4">
                {currentQ?.sectionType === 'CODING' ? (
                    <div className="h-full flex flex-col">
                        <p className="text-lg text-slate-800 leading-relaxed mb-4">{currentQ.text}</p>
                        <div className="flex-grow">
                            <CodingQuestion
                                question={currentQ}
                                answer={answers[currentQ.id || currentQuestionIdx] || ''}
                                onAnswerChange={(val) => setAnswers({ ...answers, [currentQ.id || currentQuestionIdx]: val })}
                            />
                        </div>
                    </div>
                ) : (
                    <>
                        <p className="text-xl text-slate-900 leading-relaxed mb-8">{currentQ?.text}</p>
                        <div className={(currentQ?.sectionType === 'APTITUDE' || currentQ?.sectionType === 'LOGICAL') ? "grid grid-cols-1 md:grid-cols-2 gap-4" : "space-y-4"}>
                            {(currentQ?.options || []).map((opt: any, idx: number) => {
                                const qKey = currentQ?.id || currentQuestionIdx;
                                const isSelected = answers[qKey] === idx;
                                return (
                                <button
                                    key={idx}
                                    onClick={() => setAnswers({...answers, [qKey]: idx})}
                                    className={cn(
                                        "w-full text-left p-4 rounded-xl border transition-all duration-200 flex items-center justify-between group",
                                        isSelected ? "bg-blue-100/50 border-blue-600 shadow-sm" : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-100"
                                    )}
                                >
                                    <span className={cn((currentQ?.sectionType === 'APTITUDE' || currentQ?.sectionType === 'LOGICAL') ? "text-base" : "text-lg", isSelected ? "text-blue-600 font-medium" : "text-slate-800")}>{opt}</span>
                                    <div className={cn(
                                        "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ml-3 shrink-0",
                                        isSelected ? "border-blue-600" : "border-slate-300 group-hover:border-slate-400"
                                    )}>
                                        {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />}
                                    </div>
                                </button>
                            )})}
                        </div>
                    </>
                )}
            </div>

            <div className="flex justify-between mt-6 pt-4 border-t border-slate-200">
                <button
                    onClick={() => setCurrentQuestionIdx(i => Math.max(0, i - 1))}
                    disabled={currentQuestionIdx === 0}
                    className="px-6 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 font-semibold transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                    Previous
                </button>
                {currentQuestionIdx < sectionQuestions.length - 1 ? (
                    <button
                        onClick={() => setCurrentQuestionIdx(i => i + 1)}
                        className="px-6 py-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-semibold transition-colors"
                    >
                        Next Question
                    </button>
                ) : (
                    <button
                        onClick={handleEndExam}
                        className="px-6 py-2.5 rounded-lg bg-slate-200 text-slate-900 font-bold hover:bg-slate-300 shadow-[0_0_15px_rgba(46,204,113,0.3)] transition-colors"
                    >
                        Review & Submit
                    </button>
                )}
            </div>
        </div>

`;

if (startIdx !== -1 && endIdx !== -1) {
    code = code.slice(0, startIdx) + newLayout + code.slice(endIdx);
    fs.writeFileSync('src/pages/LiveProctoring.tsx', code);
    console.log('LiveProctoring layout updated.');
} else {
    console.log('Could not find boundaries.');
}

