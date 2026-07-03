import { Issue } from '../types';
import { getDOMSelector } from '../utils/helpers';

/**
 * Calculates relative luminance from RGB components.
 */
function getLuminance(r: number, g: number, b: number): number {
  const a = [r, g, b].map(v => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

/**
 * Parses RGB or RGBA string from CSS properties.
 */
function parseRGB(colorStr: string): [number, number, number] | null {
  const match = colorStr.match(/\d+/g);
  if (!match || match.length < 3) return null;
  return [parseInt(match[0]), parseInt(match[1]), parseInt(match[2])];
}

/**
 * Evaluates relative WCAG color contrast ratios.
 */
export function checkColorContrast(el: HTMLElement): Omit<Issue, 'id' | 'timestamp'> | null {
  if (typeof window === 'undefined') return null;

  const style = window.getComputedStyle(el);
  const color = style.color;
  
  // Find background color by climbing parent chain if transparent
  let bgColor = style.backgroundColor;
  let parent = el.parentElement;
  
  while ((bgColor === 'rgba(0, 0, 0, 0)' || bgColor === 'transparent') && parent) {
    const parentStyle = window.getComputedStyle(parent);
    bgColor = parentStyle.backgroundColor;
    parent = parent.parentElement;
  }

  // Fallback to white if transparent is unresolvable
  if (bgColor === 'rgba(0, 0, 0, 0)' || bgColor === 'transparent') {
    bgColor = 'rgb(255, 255, 255)';
  }

  const rgbColor = parseRGB(color);
  const rgbBg = parseRGB(bgColor);

  if (!rgbColor || !rgbBg) return null;

  const l1 = getLuminance(rgbColor[0], rgbColor[1], rgbColor[2]);
  const l2 = getLuminance(rgbBg[0], rgbBg[1], rgbBg[2]);

  const ratio = l1 > l2 ? (l1 + 0.05) / (l2 + 0.05) : (l2 + 0.05) / (l1 + 0.05);

  // WCAG threshold is 4.5:1 for normal body text
  if (ratio < 4.5) {
    const textLen = el.textContent?.trim().length || 0;
    if (textLen > 0) {
      return {
        category: 'accessibility',
        type: 'poor-contrast',
        severity: ratio < 3.0 ? 'high' : 'medium',
        title: `Low color contrast ratio (${ratio.toFixed(2)}:1)`,
        message: `Contrast ratio is ${ratio.toFixed(2)}:1. Text must meet WCAG AA requirements of 4.5:1 contrast against its background to ensure readability for visually impaired users.`,
        location: {
          selector: getDOMSelector(el),
          outerHTML: el.outerHTML.substring(0, 120)
        },
        metadata: {
          contrastRatio: ratio,
          foregroundColor: color,
          backgroundColor: bgColor
        }
      };
    }
  }

  return null;
}

/**
 * Audits document headings structure.
 */
export function checkHeadingHierarchy(): Omit<Issue, 'id' | 'timestamp'>[] {
  const issues: Omit<Issue, 'id' | 'timestamp'>[] = [];
  const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));

  if (headings.length === 0) {
    issues.push({
      category: 'accessibility',
      type: 'missing-headings',
      severity: 'medium',
      title: 'Missing headings structure',
      message: 'The page does not contain any heading tags (h1-h6). Structured headings help assistive technologies index the page contents.',
    });
    return issues;
  }

  const h1Count = headings.filter(h => h.tagName === 'H1').length;
  if (h1Count === 0) {
    issues.push({
      category: 'seo',
      type: 'missing-h1',
      severity: 'high',
      title: 'Missing main H1 heading',
      message: 'Every page should contain exactly one <h1> element outlining the page topic.',
    });
  } else if (h1Count > 1) {
    issues.push({
      category: 'seo',
      type: 'multiple-h1-headings',
      severity: 'medium',
      title: 'Multiple H1 headings detected',
      message: `The page contains ${h1Count} <h1> headings. Consolidate to a single <h1> for clearer document structure.`,
    });
  }

  // Check skipped heading levels (e.g. h1 to h3)
  let lastLevel = 0;
  for (const h of headings) {
    const level = parseInt(h.tagName[1], 10);
    if (lastLevel > 0 && level > lastLevel + 1) {
      issues.push({
        category: 'accessibility',
        type: 'invalid-heading-order',
        severity: 'low',
        title: `Skipped heading hierarchy (H${lastLevel} to H${level})`,
        message: `Heading levels should increase sequentially without skipping ranks (e.g., an <h2> should precede an <h3>).`,
        location: {
          selector: getDOMSelector(h),
          outerHTML: h.outerHTML.substring(0, 120)
        }
      });
    }
    lastLevel = level;
  }

  return issues;
}

/**
 * Audits keyboard focus rules and custom tab index orders.
 */
export function checkKeyboardNavigation(el: HTMLElement): Omit<Issue, 'id' | 'timestamp'> | null {
  const tabIndexAttr = el.getAttribute('tabindex');

  if (tabIndexAttr) {
    const tabIndexVal = parseInt(tabIndexAttr, 10);
    if (tabIndexVal > 0) {
      return {
        category: 'accessibility',
        type: 'positive-tabindex',
        severity: 'medium',
        title: 'Avoid positive tabIndex values',
        message: `Element has tabindex="${tabIndexVal}". Positive tabIndexes disrupt default screen tab flows, complicating keyboard navigation. Use tabindex="0" or "-1".`,
        location: {
          selector: getDOMSelector(el),
          outerHTML: el.outerHTML.substring(0, 120)
        }
      };
    }
  }

  // Warn if interactive components are missing keyboard capability
  const role = el.getAttribute('role');
  const hasClick = el.hasAttribute('onclick') || (el as any).onclick;
  if ((role === 'button' || role === 'link' || hasClick) && !tabIndexAttr && !['button', 'a', 'input', 'select', 'textarea'].includes(el.tagName.toLowerCase())) {
    return {
      category: 'accessibility',
      type: 'missing-tabindex',
      severity: 'high',
      title: 'Interactive custom element missing keyboard focus',
      message: 'Custom interactive items (with click handlers or roles) must carry a tabindex="0" to be selectable via keyboard.',
      location: {
        selector: getDOMSelector(el),
        outerHTML: el.outerHTML.substring(0, 120)
      }
    };
  }

  return null;
}
