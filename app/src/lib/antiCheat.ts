export type AntiCheatViolation = 'VM_DETECTED' | 'REMOTE_DESKTOP_DETECTED' | 'DEVTOOLS_DETECTED';

export class AntiCheatEngine {
  private onViolation: (type: AntiCheatViolation, details: string) => void;
  private checkInterval: ReturnType<typeof setInterval> | null = null;
  private devToolsInterval: ReturnType<typeof setTimeout> | null = null;
  private isRunning = false;

  constructor(onViolation: (type: AntiCheatViolation, details: string) => void) {
    this.onViolation = onViolation;
  }

  public start() {
    if (this.isRunning) return;
    this.isRunning = true;

    this.checkVM();
    this.checkRemoteDesktop();
    this.detectDevTools();

    this.checkInterval = setInterval(() => {
      this.checkRemoteDesktop();
    }, 5000);
  }

  public stop() {
    this.isRunning = false;
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    if (this.devToolsInterval) {
      clearTimeout(this.devToolsInterval);
      this.devToolsInterval = null;
    }
  }

  private checkVM() {
    const ua = navigator.userAgent.toLowerCase();
    const suspiciousKeywords = ['vmware', 'virtualbox', 'vbox', 'qemu', 'xen', 'cros', 'linux'];
    const isVMUserAgent = suspiciousKeywords.some(keyword => ua.includes(keyword) && !ua.includes('android'));
    
    // Hardware concurrency is typically exactly 2, 4, 8, 16 on real machines. Odd numbers or very low are suspicious.
    const cores = navigator.hardwareConcurrency || 2;
    // @ts-expect-error - deviceMemory isn't standard
    const mem = navigator.deviceMemory || 4;

    if (isVMUserAgent || (cores === 1 && mem < 2)) {
      this.onViolation('VM_DETECTED', `Suspicious environment detected: ${ua.substring(0, 30)} (Cores: ${cores})`);
    }
  }

  private checkRemoteDesktop() {
    // Check color depth (RDP often reduces to 16 or 8 bit)
    if (window.screen.colorDepth && window.screen.colorDepth <= 16) {
      this.onViolation('REMOTE_DESKTOP_DETECTED', `Low color depth (${window.screen.colorDepth}-bit) often indicates RDP.`);
    }
    
    // Some basic resolution checks - square aspect ratios can also indicate RDP stretch
    if (window.screen.width === window.screen.height && window.screen.width > 0) {
      this.onViolation('REMOTE_DESKTOP_DETECTED', `Suspicious aspect ratio 1:1 (${window.screen.width}x${window.screen.height})`);
    }
  }

  private detectDevTools() {
    // Simple devtools detection using console.log + getter
    const devtoolsDetector = new Image();
    Object.defineProperty(devtoolsDetector, 'id', {
      get: () => {
        if (this.isRunning) {
          this.onViolation('DEVTOOLS_DETECTED', 'DevTools was opened or console inspected');
        }
        return 'devtools';
      }
    });
    
    // Log the image periodically (if the console is open, the getter triggers)
    const check = () => {
       if (!this.isRunning) return;
       console.log('%c', devtoolsDetector);
       this.devToolsInterval = setTimeout(check, 3000);
    };
    check();
  }
}
