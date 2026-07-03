import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Analyzer } from '../src/core/analyzer';

describe('Analyzer Core SDK', () => {
  let analyzer: Analyzer;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true })));
    analyzer = new Analyzer();
  });

  afterEach(() => {
    analyzer.destroy();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should initialize correctly with merged config', () => {
    analyzer.init({
      projectId: 'test-project-123',
      debug: true
    });

    expect(analyzer.config.projectId).toBe('test-project-123');
    expect(analyzer.config.debug).toBe(true);
    expect(analyzer.config.environment).toBe('production'); // Default environment
  });

  it('should throw error if projectId is missing', () => {
    expect(() => {
      analyzer.init({ projectId: '' });
    }).toThrow('[AnalyzerSDK] Missing required option: projectId');
  });

  it('should respect sampleRate zero and skip reporting issues', () => {
    analyzer.init({
      projectId: 'test-project-123',
      sampleRate: 0.0
    });

    analyzer.addIssue({
      id: 'issue-1',
      category: 'javascript',
      type: 'test-error',
      severity: 'high',
      title: 'Test',
      message: 'test message',
      timestamp: Date.now()
    });

    const report = analyzer.getReport();
    expect(report).toBeNull();
  });

  it('should record manual errors and telemetry events', () => {
    analyzer.init({
      projectId: 'test-project-123',
      sampleRate: 1.0
    });

    analyzer.trackError(new TypeError('Invalid variable assignment'), 'high');
    analyzer.trackEvent('user_signup', { referrer: 'google' });

    const report = analyzer.getReport();
    expect(report).not.toBeNull();
    expect(report?.issues.length).toBe(1);
    expect(report?.issues[0].title).toBe('TypeError');
    expect(report?.issues[0].message).toBe('Invalid variable assignment');
    expect(report?.events.length).toBe(1);
    expect(report?.events[0].name).toBe('user_signup');
  });

  it('should load and execute custom plugins', () => {
    analyzer.init({
      projectId: 'test-project-123',
      sampleRate: 1.0
    });

    const pluginSpy = vi.fn();
    analyzer.use({
      name: 'Test Plugin',
      analyze: pluginSpy
    });

    expect(pluginSpy).toHaveBeenCalledWith(analyzer);
  });

  it('should batch and transmit reports periodically', async () => {
    analyzer.init({
      projectId: 'test-project-123',
      endpoint: 'https://analytics.test/report',
      sampleRate: 1.0
    });

    analyzer.addIssue({
      id: 'issue-1',
      category: 'html',
      type: 'empty-link',
      severity: 'low',
      title: 'Empty Link',
      message: 'Link has empty href',
      timestamp: Date.now()
    });

    // Fast-forward timers to trigger periodic transmission (10s)
    vi.advanceTimersByTime(11000);

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
