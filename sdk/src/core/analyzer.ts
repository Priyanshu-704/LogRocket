import { AnalyzerConfig, Issue, TelemetryEvent, Report, Plugin } from '../types';
import { mergeConfig } from './config';
import { Registry } from './registry';
import { logger } from '../utils/logger';
import { safeExecute } from '../utils/helpers';
import { DOMCollector } from '../collectors/dom';
import { CSSCollector } from '../collectors/css';
import { ErrorsCollector } from '../collectors/errors';
import { NetworkCollector } from '../collectors/network';
import { PerformanceCollector } from '../collectors/performance';
import { StaticCodeCollector } from '../collectors/static-code';
import { SecurityCollector } from '../collectors/security';

const SDK_VERSION = '1.0.0';
const MAX_ISSUES_QUEUE = 500;
const MAX_EVENTS_QUEUE = 200;

export class Analyzer {
  public config!: AnalyzerConfig;
  public logger = logger;
  
  private registry!: Registry;
  private issues: Issue[] = [];
  private events: TelemetryEvent[] = [];
  private isInitialized = false;
  private isSampled = true;
  private transmitInterval: any = null;
  private reportDebounceTimeout: any = null;

  /**
   * Initializes the SDK with configurations.
   */
  public init(userConfig: AnalyzerConfig): void {
    if (this.isInitialized) {
      this.logger.warn('Analyzer is already initialized.');
      return;
    }

    try {
      this.config = mergeConfig(userConfig);
      this.logger.setDebug(!!this.config.debug);
      
      // Determine session sampling
      const sampleRate = this.config.sampleRate ?? 1.0;
      this.isSampled = Math.random() < sampleRate;

      if (!this.isSampled) {
        this.logger.info('Session excluded from analysis due to sampleRate throttling.');
        this.isInitialized = true;
        return;
      }

      this.logger.info('Initializing JS Code Analyzer SDK...', { projectId: this.config.projectId, env: this.config.environment });

      this.registry = new Registry(this);
      
      // Register built-in collectors
      this.registry.registerCollector('errors', new ErrorsCollector());
      this.registry.registerCollector('network', new NetworkCollector());
      this.registry.registerCollector('performance', new PerformanceCollector());
      this.registry.registerCollector('dom', new DOMCollector());
      this.registry.registerCollector('css', new CSSCollector());
      this.registry.registerCollector('static-code', new StaticCodeCollector());
      this.registry.registerCollector('security', new SecurityCollector());

      this.setupTransmission();

      this.isInitialized = true;
    } catch (err: any) {
      this.logger.error('Failed to initialize SDK core', err);
    }
  }

  /**
   * Triggers an on-demand complete DOM, CSS, and structural audit.
   */
  public scan(): void {
    if (!this.checkReadiness()) return;
    this.logger.debug('Triggering manual audit scan...');
    this.registry.scanAll();
  }

  /**
   * Manually track a custom error.
   */
  public trackError(error: Error | string, severity: import('../types').Severity = 'high'): void {
    if (!this.checkReadiness()) return;

    const errMsg = typeof error === 'string' ? error : error.message;
    const errName = typeof error === 'string' ? 'Manual Error' : error.name;
    const stack = typeof error === 'object' ? error.stack : undefined;

    this.addIssue({
      id: '', // Will be generated in addIssue
      category: 'javascript',
      type: 'manual-error',
      severity,
      title: errName,
      message: errMsg,
      timestamp: Date.now(),
      location: {
        outerHTML: stack ? stack.substring(0, 300) : undefined
      },
      metadata: {
        stack
      }
    });
  }

  /**
   * Tracks a custom telemetry or user event.
   */
  public trackEvent(name: string, payload: Record<string, any> = {}): void {
    if (!this.checkReadiness()) return;

    if (this.events.length >= MAX_EVENTS_QUEUE) {
      this.events.shift(); // Evict oldest
    }

    this.events.push({
      name,
      payload,
      timestamp: Date.now()
    });

    this.logger.debug(`Telemetry event tracked: ${name}`, payload);
  }

  /**
   * Registers a custom plugin.
   */
  public use(plugin: Plugin): void {
    if (!this.checkReadiness()) return;
    this.registry.registerPlugin(plugin);
  }

  /**
   * Compiles the comprehensive report.
   */
  public getReport(): Report | null {
    if (!this.isInitialized || !this.isSampled) return null;

    // Collect metrics from network & performance collectors if present
    const perfCol = this.registry.getCollector('performance') as PerformanceCollector | undefined;
    const netCol = this.registry.getCollector('network') as NetworkCollector | undefined;

    const metrics = {
      ...(perfCol ? perfCol.getMetrics() : {}),
      ...(netCol ? netCol.getMetrics() : {})
    };

    return {
      projectId: this.config.projectId,
      environment: this.config.environment || 'production',
      timestamp: Date.now(),
      sdkVersion: SDK_VERSION,
      url: typeof window !== 'undefined' ? window.location.href : '',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      issues: [...this.issues],
      events: [...this.events],
      metrics
    };
  }

  /**
   * Appends an issue to the reporting queue.
   */
  public addIssue(issue: Issue): void {
    if (!this.isInitialized || !this.isSampled) return;

    // Generate unique ID if not already generated
    if (!issue.id) {
      issue.id = Math.random().toString(36).substring(2, 9);
    }

    // Deduplicate: check if this issue ID is already in the current queue
    if (this.issues.some(item => item.id === issue.id)) {
      return;
    }

    if (this.issues.length >= MAX_ISSUES_QUEUE) {
      this.issues.shift(); // Evict oldest
    }

    this.issues.push(issue);
    this.logger.debug(`Issue added to queue: ${issue.title} [${issue.severity}]`, issue);

    // Schedule debounced transmission of new issues
    this.scheduleDebouncedTransmit();
  }

  /**
   * Shuts down all observers, event listeners, and schedules.
   */
  public destroy(): void {
    this.logger.info('Shutting down and destroying SDK...');
    
    if (this.transmitInterval) {
      clearInterval(this.transmitInterval);
      this.transmitInterval = null;
    }
    if (this.reportDebounceTimeout) {
      clearTimeout(this.reportDebounceTimeout);
      this.reportDebounceTimeout = null;
    }

    // Send final report queue if exists
    if (this.issues.length > 0) {
      this.transmit(true);
    }

    if (this.registry) {
      this.registry.clear();
    }

    this.issues = [];
    this.events = [];
    this.isInitialized = false;
  }

  private checkReadiness(): boolean {
    if (!this.isInitialized) {
      logger.warn('SDK not initialized. Please call Analyzer.init() first.');
      return false;
    }
    return this.isSampled;
  }

  /**
   * Periodically flushes issues to the backend.
   */
  private setupTransmission(): void {
    if (typeof window === 'undefined') return;

    // 1. Setup interval flush every 10 seconds
    this.transmitInterval = setInterval(() => this.transmit(), 10000);

    // 2. Setup unload/visibility-change triggers to ensure zero data loss on page exit
    const handleUnload = () => {
      this.transmit(true);
    };

    window.addEventListener('beforeunload', handleUnload);
    
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.transmit(true);
      }
    });
  }

  private scheduleDebouncedTransmit(): void {
    if (this.reportDebounceTimeout) clearTimeout(this.reportDebounceTimeout);
    
    // Batch transmit issues 2s after they stop arriving
    this.reportDebounceTimeout = setTimeout(() => {
      this.transmit();
    }, 2000);
  }

  /**
   * Transmits the current report queue to the ingestion API.
   * @param useBeacon If true, uses navigator.sendBeacon for reliable delivery during unload.
   */
  private transmit(useBeacon = false): void {
    if (this.issues.length === 0 && this.events.length === 0) return;

    const report = this.getReport();
    if (!report || !this.config.endpoint) return;

    // Clear memory queues before transmission to avoid double sending
    const issuesSent = [...this.issues];
    const eventsSent = [...this.events];
    this.issues = [];
    this.events = [];

    this.logger.debug(`Transmitting report to ${this.config.endpoint}`, report);

    safeExecute(() => {
      const payload = JSON.stringify(report);

      if (useBeacon && typeof navigator !== 'undefined' && navigator.sendBeacon) {
        const success = navigator.sendBeacon(this.config.endpoint!, new Blob([payload], { type: 'application/json' }));
        if (!success) {
          // Fallback if beacon failed
          this.fallbackFetch(payload);
        }
      } else {
        this.fallbackFetch(payload);
      }
    }, undefined, (err) => {
      this.logger.error('Failed to transmit report payload', err);
      // Restore issues in case of immediate connection crash
      this.issues = [...issuesSent, ...this.issues].slice(0, MAX_ISSUES_QUEUE);
      this.events = [...eventsSent, ...this.events].slice(0, MAX_EVENTS_QUEUE);
    });
  }

  private fallbackFetch(payload: string): void {
    if (typeof fetch === 'undefined') return;

    fetch(this.config.endpoint!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: payload,
      keepalive: true // Hint to browser to keep request alive if page unloads
    }).catch(err => {
      this.logger.error('Fetch reporting fallback failed', err);
    });
  }
}
