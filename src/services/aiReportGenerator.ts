import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '../logger';

const API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyBoRiZRfD7S9Tx8y3a8jw_dOCJVvCSPw7s';
const genAI = new GoogleGenerativeAI(API_KEY);

export interface AIReportInput {
  studentName: string;
  durationMinutes: number;
  finalTrustScore: number;
  violations: Array<{
    type: string;
    timestamp: string;
    severity?: 'low' | 'medium' | 'high' | 'critical';
  }>;
}

export async function generateAIReportSummary(input: AIReportInput): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' }); 

    let prompt = `You are an AI proctoring assistant analyzing an exam. Write a concise, professional paragraph summarising the student's behavior and risk level.\n`;
    prompt += `Student Name: ${input.studentName}\n`;
    prompt += `Duration: ${input.durationMinutes} min\n`;
    prompt += `Final Trust Score: ${input.finalTrustScore}/100\n`;
    prompt += `Total Violations: ${input.violations.length}\n`;
    prompt += `Violations:\n`;
    input.violations.forEach(v => prompt += `- [${v.timestamp}] ${v.type} (${v.severity || 'unknown'})\n`);
    prompt += `Be objective. If score is high/no severe violations, state LOW RISK. If multiple or severe cheating violations, state HIGH RISK. Keep it to 3-4 sentences.`;

    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (error) {
    logger.error('Error generating AI report summary:', error);
    return 'AI generation failed or was unavailable for this session. Please review the violation log manually.';
  }
}