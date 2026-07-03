import { BaseCollector } from './base';
import { getDOMSelector } from '../utils/helpers';

export class SecurityCollector extends BaseCollector {
  name = 'security';

  init(analyzer: any): void {
    super.init(analyzer);
    if (typeof window !== 'undefined') {
      if ('requestIdleCallback' in window) {
        (window as any).requestIdleCallback(() => this.scan());
      } else {
        setTimeout(() => this.scan(), 2500);
      }
    }
  }

  scan(): void {
    if (!this.active || typeof document === 'undefined' || typeof window === 'undefined') return;

    try {
      this.auditCSPPresence();
      this.auditMixedContent();
    } catch (err: any) {
      this.analyzer.logger.error('Failed executing security scanner', err);
    }
  }

  /**
   * Scans for Content Security Policy meta tags.
   */
  private auditCSPPresence(): void {
    const cspMeta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    if (!cspMeta) {
      this.reportIssue({
        category: 'security',
        type: 'missing-csp',
        severity: 'high',
        title: 'Missing Content Security Policy (CSP)',
        message: 'No CSP meta tag was detected. Content Security Policy is vital to mitigate Cross-Site Scripting (XSS) and data injection vulnerabilities.',
        location: { fileName: 'index.html' }
      });
    }
  }

  /**
   * Audits page resources for mixed content (HTTP files loaded inside HTTPS).
   */
  private auditMixedContent(): void {
    const isHttps = window.location.protocol === 'https:';
    if (!isHttps) return; // Only relevant for HTTPS sites

    // 1. Audit Images
    const images = document.querySelectorAll('img');
    images.forEach(img => {
      const src = img.getAttribute('src');
      if (src && src.startsWith('http://')) {
        this.reportIssue({
          category: 'security',
          type: 'mixed-content',
          severity: 'high',
          title: `Mixed Content Warning: insecure image load`,
          message: `Insecure image loaded over HTTP on HTTPS site: "${src}". Update URL to use HTTPS secure protocol.`,
          location: {
            selector: getDOMSelector(img),
            outerHTML: img.outerHTML.substring(0, 150)
          }
        });
      }
    });

    // 2. Audit Scripts
    const scripts = document.querySelectorAll('script');
    scripts.forEach(script => {
      const src = script.getAttribute('src');
      if (src && src.startsWith('http://')) {
        this.reportIssue({
          category: 'security',
          type: 'mixed-content-script',
          severity: 'critical',
          title: `Mixed Content Blocker: insecure script load`,
          message: `Insecure active script loaded over HTTP on HTTPS site: "${src}". Browsers block insecure scripts on secure pages due to security risks.`,
          location: {
            selector: getDOMSelector(script),
            outerHTML: script.outerHTML.substring(0, 150)
          }
        });
      }
    });

    // 3. Audit Stylesheets
    const links = document.querySelectorAll('link[rel="stylesheet"]');
    links.forEach(link => {
      const href = link.getAttribute('href');
      if (href && href.startsWith('http://')) {
        this.reportIssue({
          category: 'security',
          type: 'mixed-content-stylesheet',
          severity: 'high',
          title: `Mixed Content Blocker: insecure stylesheet load`,
          message: `Insecure stylesheet stylesheet loaded over HTTP on HTTPS site: "${href}". Update stylesheet link to use HTTPS.`,
          location: {
            selector: getDOMSelector(link),
            outerHTML: link.outerHTML.substring(0, 150)
          }
        });
      }
    });
  }
}
