export interface TrustScoreEvent {
  type: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  confidence?: number;
}

export class TrustScoreEngine {
  private static instances = new Map<string, TrustScoreEngine>();
  private sessionId: string;
  private currentScore: number = 100;
  private lastUpdate: number = Date.now();
  private readonly RECOVERY_RATE_PER_SECOND = 0.1; // Slowly recover trust over time

  private constructor(sessionId: string) {
    this.sessionId = sessionId;
    
    // Start recovery loop
    setInterval(() => {
      this.recoverScore();
    }, 10000); // Every 10s
  }

  public static getInstance(sessionId: string): TrustScoreEngine {
    if (!this.instances.has(sessionId)) {
      this.instances.set(sessionId, new TrustScoreEngine(sessionId));
    }
    return this.instances.get(sessionId)!;
  }

  public processEvent(event: TrustScoreEvent): number {
    this.recoverScore(); // Apply any pending recovery before new deduction
    
    let penalty = 0;
    
    switch (event.type) {
      case 'TAB_SWITCH':
      case 'OUT_OF_FULLSCREEN':
        penalty = 15;
        break;
      case 'COPY_PASTE':
        penalty = 20;
        break;
      case 'VOICE_DETECTED':
        penalty = event.severity === 'high' ? 25 : 10;
        break;
      case 'MULTIPLE_FACES':
        penalty = 30;
        break;
      case 'PHONE_DETECTED':
      case 'MULTIPLE_LAPTOPS_DETECTED':
        penalty = 35;
        break;
      case 'VM_DETECTED':
      case 'REMOTE_DESKTOP_DETECTED':
      case 'DEVTOOLS_DETECTED':
        penalty = 40;
        break;
        break;
      case 'FACE_NOT_DETECTED':
        penalty = 10;
        break;
      case 'LOOKING_AWAY':
        penalty = 5;
        break;
      case 'KEYSTROKE_ANOMALY':
        penalty = 10;
        break;
      default:
        // Generic severity based
        if (event.severity === 'critical') penalty = 30;
        else if (event.severity === 'high') penalty = 20;
        else if (event.severity === 'medium') penalty = 10;
        else if (event.severity === 'low') penalty = 5;
        break;
    }

    this.currentScore = Math.max(0, this.currentScore - penalty);
    this.lastUpdate = Date.now();
    
    return this.currentScore;
  }
  
  public getScore(): number {
    this.recoverScore();
    return Math.round(this.currentScore);
  }

  private recoverScore(): void {
    const now = Date.now();
    const elapsedSeconds = (now - this.lastUpdate) / 1000;
    
    if (elapsedSeconds > 0 && this.currentScore < 100) {
      // Recover score
      this.currentScore = Math.min(100, this.currentScore + (elapsedSeconds * this.RECOVERY_RATE_PER_SECOND));
    }
    this.lastUpdate = now;
  }
  
  public static removeInstance(sessionId: string): void {
    this.instances.delete(sessionId);
  }
}
