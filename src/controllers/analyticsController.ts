import { Request, Response, NextFunction } from 'express';
import { dynamoClient } from '../services/awsService';
import { ScanCommand } from '@aws-sdk/client-dynamodb';
import { config } from '../config/env';

export const getAnalytics = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Generate realistic mock data for the demo
    const violationTimeData = [
      { time: '09:00', tabSwitch: 2, faceMissing: 1, multipleFaces: 0 },
      { time: '09:15', tabSwitch: 5, faceMissing: 2, multipleFaces: 1 },
      { time: '09:30', tabSwitch: 3, faceMissing: 4, multipleFaces: 0 },
      { time: '09:45', tabSwitch: 8, faceMissing: 1, multipleFaces: 2 },
      { time: '10:00', tabSwitch: 12, faceMissing: 3, multipleFaces: 1 },
      { time: '10:15', tabSwitch: 4, faceMissing: 1, multipleFaces: 0 },
      { time: '10:30', tabSwitch: 1, faceMissing: 0, multipleFaces: 0 }
    ];

    const violationTypeData = [
      { name: 'Tab Switch', value: 45, fill: '#06b6d4' },
      { name: 'Face Missing', value: 25, fill: '#f59e0b' },
      { name: 'Multiple Faces', value: 10, fill: '#ef4444' },
      { name: 'Phone Detected', value: 5, fill: '#8b5cf6' },
      { name: 'Looking Away', value: 15, fill: '#3b82f6' }
    ];

    const scoreDistribution = [
      { range: '90-100', count: 45 },
      { range: '80-89', count: 25 },
      { range: '70-79', count: 15 },
      { range: '60-69', count: 8 },
      { range: '<60', count: 7 }
    ];

    const stats = {
      completionRate: 92,
      avgTimePerQuestion: 2.4, // minutes
      activeViolations: 12,
      criticalRisks: 4
    };

    res.json({
      success: true,
      data: {
        violationTimeData,
        violationTypeData,
        scoreDistribution,
        stats
      }
    });
  } catch (error) {
    next(error);
  }
};
