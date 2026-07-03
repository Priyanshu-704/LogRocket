import { BaseCollector } from './base';
import { getDOMSelector } from '../utils/helpers';
import { checkColorContrast, checkHeadingHierarchy, checkKeyboardNavigation } from '../rules/a11y-rules';
import { checkSEOMetadata } from '../rules/seo-rules';

export class DOMCollector extends BaseCollector {
  name = 'dom';
  private observer: MutationObserver | null = null;
  private scanTimeout: any = null;

  init(analyzer: any): void {
    super.init(analyzer);
    this.setupMutationObserver();
    // Schedule initial scan when browser is idle
    if (typeof window !== 'undefined') {
      if ('requestIdleCallback' in window) {
        (window as any).requestIdleCallback(() => this.scan());
      } else {
        setTimeout(() => this.scan(), 1000);
      }
    }
  }

  destroy(): void {
    super.destroy();
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    if (this.scanTimeout) {
      clearTimeout(this.scanTimeout);
    }
  }

  /**
   * Performs an on-demand complete DOM, accessibility, and SEO audit.
   */
  scan(): void {
    if (!this.active || typeof document === 'undefined') return;

    try {
      // 1. Audit document-level Headings structure
      const headingIssues = checkHeadingHierarchy();
      headingIssues.forEach(issue => this.reportIssue(issue));

      // 2. Audit document-level SEO Metadata
      const seoIssues = checkSEOMetadata();
      seoIssues.forEach(issue => this.reportIssue(issue));

      const root = document.documentElement;
      const seenIds = new Set<string>();
      const duplicateIds = new Set<string>();
      let totalNodes = 0;
      let maxDepth = 0;

      const deprecatedTags = new Set([
        'center', 'font', 'big', 'strike', 'tt', 'dir', 
        'frame', 'frameset', 'acronym', 'applet', 'basefont', 
        'isindex', 'noframes', 'blink', 'marquee'
      ]);

      const traverse = (node: Element, depth: number) => {
        totalNodes++;
        if (depth > maxDepth) maxDepth = depth;

        const tagName = node.tagName.toLowerCase();

        // Run per-element accessibility checks if node is an HTMLElement
        if (node instanceof HTMLElement) {
          const contrastIssue = checkColorContrast(node);
          if (contrastIssue) this.reportIssue(contrastIssue);

          const keyNavIssue = checkKeyboardNavigation(node);
          if (keyNavIssue) this.reportIssue(keyNavIssue);
        }

        // 3. Deprecated Tags Check
        if (deprecatedTags.has(tagName)) {
          this.reportIssue({
            category: 'html',
            type: 'deprecated-tag',
            severity: 'medium',
            title: `Deprecated HTML tag <${tagName}>`,
            message: `The tag <${tagName}> is deprecated in HTML5 and should not be used.`,
            location: {
              selector: getDOMSelector(node),
              outerHTML: node.outerHTML.substring(0, 150)
            }
          });
        }

        // 4. Duplicate IDs Check
        if (node.id) {
          if (seenIds.has(node.id)) {
            duplicateIds.add(node.id);
            this.reportIssue({
              category: 'dom',
              type: 'duplicate-id',
              severity: 'high',
              title: `Duplicate ID detected: #${node.id}`,
              message: `The ID "${node.id}" is used multiple times in the DOM, which violates HTML standards and causes problems for DOM queries, styling, and accessibility.`,
              location: {
                selector: getDOMSelector(node),
                outerHTML: node.outerHTML.substring(0, 150)
              }
            });
          } else {
            seenIds.add(node.id);
          }
        }

        // 5. Inline Styles Check
        if (node.hasAttribute('style')) {
          this.reportIssue({
            category: 'html',
            type: 'inline-style',
            severity: 'low',
            title: 'Inline style attribute found',
            message: 'Avoid inline styles; use external stylesheets or CSS variables for separation of concerns and Content Security Policy safety.',
            location: {
              selector: getDOMSelector(node),
              outerHTML: node.outerHTML.substring(0, 150)
            }
          });
        }

        // 6. Image Checks (Missing Alt / Broken Src / Missing lazy-load on large assets)
        if (tagName === 'img') {
          const alt = node.getAttribute('alt');
          if (alt === null) {
            this.reportIssue({
              category: 'accessibility',
              type: 'missing-alt-attribute',
              severity: 'high',
              title: 'Image missing alt attribute',
              message: 'Images must have an alt attribute to ensure screen readers can describe them to visually impaired users. Use an empty alt="" for decorative images.',
              location: {
                selector: getDOMSelector(node),
                outerHTML: node.outerHTML.substring(0, 150)
              }
            });
          }

          const src = node.getAttribute('src');
          if (!src || src.trim() === '') {
            this.reportIssue({
              category: 'html',
              type: 'broken-image',
              severity: 'high',
              title: 'Image missing src attribute',
              message: 'Image tag has an empty or missing src attribute.',
              location: {
                selector: getDOMSelector(node),
                outerHTML: node.outerHTML.substring(0, 150)
              }
            });
          }
        }

        // 7. Empty Links Check
        if (tagName === 'a') {
          const href = node.getAttribute('href');
          if (!href || href === '#' || href.startsWith('javascript:')) {
            this.reportIssue({
              category: 'html',
              type: 'empty-link',
              severity: 'medium',
              title: 'Empty or placeholder link href',
              message: `Link contains a placeholder or empty href "${href || ''}". Use <button> for JS-triggered actions, or point to a valid URL.`,
              location: {
                selector: getDOMSelector(node),
                outerHTML: node.outerHTML.substring(0, 150)
              }
            });
          }
        }

        // 8. Accessible Input Elements Check
        if (['input', 'select', 'textarea'].includes(tagName)) {
          const type = node.getAttribute('type');
          if (type !== 'submit' && type !== 'button' && type !== 'hidden' && type !== 'image') {
            const hasId = !!node.id;
            const hasLabel = hasId && !!document.querySelector(`label[for="${node.id}"]`);
            const isLabelChild = !!node.closest('label');
            const hasAriaLabel = node.hasAttribute('aria-label') || node.hasAttribute('aria-labelledby');

            if (!hasLabel && !isLabelChild && !hasAriaLabel) {
              this.reportIssue({
                category: 'accessibility',
                type: 'missing-form-label',
                severity: 'high',
                title: `Form input element missing associated label`,
                message: `Inputs, selects, and textareas should have a corresponding <label> or aria-label attribute for accessibility.`,
                location: {
                  selector: getDOMSelector(node),
                  outerHTML: node.outerHTML.substring(0, 150)
                }
              });
            }
          }
        }

        // Recursive children traversal
        let child = node.firstElementChild;
        while (child) {
          traverse(child, depth + 1);
          child = child.nextElementSibling;
        }
      };

      traverse(root, 1);

      // Report DOM Tree size issues
      if (totalNodes > 1500) {
        this.reportIssue({
          category: 'performance',
          type: 'excessive-dom-size',
          severity: totalNodes > 3000 ? 'high' : 'medium',
          title: 'Excessive DOM size detected',
          message: `Your page has ${totalNodes} DOM elements. Large DOM trees can slow down browser rendering, increase memory usage, and impact runtime interactivity. Target less than 1,500 elements.`,
          metadata: { totalNodes, recommendedMax: 1500 }
        });
      }

      if (maxDepth > 32) {
        this.reportIssue({
          category: 'performance',
          type: 'excessive-dom-depth',
          severity: 'medium',
          title: 'Deep DOM tree detected',
          message: `Max DOM depth is ${maxDepth}. Deeply nested DOM nodes increase style computation time and risk forced reflow performance bottlenecks. Keep depth under 32.`,
          metadata: { maxDepth, recommendedMax: 32 }
        });
      }

    } catch (err: any) {
      this.analyzer.logger.error('Failed executing DOM scanner', err);
    }
  }

  /**
   * Setup MutationObserver to watch DOM updates and run a debounced scan.
   */
  private setupMutationObserver(): void {
    if (typeof MutationObserver === 'undefined' || typeof document === 'undefined') return;

    this.observer = new MutationObserver((mutations) => {
      // Check if mutations actually added nodes
      let hasAdditions = false;
      for (const mutation of mutations) {
        if (mutation.addedNodes && mutation.addedNodes.length > 0) {
          hasAdditions = true;
          break;
        }
      }

      if (hasAdditions) {
        if (this.scanTimeout) clearTimeout(this.scanTimeout);
        this.scanTimeout = setTimeout(() => this.scan(), 2000); // scan 2s after elements stop mutating
      }
    });

    this.observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }
}
