import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Analyzer } from '../src/core/analyzer';
import { StaticCodeCollector } from '../src/collectors/static-code';
import { analyzeJSContent } from '../src/rules/static-rules';

describe('StaticCodeCollector & Rules', () => {
  let analyzer: Analyzer;
  let staticCollector: StaticCodeCollector;

  beforeEach(() => {
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

    staticCollector = new StaticCodeCollector();
    staticCollector.init(analyzer);
  });

  afterEach(() => {
    staticCollector.destroy();
    analyzer.destroy();
  });

  describe('Static Rules Engine (analyzeJSContent)', () => {
    it('should flag debugger statements', () => {
      const code = `
        function test() {
          console.log("starting");
          debugger;
          return true;
        }
      `;
      const diagnostics = analyzeJSContent(code);
      const found = diagnostics.find(d => d.type === 'debugger-statement');
      expect(found).toBeDefined();
    });

    it('should flag exposed secrets', () => {
      const code = `
        const AWS_KEY = "AKIAIOSFODNN7EXAMPLE";
        const config = {
          secret_key: "mySecretKey1234567"
        };
      `;
      const diagnostics = analyzeJSContent(code);
      const found = diagnostics.find(d => d.type === 'exposed-secret');
      expect(found).toBeDefined();
    });

    it('should flag callback hell or deep nesting', () => {
      const code = `
        a(() => {
          b(() => {
            c(() => {
              d(() => {
                e(() => {
                  f(() => {
                    console.log("nesting depth > 5");
                  });
                });
              });
            });
          });
        });
      `;
      const diagnostics = analyzeJSContent(code);
      const found = diagnostics.find(d => d.type === 'callback-hell');
      expect(found).toBeDefined();
    });

    it('should flag unsafe innerHTML assignments', () => {
      const code = `
        const payload = "<script>alert('hack')</script>";
        element.innerHTML = payload;
      `;
      const diagnostics = analyzeJSContent(code);
      const found = diagnostics.find(d => d.type === 'unsafe-inner-html');
      expect(found).toBeDefined();
    });

    it('should flag poor naming conventions', () => {
      const code = `
        let temp = 10;
        var foo = "bar";
        const a = 12;
      `;
      const diagnostics = analyzeJSContent(code);
      const found = diagnostics.find(d => d.type === 'poor-variable-name');
      expect(found).toBeDefined();
    });
  });

  describe('StaticCodeCollector HTML scan', () => {
    it('should analyze inline script tags', () => {
      const script = document.createElement('script');
      script.textContent = `
        const api_key = "AIzaSyD-1234567890Example";
      `;
      document.body.appendChild(script);

      staticCollector.scan();

      const report = analyzer.getReport();
      const issue = report?.issues.find(i => i.type === 'exposed-secret');
      expect(issue).toBeDefined();

      document.body.removeChild(script);
    });
  });
});
