export interface CodeDiagnostic {
  type: string;
  category: 'security' | 'dx' | 'code-quality' | 'javascript';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  line: number;
  snippet: string;
}

interface RegexRule {
  type: string;
  category: 'security' | 'dx' | 'code-quality' | 'javascript';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  pattern: RegExp;
}

const REGEX_RULES: RegexRule[] = [
  {
    type: 'exposed-secret',
    category: 'security',
    severity: 'critical',
    title: 'Exposed credentials / API secret key',
    message: 'A potential secret key, API token, or private key was found hardcoded in JavaScript code. Avoid committing sensitive secrets to client-side code.',
    pattern: /(?:api_key|apikey|secret_key|secret|passwd|password|private_key|auth_token|bearer)\s*[:=]\s*["']([A-Za-z0-9_\-\.\/+=]{16,128})["']/i
  },
  {
    type: 'debugger-statement',
    category: 'dx',
    severity: 'high',
    title: 'Debugger statement left in production',
    message: 'The "debugger;" statement halts execution if developer tools are open. Remove debugger statements before deploying.',
    pattern: /\bdebugger\b/
  },
  {
    type: 'console-log',
    category: 'dx',
    severity: 'low',
    title: 'Console.log in production',
    message: 'Remove console.log statements from production code to keep the console clean and prevent leakage of runtime variables.',
    pattern: /\bconsole\.log\(/
  },
  {
    type: 'unsafe-inner-html',
    category: 'security',
    severity: 'high',
    title: 'Unsafe innerHTML usage',
    message: 'Direct assignment to innerHTML can expose the application to Cross-Site Scripting (XSS) attacks. Use textContent or DOMParser/sanitize methods.',
    pattern: /\.innerHTML\s*=/
  },
  {
    type: 'local-storage-use',
    category: 'security',
    severity: 'low',
    title: 'Local/Session storage reference',
    message: 'Local storage can be accessed by any client script. Ensure no sensitive customer data or credentials are saved in storage.',
    pattern: /\b(localStorage|sessionStorage)\.setItem\(/
  },
  {
    type: 'todo-comment',
    category: 'dx',
    severity: 'low',
    title: 'TODO comment found',
    message: 'A TODO marker was found in comments. Resolve the pending task.',
    pattern: /\/\/\s*TODO\b|\/\*\s*TODO\b/i
  },
  {
    type: 'fixme-comment',
    category: 'dx',
    severity: 'medium',
    title: 'FIXME comment found',
    message: 'A FIXME comment indicates broken or bug-prone logic that needs urgent correction.',
    pattern: /\/\/\s*FIXME\b|\/\*\s*FIXME\b/i
  },
  {
    type: 'document-write',
    category: 'security',
    severity: 'high',
    title: 'Deprecated document.write()',
    message: 'document.write() is blocking, insecure, and deprecated in modern HTML rendering. Use element injection methods.',
    pattern: /document\.write\(/
  },
  {
    type: 'poor-variable-name',
    category: 'code-quality',
    severity: 'low',
    title: 'Poor variable naming convention',
    message: 'Avoid using temporary/generic variable names like "temp", "tmp", "foo", "bar", or single character names in variable declarations.',
    pattern: /\b(?:let|var|const)\s+(?:temp|tmp|foo|bar|[a-z])\b\s*=/
  }
];

/**
 * Runs static analysis rules line-by-line on JavaScript source code.
 */
export function analyzeJSContent(code: string): CodeDiagnostic[] {
  const diagnostics: CodeDiagnostic[] = [];
  const lines = code.split('\n');
  
  let braceNesting = 0;
  let maxNestingInLine = 0;

  for (let index = 0; index < lines.length; index++) {
    const lineContent = lines[index];
    const lineNumber = index + 1;

    // Skip empty lines or import lines
    if (lineContent.trim() === '') continue;

    // Check simple regex rules
    for (const rule of REGEX_RULES) {
      if (rule.pattern.test(lineContent)) {
        // Exclude dummy test matches if necessary, make sure it is not matching the rule definitions
        if (lineContent.includes('pattern: /')) continue;

        diagnostics.push({
          type: rule.type,
          category: rule.category,
          severity: rule.severity,
          title: rule.title,
          message: rule.message,
          line: lineNumber,
          snippet: lineContent.trim().substring(0, 120)
        });
      }
    }

    // Complexity Analysis: count nesting braces
    for (let charIndex = 0; charIndex < lineContent.length; charIndex++) {
      const char = lineContent[charIndex];
      if (char === '{') braceNesting++;
      if (char === '}') braceNesting = Math.max(0, braceNesting - 1);
    }

    if (braceNesting > maxNestingInLine) {
      maxNestingInLine = braceNesting;
    }

    // Nested callback check (nesting depth > 5 indicates potential callback hell)
    if (braceNesting > 5 && !diagnostics.some(d => d.type === 'callback-hell' && d.line === lineNumber)) {
      diagnostics.push({
        type: 'callback-hell',
        category: 'code-quality',
        severity: 'medium',
        title: 'Deep code nesting (Callback Hell)',
        message: `Line has a nesting depth of ${braceNesting}. Deeply nested loops/callbacks hinder readability and increase risk of bugs. Refactor into smaller helper functions.`,
        line: lineNumber,
        snippet: lineContent.trim().substring(0, 120)
      });
    }
  }

  // Large file / size check
  if (lines.length > 800) {
    diagnostics.push({
      type: 'large-file',
      category: 'code-quality',
      severity: 'medium',
      title: 'Large script file detected',
      message: `File contains ${lines.length} lines. Keeping files under 500 lines improves readability and testing modularity.`,
      line: 1,
      snippet: `File size: ${lines.length} lines`
    });
  }

  return diagnostics;
}
