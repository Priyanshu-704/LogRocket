import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Analyzer } from '../src/core/analyzer';
import { NetworkCollector } from '../src/collectors/network';

describe('NetworkCollector', () => {
  let analyzer: Analyzer;
  let networkCollector: NetworkCollector;
  let mockFetch: any;

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

    // Mock fetch globally and on window to prevent leakage
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
    if (typeof window !== 'undefined') {
      (window as any).fetch = mockFetch;
    }

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
    mockFetch.mockResolvedValueOnce(mockResponse);

    await window.fetch('https://api.example.com/v1/users');

    const report = analyzer.getReport();
    const issue = report?.issues.find((i: any) => i.type === 'api-failure');
    expect(issue).toBeDefined();
    expect(issue?.severity).toBe('high');
    expect(issue?.metadata?.status).toBe(500);
    expect(issue?.metadata?.url).toBe('https://api.example.com/v1/users');
  });

  it('should intercept window.fetch and report api-error on request throw/exception', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    try {
      await window.fetch('https://api.example.com/v1/users');
    } catch (e) {
      // Catch expected fetch throw
    }

    const report = analyzer.getReport();
    const issue = report?.issues.find((i: any) => i.type === 'api-error');
    expect(issue).toBeDefined();
    expect(issue?.severity).toBe('high');
    expect(issue?.metadata?.error).toBe('Failed to fetch');
  });

  it('should intercept XMLHttpRequest open/send and record failure status', () => {
    const mockOpen = vi.fn();
    const mockSend = vi.fn(function (this: any) {
      this.readyState = 4;
      this.status = 404;
      this._url = 'https://api.example.com/data';
      this._method = 'POST';
      this._startTime = performance.now();

      if (this.onreadystatechange) {
        this.onreadystatechange();
      }
      if (this._listeners && this._listeners['readystatechange']) {
        this._listeners['readystatechange'].forEach((cb: any) => cb());
      }
    });

    class MockXMLHttpRequest {
      _listeners: Record<string, any[]> = {};
      readyState = 0;
      status = 0;
      onreadystatechange: any = null;

      open(method: string, url: string) {
        mockOpen(method, url);
      }
      send(body: any) {
        mockSend.call(this);
      }
      addEventListener(event: string, cb: any) {
        if (!this._listeners[event]) this._listeners[event] = [];
        this._listeners[event].push(cb);
      }
    }

    vi.stubGlobal('XMLHttpRequest', MockXMLHttpRequest);

    // Re-initialize collector to capture stubbed XMLHttpRequest prototype
    networkCollector.destroy();
    networkCollector = new NetworkCollector();
    networkCollector.init(analyzer);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', 'https://api.example.com/data');
    xhr.send();

    const report = analyzer.getReport();
    const issue = report?.issues.find((i: any) => i.type === 'xhr-failure');
    expect(issue).toBeDefined();
    expect(issue?.metadata?.status).toBe(404);
    expect(issue?.metadata?.method).toBe('POST');
  });
});
