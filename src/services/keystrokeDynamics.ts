import { logger } from '../logger';
import { config } from '../config/env';

// In-memory store for keystroke baselines per session
// For production, consider using Redis if scaling across multiple Node instances
interface BaselineSession {
  count: number;
  // Let's assume vectors are numerical features (e.g. [dwellTime, flightTime])
  // We'll calculate the running mean and variance (M2) using Welford's online algorithm
  means: number[];
  M2s: number[];
}

const baselines = new Map<string, BaselineSession>();

export const analyzeKeystrokes = async (sessionId: string, vectors: number[]): Promise<number> => {
  try {
    if (!vectors || vectors.length === 0) {
      return 0; // Baseline score
    }

    let session = baselines.get(sessionId);
    if (!session) {
      session = {
        count: 0,
        means: new Array(vectors.length).fill(0),
        M2s: new Array(vectors.length).fill(0),
      };
      baselines.set(sessionId, session);
    }

    // Welford's online algorithm for computing mean and variance
    session.count += 1;
    let anomalyScore = 0; // 0 = normal, positive = more anomalous (z-score based)
    let isAnomalous = false;

    // We calculate a composite z-score if we have enough baseline data
    let totalZScore = 0;

    for (let i = 0; i < vectors.length; i++) {
      const val = vectors[i];
      // Ensure arrays are long enough if dynamic length
      if (typeof session.means[i] === 'undefined') {
        session.means[i] = 0;
        session.M2s[i] = 0;
      }

      const mean = session.means[i];
      const M2 = session.M2s[i];
      
      // Calculate population variance for the current feature
      if (session.count > config.thresholds.keystrokeBaselineCount) {
        const variance = M2 / session.count;
        const stddev = Math.sqrt(variance);
        
        // Calculate z-score
        // If stddev is 0, we can't really compute a standard score, default to 0
        const zScore = stddev > 0 ? Math.abs((val - mean) / stddev) : 0;
        totalZScore += zScore;
      }

      // Update baseline running formulas
      const delta = val - mean;
      session.means[i] += delta / session.count;
      const delta2 = val - session.means[i];
      session.M2s[i] += delta * delta2;
    }

    if (session.count > config.thresholds.keystrokeBaselineCount) {
      const averageZScore = totalZScore / vectors.length;
      
      // We will map 0-2 (normal) to e.g. 0 to 0.5
      // Maps > 2 it to > 0.5 ... anomaly thresholds. 
      // The old mock code returned -1 to 1 (score).
      // If we want consistent semantics, let's say score > 0 is anomalous? 
      // Let's map average Z > 2 to a high anomaly score, e.g. 0.8
      // and normal to a negative or around 0 score.
      anomalyScore = (averageZScore - 1) / 2; // Z=1 -> 0, Z=2 -> 0.5, Z=3 -> 1.0
      
      // Put a bound
      anomalyScore = Math.max(-1, Math.min(1, anomalyScore));
    } else {
      // Still training baseline
      anomalyScore = -1.0; 
    }
    
    return anomalyScore;
  } catch (err) {
    logger.error('Keystroke dynamics analysis failed', err);
    throw new Error('Keystroke dynamics analysis failed');
  }
};
