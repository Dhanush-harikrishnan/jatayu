import { Request, Response, NextFunction } from 'express';
import { dynamoClient } from '../services/awsService';
import { ScanCommand } from '@aws-sdk/client-dynamodb';

export const getAdminStudents = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const command = new ScanCommand({
      TableName: 'SecureGuardUsers',
      FilterExpression: '#role = :roleVal',
      ExpressionAttributeNames: { '#role': 'role' },
      ExpressionAttributeValues: { ':roleVal': { S: 'student' } }
    });
    
    const result = await dynamoClient.send(command);
    
    const students = result.Items?.map(item => ({
      sessionId: item.email.S || `session-${Date.now()}`,
      studentId: item.email.S || 'unknown',
      studentName: item.name?.S || item.email.S?.split('@')[0] || 'Unknown User',
      examId: 'EXAM-101',
      status: 'online', // Keep as online for monitoring demo
      joinTime: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      lastActivity: new Date().toISOString(),
      violationCount: 0
    })) || [];

    res.json({ success: true, data: students });
  } catch (error) {
    next(error);
  }
};

export const getAdminViolations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const command = new ScanCommand({
      TableName: 'ProctoringEvents'
    });
    
    const result = await dynamoClient.send(command);

    const violations = (result.Items || [])
      .filter((item: any) => item.ViolationType?.S && item.ViolationType.S !== 'undefined' && item.ViolationType.S !== 'TEST_VIOLATION')
      .map((item: any) => ({
        id: item.EventTime?.S || new Date().toISOString(),
        sessionId: item.SessionId?.S || 'unknown-session',
        timestamp: item.EventTime?.S || new Date().toISOString(),
        type: item.ViolationType?.S as string,
        severity: item.ViolationType?.S === 'MULTIPLE_PERSONS_DETECTED' ? 'high' : 'medium',
        description: `AI detected: ${item.ViolationType?.S?.replace(/_/g, ' ') || 'Anomaly'}`,
        status: 'unresolved',
        anomalyScore: 85,
        metadata: item.Metadata?.S ? JSON.parse(item.Metadata.S) : { confidence: 1 }
      }));

    // Sort by newest first
    violations.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    res.json({ success: true, data: violations });
  } catch (error) {
    next(error);
  }
};

export const getStudentExams = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Returning a realistic exam payload until an Exams table is created
    const exams = [
      {
        id: 'EXAM-101',
        title: 'Introduction to Computer Science',
        description: 'Covers basic algorithms, data structures, and software engineering principles.',
        startTime: new Date().toISOString(),
        duration: 120,
        totalQuestions: 50,
        status: 'active',
        instructions: ['Ensure your webcam is on', 'Close all other applications', 'No bathroom breaks allowed']
      },
      {
        id: 'EXAM-102',
        title: 'Advanced Mathematics',
        description: 'Calculus, linear algebra, and discrete mathematics.',
        startTime: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2).toISOString(),
        duration: 180,
        totalQuestions: 40,
        status: 'upcoming',
        instructions: []
      }
    ];
    res.json({ success: true, data: exams });
  } catch (error) {
    next(error);
  }
};
