import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Analyzer } from '../src/core/analyzer';
import { NetworkCollector } from '../src/collectors/network';

describe('NetworkCollector', () => {
  let analyzer: Analyzer;
  let networkCollector: NetworkCollector;

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

    // Mock fetch globally
    vi.stubGlobal('fetch', vi.fn());

    networkCollector = new NetworkCollector();
    networkCollector.init(analyzer);
  });

  afterEach(() => {
    networkCollector.destroy();
    analyzer.destroy();
    vi.restoreAllMocks();
  });

  it('should intercept window.fetch and report issue on HTTP failure statuses', async () => {
    const mockResponse = {
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    };
    (global.fetch as any).mockResolvedValueOnce(mockResponse);

    await window.fetch('https://api.example.com/v1/users');

    const report = analyzer.getReport();
    const issue = report?.issues.find(i => i.type === 'api-failure');
    expect(issue).toBeDefined();
    expect(issue?.severity).toBe('high');
    expect(issue?.metadata?.status).toBe(500);
    expect(issue?.metadata?.url).toBe('https://api.example.com/v1/users');
  });

  it('should intercept window.fetch and report api-error on request throw/exception', async () => {
    (global.fetch as any).mockRejectedValueOnce(new TypeError('Failed to fetch'));

    try {
      await window.fetch('https://api.example.com/v1/users');
    } catch (e) {
      // Catch expected fetch throw
    }

    const report = analyzer.getReport();
    const issue = report?.issues.find(i => i.type === 'api-error');
    expect(issue).toBeDefined();
    expect(issue?.severity).toBe('high');
    expect(issue?.metadata?.error).toBe('Failed to fetch');
  });

  it('should intercept XMLHttpRequest open/send and record failure status', () => {
    // Stub XMLHttpRequest
    const mockXhr = {
      open: vi.fn(),
      send: vi.fn(function(this: any) {
        // Trigger completion callback
        this.readyState = 4;
        this.status = 404;
        this._url = 'https://api.example.com/data';
        this._method = 'POST';
        this._startTime = performance.now();
        
        if (this.onreadystatechange) {
          this.onreadystatechange();
        }
      }),
      addEventListener: vi.fn()
    };

    vi.stubGlobal('XMLHttpRequest', vi.fn(() => mockXhr));

    // Re-initialize collector to capture stubbed XMLHttpRequest prototype
    networkCollector.destroy();
    networkCollector = new NetworkCollector();
    networkCollector.init(analyzer);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', 'https://api.example.com/data');
    xhr.send();

    const report = analyzer.getReport();
    const issue = report?.issues.find(i => i.type === 'xhr-failure');
    expect(issue).toBeDefined();
    expect(issue?.metadata?.status).toBe(404);
    expect(issue?.metadata?.method).toBe('POST');
  });
});
