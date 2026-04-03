export class VoiceDetector {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private microphone: MediaStreamAudioSourceNode | null = null;
  private checkInterval: ReturnType<typeof setInterval> | null = null;
  private onVoiceDetected: (volume: number) => void;
  private isRunning = false;
  private stream: MediaStream | null = null;
  
  constructor(onVoiceDetected: (volume: number) => void) {
    this.onVoiceDetected = onVoiceDetected;
  }

  public async start() {
    if (this.isRunning) return;
    
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.minDecibels = -90;
      this.analyser.maxDecibels = -10;
      this.analyser.smoothingTimeConstant = 0.85;

      this.microphone = this.audioContext.createMediaStreamSource(this.stream);
      this.microphone.connect(this.analyser);

      this.analyser.fftSize = 1024;
      const bufferLength = this.analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      this.isRunning = true;

      let consecutiveFrames = 0;

      this.checkInterval = setInterval(() => {
        if (!this.isRunning || !this.analyser) return;

        this.analyser.getByteFrequencyData(dataArray);

        // Calculate average volume in speech frequencies (roughly 300Hz to 3400Hz)
        let sum = 0;
        let count = 0;
        
        // At 44.1kHz / 1024 fft = ~43Hz per bin.
        // We want bins roughly from 7 to 80
        for (let i = 7; i < 80; i++) {
          sum += dataArray[i];
          count++;
        }
        
        const averageVolume = sum / count;

        if (averageVolume > 40) { // Threshold for "voice"
          consecutiveFrames++;
          if (consecutiveFrames > 3) {
            // Sustained voice activity detected
            this.onVoiceDetected(averageVolume);
            consecutiveFrames = 0; // Reset after emission to avoid spam
          }
        } else {
          consecutiveFrames = Math.max(0, consecutiveFrames - 1);
        }
      }, 500);

    } catch (err) {
      console.error("Microphone access denied or error:", err);
    }
  }

  public stop() {
    this.isRunning = false;
    if (this.checkInterval) clearInterval(this.checkInterval);
    if (this.audioContext) this.audioContext.close();
    if (this.stream) this.stream.getTracks().forEach(t => t.stop());
    
    this.checkInterval = null;
    this.audioContext = null;
    this.stream = null;
  }
}
