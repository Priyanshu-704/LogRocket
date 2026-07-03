import { BaseCollector } from './base';

export class CSSCollector extends BaseCollector {
  name = 'css';

  init(analyzer: any): void {
    super.init(analyzer);
    if (typeof window !== 'undefined') {
      if ('requestIdleCallback' in window) {
        (window as any).requestIdleCallback(() => this.scan());
      } else {
        setTimeout(() => this.scan(), 1500);
      }
    }
  }

  scan(): void {
    if (!this.active || typeof document === 'undefined') return;

    try {
      const sheets = document.styleSheets;
      const seenMediaQueries = new Set<string>();

      for (let i = 0; i < sheets.length; i++) {
        const sheet = sheets[i];
        
        // Wrap cssRules access in try-catch to avoid CORS SecurityError on external CDN stylesheets
        let rules: CSSRuleList | null = null;
        try {
          rules = sheet.cssRules;
        } catch (e) {
          // Silent catch for cross-origin style sheets
          continue;
        }

        if (!rules) continue;

        this.scanRules(rules, seenMediaQueries, sheet.href || 'inline');
      }
    } catch (err: any) {
      this.analyzer.logger.error('Failed executing CSS scanner', err);
    }
  }

  private scanRules(rules: CSSRuleList, seenMediaQueries: Set<string>, stylesheetUrl: string): void {
    for (let j = 0; j < rules.length; j++) {
      const rule = rules[j];

      // 1. Check style rules
      if (rule instanceof CSSStyleRule) {
        this.auditStyleRule(rule, stylesheetUrl);
      }

      // 2. Check media queries
      if (rule instanceof CSSMediaRule) {
        const mediaText = rule.media.mediaText;
        if (seenMediaQueries.has(mediaText)) {
          this.reportIssue({
            category: 'css',
            type: 'duplicate-media-query',
            severity: 'low',
            title: `Duplicate media query: ${mediaText}`,
            message: `The media query "${mediaText}" is defined multiple times. Consolidate rules to improve CSS maintainability and load size.`,
            location: { fileName: stylesheetUrl }
          });
        } else {
          seenMediaQueries.add(mediaText);
        }

        // Recursively audit rules inside the media query
        try {
          if (rule.cssRules) {
            this.scanRules(rule.cssRules, seenMediaQueries, stylesheetUrl);
          }
        } catch (e) {
          // Ignore rule access errors inside media query
        }
      }

      // 3. Check keyframes for performance issues
      if (rule instanceof CSSKeyframesRule) {
        this.auditKeyframesRule(rule, stylesheetUrl);
      }
    }
  }

  private auditStyleRule(rule: CSSStyleRule, stylesheetUrl: string): void {
    const selector = rule.selectorText;
    const style = rule.style;

    // 1. High Specificity check: e.g. contains multiple IDs or excessively nested elements
    const idCount = (selector.match(/#/g) || []).length;
    if (idCount > 1) {
      this.reportIssue({
        category: 'css',
        type: 'high-specificity-selector',
        severity: 'low',
        title: 'High specificity CSS selector',
        message: `Selector "${selector}" contains multiple ID selectors. High specificity makes styles hard to override and maintain.`,
        location: { selector, fileName: stylesheetUrl }
      });
    }

    // 2. Unused CSS Selector check (for simple static selectors)
    // Avoid pseudo-selectors (:hover, :focus, etc.) and pseudo-elements (::before, ::after)
    if (
      !selector.includes(':') &&
      !selector.includes('@') &&
      !selector.includes('[') && // Skip complex attribute selectors
      selector !== '*'
    ) {
      try {
        const matched = document.querySelector(selector);
        if (!matched) {
          this.reportIssue({
            category: 'css',
            type: 'unused-selector',
            severity: 'low',
            title: 'Unused CSS selector',
            message: `Selector "${selector}" did not match any elements currently in the DOM. Check if this is dead code.`,
            location: { selector, fileName: stylesheetUrl }
          });
        }
      } catch (e) {
        // querySelector may throw on advanced custom pseudo selectors we missed
      }
    }

    // 3. Expensive properties & transition properties
    const transitionProperty = style.transitionProperty;
    if (transitionProperty) {
      const expensiveProperties = ['width', 'height', 'top', 'left', 'right', 'bottom', 'margin', 'padding', 'border'];
      const matchedExp = expensiveProperties.filter(prop => transitionProperty.includes(prop));
      if (matchedExp.length > 0) {
        this.reportIssue({
          category: 'performance',
          type: 'expensive-transition',
          severity: 'medium',
          title: `Expensive transition property: ${matchedExp.join(', ')}`,
          message: `Transitioning layout properties like "${matchedExp.join(', ')}" triggers forced browser reflows and repaints. Animate "transform" or "opacity" instead for 60fps animations.`,
          location: { selector, fileName: stylesheetUrl }
        });
      }
    }

    // 4. Heavy shadow/filters check
    const boxShadow = style.boxShadow;
    if (boxShadow && (boxShadow.includes('px') && (boxShadow.match(/px/g) || []).length > 4)) {
      this.reportIssue({
        category: 'performance',
        type: 'heavy-box-shadow',
        severity: 'low',
        title: 'Heavy box-shadow rendering load',
        message: `Selector "${selector}" uses a highly complex box-shadow. Large blurs or multi-layered shadows can degrade scroll performance, especially on mobile.`,
        location: { selector, fileName: stylesheetUrl }
      });
    }

    const filter = style.filter;
    if (filter && filter.includes('blur')) {
      const match = filter.match(/blur\(([^)]+)\)/);
      if (match) {
        const val = parseFloat(match[1]);
        if (val > 15) {
          this.reportIssue({
            category: 'performance',
            type: 'heavy-blur-filter',
            severity: 'medium',
            title: 'Heavy blur filter detected',
            message: `Selector "${selector}" uses a large blur filter (${val}px). Large blurs are GPU-intensive and can cause laggy scroll performance.`,
            location: { selector, fileName: stylesheetUrl }
          });
        }
      }
    }
  }

  private auditKeyframesRule(rule: CSSKeyframesRule, stylesheetUrl: string): void {
    const name = rule.name;
    const expensiveProps = new Set(['width', 'height', 'top', 'left', 'right', 'bottom', 'margin', 'padding']);
    let hasExpensiveAnim = false;

    for (let i = 0; i < rule.cssRules.length; i++) {
      const keyframe = rule.cssRules[i];
      if (keyframe instanceof CSSKeyframeRule) {
        const style = keyframe.style;
        for (let j = 0; j < style.length; j++) {
          const prop = style[j];
          if (expensiveProps.has(prop)) {
            hasExpensiveAnim = true;
            break;
          }
        }
      }
      if (hasExpensiveAnim) break;
    }

    if (hasExpensiveAnim) {
      this.reportIssue({
        category: 'performance',
        type: 'expensive-animation',
        severity: 'medium',
        title: `Expensive layout animation: @keyframes ${name}`,
        message: `Animation "${name}" modifies layout properties (like width/height/top/left). This forces the browser to recalculate layouts on every frame. Use CSS transforms instead.`,
        location: { fileName: stylesheetUrl }
      });
    }
  }
}
