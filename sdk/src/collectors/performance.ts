import { BaseCollector } from './base';

export class PerformanceCollector extends BaseCollector {
  name = 'performance';

  private observers: PerformanceObserver[] = [];
  
  // Accumulated metric states
  private metrics: Record<string, number> = {
    fcp: 0,
    lcp: 0,
    cls: 0,
    fid: 0,
    ttfb: 0,
    domInteractive: 0,
    loadEventTime: 0
  };

  init(analyzer: any): void {
    super.init(analyzer);
    this.collectNavigationTimings();
    this.setupPerformanceObservers();
    this.setupMemoryAudit();
  }

  destroy(): void {
    super.destroy();
    this.observers.forEach(obs => {
      try {
        obs.disconnect();
      } catch (e) {
        // Safe discard
      }
    });
    this.observers = [];
  }

  getMetrics() {
    return { ...this.metrics };
  }

  /**
   * Captures Navigation Timing metrics (TTFB, DOM Interactive, Load Event, etc.)
   */
  private collectNavigationTimings(): void {
    if (typeof window === 'undefined' || typeof performance === 'undefined') return;

    // Use modern PerformanceNavigationTiming API if available, fallback to legacy performance.timing
    const getTimings = () => {
      try {
        const navEntries = performance.getEntriesByType('navigation');
        if (navEntries.length > 0) {
          const entry = navEntries[0] as PerformanceNavigationTiming;
          const ttfb = entry.responseStart - entry.requestStart;
          const domInteractive = entry.domInteractive;
          const loadEventTime = entry.loadEventEnd;

          this.metrics.ttfb = Math.round(ttfb);
          this.metrics.domInteractive = Math.round(domInteractive);
          this.metrics.loadEventTime = Math.round(loadEventTime);

          this.checkNavigationAnomalies(this.metrics.ttfb, this.metrics.loadEventTime);
        } else if ((performance as any).timing) {
          const timing = (performance as any).timing;
          const ttfb = timing.responseStart - timing.requestStart;
          const domInteractive = timing.domInteractive - timing.navigationStart;
          const loadEventTime = timing.loadEventEnd - timing.navigationStart;

          this.metrics.ttfb = Math.max(0, Math.round(ttfb));
          this.metrics.domInteractive = Math.max(0, Math.round(domInteractive));
          this.metrics.loadEventTime = Math.max(0, Math.round(loadEventTime));

          this.checkNavigationAnomalies(this.metrics.ttfb, this.metrics.loadEventTime);
        }
      } catch (e) {
        this.analyzer.logger.debug('Failed gathering navigation timings', e);
      }
    };

    // The loadEventEnd may not have run yet if the script is loaded eagerly.
    // Listen to load event to retrieve complete timings.
    if (document.readyState === 'complete') {
      getTimings();
    } else {
      window.addEventListener('load', () => {
        // Small delay to ensure performance.timing properties are fully populated
        setTimeout(getTimings, 100);
      });
    }
  }

  private checkNavigationAnomalies(ttfb: number, loadTime: number): void {
    if (ttfb > 600) {
      this.reportIssue({
        category: 'performance',
        type: 'slow-ttfb',
        severity: 'high',
        title: 'Slow Time to First Byte (TTFB)',
        message: `TTFB was ${ttfb}ms. A slow TTFB indicates server-side latency, slow database queries, or CDN routing delays. Target less than 600ms.`,
        metadata: { ttfb }
      });
    }

    if (loadTime > 3000) {
      this.reportIssue({
        category: 'performance',
        type: 'slow-page-load',
        severity: 'medium',
        title: 'Slow Page Load Time',
        message: `Total page load took ${Math.round(loadTime / 100) / 10}s. Slow page loads increase user bounce rates. Optimize bundle sizes and assets.`,
        metadata: { loadTimeMs: loadTime }
      });
    }
  }

  /**
   * Set up PerformanceObservers for Web Vitals (FCP, LCP, CLS, FID) and Long Tasks.
   */
  private setupPerformanceObservers(): void {
    if (typeof PerformanceObserver === 'undefined') return;

    // 1. Paint Timing Observer (FCP)
    this.createObserver('paint', (entries) => {
      const fcpEntry = entries.find(entry => entry.name === 'first-contentful-paint');
      if (fcpEntry) {
        this.metrics.fcp = Math.round(fcpEntry.startTime);
        if (this.metrics.fcp > 1800) {
          this.reportIssue({
            category: 'performance',
            type: 'slow-fcp',
            severity: 'medium',
            title: 'Slow First Contentful Paint (FCP)',
            message: `First Contentful Paint took ${this.metrics.fcp}ms. Optimize critical rendering path and render-blocking CSS/JS.`,
            metadata: { fcp: this.metrics.fcp }
          });
        }
      }
    });

    // 2. Largest Contentful Paint Observer (LCP)
    this.createObserver('largest-contentful-paint', (entries) => {
      const lastEntry = entries[entries.length - 1];
      if (lastEntry) {
        this.metrics.lcp = Math.round(lastEntry.startTime);
        if (this.metrics.lcp > 2500) {
          this.reportIssue({
            category: 'performance',
            type: 'slow-lcp',
            severity: 'high',
            title: 'Poor Largest Contentful Paint (LCP)',
            message: `Largest Contentful Paint took ${this.metrics.lcp}ms (Recommended: <2500ms). Check for hero image sizes or slow server response.`,
            metadata: { lcp: this.metrics.lcp }
          });
        }
      }
    });

    // 3. Layout Shift Observer (CLS)
    this.createObserver('layout-shift', (entries) => {
      for (const entry of entries) {
        // Only count shifts without recent user input
        if (!(entry as any).hadRecentInput) {
          this.metrics.cls += (entry as any).value;
        }
      }

      if (this.metrics.cls > 0.1) {
        this.reportIssue({
          category: 'performance',
          type: 'layout-instability',
          severity: this.metrics.cls > 0.25 ? 'high' : 'medium',
          title: 'High Cumulative Layout Shift (CLS)',
          message: `Cumulative Layout Shift is ${this.metrics.cls.toFixed(3)}. Elements shifting on-screen during load hurts usability. Add explicit dimensions to images/aspect-ratio CSS.`,
          metadata: { cls: this.metrics.cls }
        });
      }
    });

    // 4. First Input Delay Observer (FID)
    this.createObserver('first-input', (entries) => {
      const firstInput = entries[0];
      if (firstInput) {
        const delay = (firstInput as any).processingStart - firstInput.startTime;
        this.metrics.fid = Math.round(delay);
        if (this.metrics.fid > 100) {
          this.reportIssue({
            category: 'performance',
            type: 'high-input-delay',
            severity: 'medium',
            title: 'High First Input Delay (FID)',
            message: `First Input Delay was ${this.metrics.fid}ms. The main thread is busy when the user tries to interact. Optimize JS execution.`,
            metadata: { fid: this.metrics.fid }
          });
        }
      }
    });

    // 5. Long Task Observer (Tasks > 50ms)
    this.createObserver('longtask', (entries) => {
      for (const entry of entries) {
        const duration = Math.round(entry.duration);
        this.reportIssue({
          category: 'performance',
          type: 'long-task',
          severity: duration > 100 ? 'high' : 'medium',
          title: `Main thread long task: ${duration}ms`,
          message: `A JavaScript task blocked the main thread for ${duration}ms. Long tasks delay page interactivity and freeze animations. Optimize heavy JS or use Web Workers.`,
          metadata: { durationMs: duration, name: entry.name }
        });
      }
    });

    // 6. Resource Timing Observer (Large assets & formats)
    this.createObserver('resource', (entries) => {
      for (const entry of entries) {
        const res = entry as PerformanceResourceTiming;
        
        // Audit large images/files (>1MB transfer size or decoded size if available)
        const sizeInBytes = res.transferSize || res.encodedBodySize || 0;
        if (sizeInBytes > 1024 * 1024) { // 1MB
          const mb = (sizeInBytes / (1024 * 1024)).toFixed(2);
          const name = res.name.split('/').pop() || res.name;
          this.reportIssue({
            category: 'performance',
            type: 'large-resource',
            severity: 'medium',
            title: `Large resource downloaded: ${name}`,
            message: `Resource is ${mb}MB. Large assets delay load times and consume extra bandwidth. Consider image compression or lazy loading.`,
            metadata: { name: res.name, sizeBytes: sizeInBytes }
          });
        }

        // Detect non-optimal image formats (e.g. png/jpeg/gif when modern webp/avif are better)
        const urlLower = res.name.toLowerCase();
        if ((urlLower.endsWith('.png') || urlLower.endsWith('.jpg') || urlLower.endsWith('.jpeg')) && sizeInBytes > 150 * 1024) {
          const name = res.name.split('/').pop() || res.name;
          this.reportIssue({
            category: 'performance',
            type: 'unoptimized-image-format',
            severity: 'low',
            title: `Unoptimized image format: ${name}`,
            message: `Image size is over 150KB and uses a legacy format. Converting to modern formats like WebP or AVIF can save up to 70% in file size.`,
            metadata: { name: res.name }
          });
        }
      }
    });
  }

  /**
   * Helper to safely instantiate and track PerformanceObservers.
   */
  private createObserver(type: string, callback: (entries: PerformanceEntry[]) => void): void {
    try {
      const observer = new PerformanceObserver((list) => {
        callback(list.getEntries());
      });
      observer.observe({ type, buffered: true });
      this.observers.push(observer);
    } catch (e) {
      this.analyzer.logger.debug(`PerformanceObserver type "${type}" not supported by browser.`, e);
    }
  }

  /**
   * Performs basic heap memory audits (Chrome/Edge/Opera only).
   */
  private setupMemoryAudit(): void {
    if (typeof window === 'undefined' || typeof performance === 'undefined') return;
    
    const checkMemory = () => {
      if (!this.active) return;

      const memory = (performance as any).memory;
      if (memory) {
        const usedLimitRatio = memory.usedJSHeapSize / memory.jsHeapLimit;
        
        // If heap size exceeds 85% of browser limit
        if (usedLimitRatio > 0.85) {
          this.reportIssue({
            category: 'performance',
            type: 'excessive-memory',
            severity: 'high',
            title: 'Critical JS memory heap usage',
            message: `JavaScript heap usage is at ${(usedLimitRatio * 100).toFixed(1)}% of the browser limit. High memory consumption risks tab crashes and leaks.`,
            metadata: {
              usedHeapMb: Math.round(memory.usedJSHeapSize / (1024 * 1024)),
              heapLimitMb: Math.round(memory.jsHeapLimit / (1024 * 1024))
            }
          });
        }
      }
    };

    // Audit memory usage every 10 seconds
    const interval = setInterval(checkMemory, 10000);
    this.observers.push({
      observe: () => {},
      disconnect: () => clearInterval(interval)
    } as any);
  }
}
