import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Analyzer } from '../src/core/analyzer';
import { ErrorsCollector } from '../src/collectors/errors';

describe('ErrorsCollector', () => {
  let analyzer: Analyzer;
  let errorsCollector: ErrorsCollector;

  beforeEach(() => {
    analyzer = new Analyzer();
    analyzer.init({
      projectId: 'test-project',
      collectors: {
        dom: false,
        css: false,
        errors: false,
        network: false,
        performance: false
      }
    });

    errorsCollector = new ErrorsCollector();
    errorsCollector.init(analyzer);
  });

  afterEach(() => {
    errorsCollector.destroy();
    analyzer.destroy();
    vi.restoreAllMocks();
  });

  it('should capture uncaught exceptions via window.onerror', () => {
    // Mock the window.onerror call
    if (window.onerror) {
      window.onerror('ReferenceError: x is not defined', 'main.js', 12, 34, new ReferenceError('x is not defined'));
    }

    const report = analyzer.getReport();
    const issue = report?.issues.find(i => i.type === 'runtime-error');
    expect(issue).toBeDefined();
    expect(issue?.title).toBe('ReferenceError');
    expect(issue?.message).toBe('x is not defined');
    expect(issue?.location?.line).toBe(12);
    expect(issue?.location?.column).toBe(34);
    expect(issue?.location?.fileName).toBe('main.js');
  });

  it('should capture unhandled promise rejections', () => {
    // Simulate unhandledrejection event
    const event = new CustomEvent('unhandledrejection', {
      bubbles: true,
      cancelable: true
    }) as any;
    
    event.reason = new Error('Database connection failed');

    window.dispatchEvent(event);

    const report = analyzer.getReport();
    const issue = report?.issues.find(i => i.type === 'unhandled-rejection');
    expect(issue).toBeDefined();
    expect(issue?.title).toBe('Error');
    expect(issue?.message).toBe('Database connection failed');
  });

  it('should capture console.error output', () => {
    const originalConsoleError = console.error;
    
    // Stub console.error to avoid spamming test stdout
    const consoleSpy = vi.fn();
    (errorsCollector as any).originalConsoleError = consoleSpy;

    console.error('Failed to load credentials config file', { status: 401 });

    const report = analyzer.getReport();
    const issue = report?.issues.find(i => i.type === 'console-error');
    expect(issue).toBeDefined();
    expect(issue?.message).toContain('Failed to load credentials config file');
    
    // Ensure original console error was still called
    expect(consoleSpy).toHaveBeenCalled();
    
    // Restore console
    console.error = originalConsoleError;
  });
});
