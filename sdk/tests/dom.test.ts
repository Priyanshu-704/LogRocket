import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Analyzer } from '../src/core/analyzer';
import { DOMCollector } from '../src/collectors/dom';

describe('DOMCollector', () => {
  let analyzer: Analyzer;
  let domCollector: DOMCollector;

  beforeEach(() => {
    // Clear document body before each test
    document.body.innerHTML = '';
    
    analyzer = new Analyzer();
    analyzer.init({
      projectId: 'test-project',
      collectors: {
        dom: false, // Turn off auto initialization so we can test manually
        css: false,
        errors: false,
        network: false,
        performance: false
      }
    });

    domCollector = new DOMCollector();
    domCollector.init(analyzer);
  });

  afterEach(() => {
    domCollector.destroy();
    analyzer.destroy();
  });

  it('should detect deprecated tags like <center> and <font>', () => {
    const center = document.createElement('center');
    center.innerHTML = 'Hello World';
    document.body.appendChild(center);

    domCollector.scan();

    const report = analyzer.getReport();
    const issue = report?.issues.find(i => i.type === 'deprecated-tag');
    expect(issue).toBeDefined();
    expect(issue?.title).toContain('<center>');
  });

  it('should detect duplicate element IDs', () => {
    const div1 = document.createElement('div');
    div1.id = 'unique-id';
    const div2 = document.createElement('div');
    div2.id = 'unique-id';

    document.body.appendChild(div1);
    document.body.appendChild(div2);

    domCollector.scan();

    const report = analyzer.getReport();
    const issue = report?.issues.find(i => i.type === 'duplicate-id');
    expect(issue).toBeDefined();
    expect(issue?.message).toContain('unique-id');
  });

  it('should detect images missing alt attributes', () => {
    const img = document.createElement('img');
    img.src = 'avatar.png';
    document.body.appendChild(img);

    domCollector.scan();

    const report = analyzer.getReport();
    const issue = report?.issues.find(i => i.type === 'missing-alt-attribute');
    expect(issue).toBeDefined();
  });

  it('should detect empty or hash href links', () => {
    const link = document.createElement('a');
    link.setAttribute('href', '#');
    link.innerHTML = 'Click here';
    document.body.appendChild(link);

    domCollector.scan();

    const report = analyzer.getReport();
    const issue = report?.issues.find(i => i.type === 'empty-link');
    expect(issue).toBeDefined();
  });

  it('should detect inputs missing labels or aria-labels', () => {
    const input = document.createElement('input');
    input.type = 'text';
    input.id = 'username';
    document.body.appendChild(input);

    domCollector.scan();

    const report = analyzer.getReport();
    const issue = report?.issues.find(i => i.type === 'missing-form-label');
    expect(issue).toBeDefined();
  });
});
