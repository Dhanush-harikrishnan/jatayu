import { Request, Response } from 'express';
import { awsService } from '../services/awsService';
import { v4 as uuidv4 } from 'uuid';

export const createQuestion = async (req: Request, res: Response) => {
  try {
    const questionData = {
      questionId: uuidv4(),
      ...req.body
    };
    const newQuestion = await awsService.createQuestion(questionData);
    res.status(201).json(newQuestion);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Server Error' });
  }
};

export const batchCreateQuestions = async (req: Request, res: Response) => {
  try {
    const { questions } = req.body;
    if (!Array.isArray(questions)) return res.status(400).json({ error: 'Questions must be an array' });

    // Step 9: Validate batch questions
    const errors: string[] = [];
    questions.forEach((q, index) => {
      if (!q.examId) errors.push(`Question ${index}: Missing examId`);
      if (!q.sectionType) errors.push(`Question ${index}: Missing sectionType`);
      if (!q.text || typeof q.text !== 'string' || !q.text.trim()) errors.push(`Question ${index}: Missing or empty text`);
      
      if (q.sectionType === 'CODING') {
        if (!q.codingConfig) {
          errors.push(`Question ${index}: Coding questions must include codingConfig`);
        } else {
          if (!q.codingConfig.language) errors.push(`Question ${index}: Coding config must specify a language`);
          if (!Array.isArray(q.codingConfig.testCases) || q.codingConfig.testCases.length === 0) {
            errors.push(`Question ${index}: Coding config must have at least 1 testCase`);
          }
        }
      }
    });

    if (errors.length > 0) {
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }

    const questionsWithIds = questions.map(q => ({
      questionId: uuidv4(),
      ...q
    }));

    await awsService.batchCreateQuestions(questionsWithIds);
    res.status(201).json(questionsWithIds);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Server Error' });
  }
};

export const getQuestionsByExamId = async (req: Request, res: Response) => {
  try {
    const { examId } = req.params;
    const questions = await awsService.getQuestionsByExamId(examId);

    // If student, strip correct answers to prevent cheating
    const isStudent = (req as any).user?.role === 'student';
    
    if (isStudent) {
      const sanitizedQuestions = questions.map((q: any) => {
        const { correctAnswer, ...rest } = q;
        return rest;
      });
      return res.status(200).json(sanitizedQuestions);
    }

    res.status(200).json(questions);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Server Error' });
  }
};

export const updateQuestion = async (req: Request, res: Response) => {
  try {
    const { questionId } = req.params;
    const updatedQuestion = await awsService.updateQuestion(questionId, req.body);
    res.status(200).json(updatedQuestion);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Server Error' });
  }
};

export const deleteQuestion = async (req: Request, res: Response) => {
  try {
    const { questionId } = req.params;
    await awsService.deleteQuestion(questionId);
    res.status(200).json({ message: 'Question deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Server Error' });
  }
};