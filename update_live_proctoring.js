const fs = require('fs');

let code = fs.readFileSync('app/src/pages/LiveProctoring.tsx', 'utf8');

// Find `const currentQ = QUESTIONS[currentQuestionIdx];` 
// and prepend a null check for QUESTIONS
if (code.includes('const currentQ = QUESTIONS[currentQuestionIdx];')) {
  code = code.replace(
    'const currentQ = QUESTIONS[currentQuestionIdx];',
    `const currentQ = QUESTIONS[currentQuestionIdx];
  if (isLoadingQuestions) {
    return <div className="min-h-screen flex items-center justify-center font-sora p-8 text-xl">Loading exam questions...</div>;
  }
  
  if (!currentQ) {
    return <div className="min-h-screen flex items-center justify-center font-sora p-8 text-xl text-red-500">Error: Could not load questions for this exam.</div>;
  }
`
  );
  fs.writeFileSync('app/src/pages/LiveProctoring.tsx', code);
  console.log('Successfully updated LiveProctoring.tsx');
} else {
  console.log('Could not find currentQ declaration');
}