import { BaseCollector } from './base';

export class ErrorsCollector extends BaseCollector {
  name = 'errors';

  private originalConsoleError: typeof console.error | null = null;
  private onerrorBackup: typeof window.onerror | null = null;
  private rejectionHandler: ((ev: PromiseRejectionEvent) => void) | null = null;

  init(analyzer: any): void {
    super.init(analyzer);
    this.setupWindowOnError();
    this.setupPromiseRejections();
    this.setupConsoleErrorInterceptor();
  }

  destroy(): void {
    super.destroy();
    this.restoreWindowOnError();
    this.restorePromiseRejections();
    this.restoreConsoleErrorInterceptor();
  }

  /**
   * Captures window.onerror uncaught script errors.
   */
  private setupWindowOnError(): void {
    if (typeof window === 'undefined') return;

    this.onerrorBackup = window.onerror;
    window.onerror = (message, source, lineno, colno, error) => {
      this.reportIssue({
        category: 'javascript',
        type: 'runtime-error',
        severity: 'critical',
        title: error?.name || 'Uncaught Runtime Error',
        message: typeof message === 'string' ? message : (message as any).message || 'Unknown runtime error',
        location: {
          line: lineno,
          column: colno,
          fileName: source,
          outerHTML: error?.stack ? error.stack.substring(0, 500) : undefined
        },
        metadata: {
          stack: error?.stack
        }
      });

      // Call original handler if it exists
      if (this.onerrorBackup) {
        return this.onerrorBackup(message, source, lineno, colno, error);
      }
      return false;
    };
  }

  private restoreWindowOnError(): void {
    if (typeof window !== 'undefined' && this.onerrorBackup !== null) {
      window.onerror = this.onerrorBackup;
      this.onerrorBackup = null;
    }
  }

  /**
   * Captures unhandled promise rejections.
   */
  private setupPromiseRejections(): void {
    if (typeof window === 'undefined') return;

    this.rejectionHandler = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      let title = 'Unhandled Promise Rejection';
      let message = 'Promise rejected without rejection handler';
      let stack: string | undefined = undefined;
      let file: string | undefined = undefined;
      let line: number | undefined = undefined;
      let col: number | undefined = undefined;

      if (reason) {
        if (reason instanceof Error) {
          title = reason.name;
          message = reason.message;
          stack = reason.stack;
          
          // Try to parse stack line
          if (stack) {
            const lines = stack.split('\n');
            if (lines.length > 1) {
              const match = lines[1].match(/(http.*):(\d+):(\d+)/);
              if (match) {
                file = match[1];
                line = parseInt(match[2], 10);
                col = parseInt(match[3], 10);
              }
            }
          }
        } else if (typeof reason === 'string') {
          message = reason;
        } else {
          try {
            message = JSON.stringify(reason);
          } catch (e) {
            message = String(reason);
          }
        }
      }

      this.reportIssue({
        category: 'javascript',
        type: 'unhandled-rejection',
        severity: 'high',
        title,
        message,
        location: {
          fileName: file,
          line,
          column: col,
          outerHTML: stack ? stack.substring(0, 500) : undefined
        },
        metadata: {
          stack,
          rawReason: typeof reason === 'object' ? '[Object]' : String(reason)
        }
      });
    };

    window.addEventListener('unhandledrejection', this.rejectionHandler);
  }

  private restorePromiseRejections(): void {
    if (typeof window !== 'undefined' && this.rejectionHandler !== null) {
      window.removeEventListener('unhandledrejection', this.rejectionHandler);
      this.rejectionHandler = null;
    }
  }

  /**
   * Safely patches console.error to capture runtime console logs.
   */
  private setupConsoleErrorInterceptor(): void {
    if (typeof console === 'undefined') return;

    this.originalConsoleError = console.error;
    const self = this;

    console.error = function (...args: any[]) {
      // Execute capture logic inside try-catch to prevent breaking console.error itself
      try {
        const message = args
          .map(arg => {
            if (arg instanceof Error) return arg.message;
            if (typeof arg === 'object') {
              try {
                return JSON.stringify(arg);
              } catch (e) {
                return '[Object]';
              }
            }
            return String(arg);
          })
          .join(' ');

        // Prevent reporting our own SDK internal error logs to avoid infinite loop
        if (!message.includes('[AnalyzerSDK]')) {
          let stack: string | undefined = undefined;
          let file: string | undefined = undefined;
          
          // Capture stack trace from where console.error was called
          const err = new Error();
          if (err.stack) {
            stack = err.stack;
            const lines = stack.split('\n');
            // Index 2 or 3 usually points to the caller of console.error
            const callerLine = lines[2] || '';
            const match = callerLine.match(/(http.*):(\d+):(\d+)/);
            if (match) {
              file = match[1];
            }
          }

          self.reportIssue({
            category: 'javascript',
            type: 'console-error',
            severity: 'medium',
            title: 'Console Error Logged',
            message: message.substring(0, 500),
            location: {
              fileName: file,
              outerHTML: stack ? stack.substring(0, 300) : undefined
            }
          });
        }
      } catch (e) {
        // Fallback catch if anything fails inside the interceptor
      }

      // Forward to original console.error
      if (self.originalConsoleError) {
        self.originalConsoleError.apply(console, args);
      }
    };
  }

  private restoreConsoleErrorInterceptor(): void {
    if (typeof console !== 'undefined' && this.originalConsoleError !== null) {
      console.error = this.originalConsoleError;
      this.originalConsoleError = null;
    }
  }
}
