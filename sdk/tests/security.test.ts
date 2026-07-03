import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Analyzer } from '../src/core/analyzer';
import { SecurityCollector } from '../src/collectors/security';

describe('SecurityCollector', () => {
  let analyzer: Analyzer;
  let securityCollector: SecurityCollector;

  beforeEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';

    analyzer = new Analyzer();
    analyzer.init({
      projectId: 'test-project',
      collectors: {
        dom: false,
        css: false,
        errors: false,
        network: false,
        performance: false,
        'static-code': false,
        security: false
      }
    });

    securityCollector = new SecurityCollector();
    securityCollector.init(analyzer);

    // Mock window location protocol as HTTPS
    vi.stubGlobal('location', {
      protocol: 'https:',
      href: 'https://app.example.com/'
    });
  });

  afterEach(() => {
    securityCollector.destroy();
    analyzer.destroy();
    vi.restoreAllMocks();
  });

  it('should flag missing Content Security Policy (CSP)', () => {
    securityCollector.scan();

    const report = analyzer.getReport();
    const issue = report?.issues.find(i => i.type === 'missing-csp');
    expect(issue).toBeDefined();
    expect(issue?.severity).toBe('high');
  });

  it('should not flag missing CSP if meta tag is present', () => {
    const meta = document.createElement('meta');
    meta.setAttribute('http-equiv', 'Content-Security-Policy');
    meta.setAttribute('content', "default-src 'self'");
    document.head.appendChild(meta);

    securityCollector.scan();

    const report = analyzer.getReport();
    const issue = report?.issues.find(i => i.type === 'missing-csp');
    expect(issue).toBeUndefined();
  });

  it('should detect HTTP mixed content resources on HTTPS protocol pages', () => {
    // 1. Insecure Image
    const img = document.createElement('img');
    img.src = 'http://assets.example.com/logo.png';
    document.body.appendChild(img);

    // 2. Insecure Script
    const script = document.createElement('script');
    script.src = 'http://scripts.example.com/tracker.js';
    document.body.appendChild(script);

    // 3. Insecure Stylesheet
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'http://styles.example.com/main.css';
    document.body.appendChild(link);

    securityCollector.scan();

    const report = analyzer.getReport();
    const imgIssue = report?.issues.find(i => i.type === 'mixed-content');
    const scriptIssue = report?.issues.find(i => i.type === 'mixed-content-script');
    const linkIssue = report?.issues.find(i => i.type === 'mixed-content-stylesheet');

    expect(imgIssue).toBeDefined();
    expect(scriptIssue).toBeDefined();
    expect(linkIssue).toBeDefined();
    expect(scriptIssue?.severity).toBe('critical'); // Active scripts are critical blockers
  });
});
