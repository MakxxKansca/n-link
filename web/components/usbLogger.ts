export interface UsbLogItem {
  time: string;
  cmd: string;
  details: string;
  result: 'OK' | 'ERROR' | 'INFO';
  error?: string;
  dataHex?: string;
  rawSlice?: Uint8Array;
}

export class UsbDiagnostics {
  logs: UsbLogItem[] = [];
  lastErrorDetails: {
    name?: string;
    message?: string;
    stack?: string;
    cmd?: string;
    phase?: string;
  } = {};

  log(cmd: string, details: any, result: 'OK' | 'ERROR' | 'INFO', error?: any, data?: Uint8Array) {
    const item: UsbLogItem = {
      time: '',
      cmd,
      details: typeof details === 'string' ? details : JSON.stringify(details),
      result,
      error: error ? (error.message || String(error)) : undefined,
      rawSlice: data ? data.slice(0, 32) : undefined,
    };

    this.logs.push(item);
    if (this.logs.length > 50) {
      this.logs.shift();
    }

    if (result === 'ERROR') {
      const now = new Date();
      item.time = now.toTimeString().split(' ')[0] + '.' + now.getMilliseconds().toString().padStart(3, '0');
      this.lastErrorDetails = {
        name: error?.name,
        message: error?.message || String(error),
        stack: error?.stack,
        cmd,
      };
      console.error('[USB ERROR] ' + item.time + ' ' + cmd + ':', details, error);
    }
  }

  getRecentLogs(): UsbLogItem[] {
    const now = new Date();
    const timeBase = now.toTimeString().split(' ')[0];
    return this.logs.map((l) => {
      let dataHex = '';
      if (l.rawSlice && l.rawSlice.length > 0) {
        dataHex = Array.from(l.rawSlice).map(b => b.toString(16).padStart(2, '0')).join(' ');
      }
      return {
        ...l,
        time: l.time || timeBase,
        dataHex,
      };
    });
  }

  clear() {
    this.logs = [];
    this.lastErrorDetails = {};
  }

  async sendToServer() {
    try {
      await fetch('/api/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          time: new Date().toISOString(),
          logs: this.getRecentLogs(),
          lastError: this.lastErrorDetails,
        }),
      });
    } catch (_) {}
  }
}

export const usbDiag = new UsbDiagnostics();
(globalThis as any).__USB_DIAG__ = usbDiag;
