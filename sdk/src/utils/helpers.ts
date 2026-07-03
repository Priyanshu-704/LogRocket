/**
 * Generates a unique CSS selector path for a given DOM Element.
 */
export function getDOMSelector(el: Element): string {
  if (!el || el.nodeType !== Node.ELEMENT_NODE) return '';
  if (el.id) return `#${el.id}`;
  
  const path: string[] = [];
  let current: Element | null = el;

  while (current && current.nodeType === Node.ELEMENT_NODE) {
    let name = current.nodeName.toLowerCase();
    if (current.id) {
      path.unshift(`#${current.id}`);
      break;
    } else {
      let sibling = current.previousElementSibling;
      let index = 1;
      while (sibling) {
        if (sibling.nodeName === current.nodeName) {
          index++;
        }
        sibling = sibling.previousElementSibling;
      }
      
      const hasSiblings = current.nextElementSibling || index > 1;
      if (hasSiblings) {
        name += `:nth-of-type(${index})`;
      }
      path.unshift(name);
    }
    current = current.parentElement;
  }
  return path.join(' > ');
}

/**
 * Generates a basic deterministic hash code for fingerprinting issues.
 */
export function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Creates a unique fingerprint for an issue.
 */
export function createFingerprint(category: string, type: string, locator: string): string {
  return hashString(`${category}:${type}:${locator}`);
}

/**
 * Debounce helper to defer execution.
 */
export function debounce<T extends (...args: any[]) => void>(fn: T, delay: number): (...args: Parameters<T>) => void {
  let timeoutId: any = null;
  return function (this: any, ...args: Parameters<T>) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn.apply(this, args);
    }, delay);
  };
}

/**
 * Safely runs a callback, trapping any errors.
 */
export function safeExecute<T>(fn: () => T, fallback: T, onError?: (err: Error) => void): T {
  try {
    return fn();
  } catch (error) {
    if (onError && error instanceof Error) {
      onError(error);
    }
    return fallback;
  }
}
