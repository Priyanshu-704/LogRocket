import { BaseCollector } from './base';
import { analyzeJSContent } from '../rules/static-rules';

export class StaticCodeCollector extends BaseCollector {
  name = 'static-code';
  private analyzedUrls = new Set<string>();
  private maxExternalScripts = 5;

  init(analyzer: any): void {
    super.init(analyzer);
    if (typeof window !== 'undefined') {
      if ('requestIdleCallback' in window) {
        (window as any).requestIdleCallback(() => this.scan());
      } else {
        setTimeout(() => this.scan(), 2000);
      }
    }
  }

  scan(): void {
    if (!this.active || typeof document === 'undefined') return;

    try {
      const scripts = document.querySelectorAll('script');
      let externalCount = 0;

      scripts.forEach(script => {
        const src = script.getAttribute('src');

        if (!src) {
          // 1. Audit Inline Script contents
          const code = script.textContent || '';
          if (code.trim() !== '') {
            this.auditCode(code, 'inline-script');
          }
        } else {
          // 2. Audit Same-origin External Scripts
          const fullUrl = this.resolveUrl(src);
          if (this.isSameOrigin(fullUrl) && !this.analyzedUrls.has(fullUrl) && externalCount < this.maxExternalScripts) {
            this.analyzedUrls.add(fullUrl);
            externalCount++;
            this.fetchAndAuditScript(fullUrl);
          }
        }
      });
    } catch (err: any) {
      this.analyzer.logger.error('Failed executing static code scanner', err);
    }
  }

  private auditCode(code: string, fileName: string): void {
    try {
      const diagnostics = analyzeJSContent(code);
      diagnostics.forEach(diag => {
        this.reportIssue({
          category: diag.category as any,
          type: diag.type,
          severity: diag.severity,
          title: diag.title,
          message: diag.message,
          location: {
            fileName,
            line: diag.line,
            outerHTML: diag.snippet
          }
        });
      });
    } catch (err) {
      this.analyzer.logger.debug(`Error auditing script block for ${fileName}`, err);
    }
  }

  private async fetchAndAuditScript(url: string): Promise<void> {
    try {
      const response = await fetch(url);
      if (response.ok) {
        const code = await response.text();
        const shortName = url.split('/').pop() || url;
        this.auditCode(code, shortName);
      }
    } catch (err) {
      // Catch CORS errors or missing script loads silently
      this.analyzer.logger.debug(`Could not fetch script file for static analysis: ${url}`, err);
    }
  }

  private resolveUrl(url: string): string {
    if (typeof window === 'undefined') return url;
    try {
      return new URL(url, window.location.href).href;
    } catch (e) {
      return url;
    }
  }

  private isSameOrigin(url: string): boolean {
    if (typeof window === 'undefined') return false;
    try {
      const originUrl = new URL(window.location.href);
      const targetUrl = new URL(url);
      return originUrl.origin === targetUrl.origin;
    } catch (e) {
      return false;
    }
  }
}
