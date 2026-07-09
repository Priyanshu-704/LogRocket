import { BaseCollector } from './base';

export class NetworkCollector extends BaseCollector {
  name = 'network';

  private originalFetch: typeof window.fetch | null = null;
  private originalXhrOpen: typeof XMLHttpRequest.prototype.open | null = null;
  private originalXhrSend: typeof XMLHttpRequest.prototype.send | null = null;

  private metrics = {
    totalRequests: 0,
    failedRequests: 0,
    totalDuration: 0,
  };

  init(analyzer: any): void {
    super.init(analyzer);
    this.setupFetchInterceptor();
    this.setupXhrInterceptor();
  }

  destroy(): void {
    super.destroy();
    this.restoreFetchInterceptor();
    this.restoreXhrInterceptor();
  }

  getMetrics() {
    const avgDuration = this.metrics.totalRequests > 0 
      ? Math.round(this.metrics.totalDuration / this.metrics.totalRequests) 
      : 0;
    return {
      networkTotalRequests: this.metrics.totalRequests,
      networkFailedRequests: this.metrics.failedRequests,
      networkAverageDurationMs: avgDuration
    };
  }

  /**
   * Monkeys-patches window.fetch to capture request failures and times.
   */
  private setupFetchInterceptor(): void {
    if (typeof window === 'undefined' || !window.fetch) return;

    this.originalFetch = window.fetch.bind(window);
    const self = this;

    window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
      const startTime = performance.now();
      const url = typeof input === 'string' 
        ? input 
        : input instanceof URL 
          ? input.href 
          : input.url;

      const method = init?.method || 'GET';

      // Avoid intercepting reports sent to our own analytics endpoint
      const isSDKEndpoint = self.analyzer.config.endpoint && url.includes(self.analyzer.config.endpoint);

      try {
        const response = await self.originalFetch!.call(window, input, init);
        const endTime = performance.now();
        const duration = endTime - startTime;

        if (!isSDKEndpoint) {
          self.metrics.totalRequests++;
          self.metrics.totalDuration += duration;

          if (!response.ok) { // Status not in 200-299 range
            self.metrics.failedRequests++;
            self.reportIssue({
              category: 'performance',
              type: 'api-failure',
              severity: response.status >= 500 ? 'high' : 'medium',
              title: `HTTP Fetch Request Failed (${response.status})`,
              message: `API endpoint ${method} ${url} returned status ${response.status} ${response.statusText}.`,
              metadata: {
                url,
                method,
                status: response.status,
                statusText: response.statusText,
                durationMs: Math.round(duration)
              }
            });
          }

          // Report extremely slow API response
          if (duration > 2000) {
            self.reportIssue({
              category: 'performance',
              type: 'slow-api',
              severity: 'medium',
              title: 'Slow API Response',
              message: `API request ${method} ${url} took ${Math.round(duration)}ms. Slow API responses degrade user experience and perceived app responsiveness.`,
              metadata: { url, method, durationMs: Math.round(duration) }
            });
          }
        }

        return response;
      } catch (error: any) {
        const endTime = performance.now();
        const duration = endTime - startTime;

        if (!isSDKEndpoint) {
          self.metrics.totalRequests++;
          self.metrics.failedRequests++;
          self.metrics.totalDuration += duration;

          self.reportIssue({
            category: 'performance',
            type: 'api-error',
            severity: 'high',
            title: `HTTP Fetch Network Error`,
            message: `API request ${method} ${url} failed to execute. Error: ${error?.message || 'Unknown network exception'}.`,
            metadata: {
              url,
              method,
              durationMs: Math.round(duration),
              error: error?.message
            }
          });
        }

        throw error; // Re-throw to not affect host application logic
      }
    };
  }

  private restoreFetchInterceptor(): void {
    if (typeof window !== 'undefined' && this.originalFetch !== null) {
      window.fetch = this.originalFetch;
      this.originalFetch = null;
    }
  }

  /**
   * Patches XMLHttpRequest open/send to capture HTTP call metrics and issues.
   */
  private setupXhrInterceptor(): void {
    if (typeof XMLHttpRequest === 'undefined') return;

    this.originalXhrOpen = XMLHttpRequest.prototype.open;
    this.originalXhrSend = XMLHttpRequest.prototype.send;
    
    const self = this;

    XMLHttpRequest.prototype.open = function (this: any, method: string, url: string | URL, ...rest: any[]) {
      // Store open arguments on the XHR instance for access in send() and onload()
      this._url = typeof url === 'string' ? url : url.toString();
      this._method = method;
      this._startTime = performance.now();

      return self.originalXhrOpen!.apply(this, [method, url, ...rest] as any);
    };

    XMLHttpRequest.prototype.send = function (this: any, body?: Document | XMLHttpRequestBodyInit | null) {
      const xhrInstance = this;

      const handleResponse = () => {
        if (xhrInstance.readyState === 4) { // Completed
          const endTime = performance.now();
          const duration = xhrInstance._startTime ? (endTime - xhrInstance._startTime) : 0;
          const url = xhrInstance._url || 'unknown';
          const method = xhrInstance._method || 'GET';
          const status = xhrInstance.status;

          const isSDKEndpoint = self.analyzer.config.endpoint && url.includes(self.analyzer.config.endpoint);

          if (!isSDKEndpoint) {
            self.metrics.totalRequests++;
            self.metrics.totalDuration += duration;

            if (status === 0 || status >= 400) {
              self.metrics.failedRequests++;
              self.reportIssue({
                category: 'performance',
                type: 'xhr-failure',
                severity: status >= 500 || status === 0 ? 'high' : 'medium',
                title: status === 0 ? 'XHR Network Error' : `XHR Request Failed (${status})`,
                message: status === 0 
                  ? `XHR call ${method} ${url} failed due to network error or CORS blocker.`
                  : `XHR call ${method} ${url} returned status ${status}.`,
                metadata: {
                  url,
                  method,
                  status,
                  durationMs: Math.round(duration)
                }
              });
            }

            if (duration > 2000) {
              self.reportIssue({
                category: 'performance',
                type: 'slow-xhr',
                severity: 'medium',
                title: 'Slow XHR Response',
                message: `XHR request ${method} ${url} took ${Math.round(duration)}ms.`,
                metadata: { url, method, durationMs: Math.round(duration) }
              });
            }
          }
        }
      };

      // Register both onload/onerror and readystatechange just in case
      if ('addEventListener' in xhrInstance) {
        xhrInstance.addEventListener('readystatechange', handleResponse);
      } else {
        const originalStateChange = xhrInstance.onreadystatechange;
        xhrInstance.onreadystatechange = function (this: any, ...args: any[]) {
          handleResponse();
          if (originalStateChange) {
            originalStateChange.apply(this, args);
          }
        };
      }

      return self.originalXhrSend!.apply(xhrInstance, [body]);
    };
  }

  private restoreXhrInterceptor(): void {
    if (typeof XMLHttpRequest !== 'undefined') {
      if (this.originalXhrOpen !== null) {
        XMLHttpRequest.prototype.open = this.originalXhrOpen;
        this.originalXhrOpen = null;
      }
      if (this.originalXhrSend !== null) {
        XMLHttpRequest.prototype.send = this.originalXhrSend;
        this.originalXhrSend = null;
      }
    }
  }
}
