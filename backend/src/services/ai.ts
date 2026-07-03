export interface AISuggestion {
  explanation: string;
  fixCode?: string;
  referenceUrl?: string;
}

/**
 * Generates automated recommendations and code refactoring suggestions for issues.
 */
export function generateAISuggestion(
  category: string,
  type: string,
  title: string,
  message: string,
  location?: { selector?: string; outerHTML?: string; fileName?: string; line?: number }
): AISuggestion {
  const outerHTML = location?.outerHTML || '';

  // 1. Exposed Secrets
  if (type === 'exposed-secret') {
    return {
      explanation: 'Sensitive credentials or API private tokens were found hardcoded in your static files. Hardcoded secrets are easily extracted by attackers, leading to account takeover or data breach.',
      fixCode: `// Bad Practice:
const AWS_KEY = "AKIAIOSFODNN7EXAMPLE"; // Hardcoded in client-side code

// Recommended Solution:
// Use backend environment variables and proxy requests through your API Gateway.
// In your Node.js backend (.env):
// AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
// In your backend code:
const s3 = new AWS.S3({ accessKeyId: process.env.AWS_ACCESS_KEY_ID });`,
      referenceUrl: 'https://owasp.org/www-community/Source_Code_Analysis'
    };
  }

  // 2. Unsafe innerHTML
  if (type === 'unsafe-inner-html') {
    return {
      explanation: 'Directly assigning unescaped variables or user inputs to element.innerHTML creates a serious Cross-Site Scripting (XSS) injection risk. Malicious scripts can execute in the context of the user session.',
      fixCode: `// Bad Practice:
element.innerHTML = userProvidedInput;

// Solution 1: Use textContent for plain text (automatically sanitizes)
element.textContent = userProvidedInput;

// Solution 2: Use DOMPurify to sanitize HTML payloads if markup rendering is required
import DOMPurify from 'dompurify';
element.innerHTML = DOMPurify.sanitize(userProvidedInput);`,
      referenceUrl: 'https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html'
    };
  }

  // 3. Callback Hell / Nested Loops
  if (type === 'callback-hell') {
    return {
      explanation: 'High indentation levels due to nested callback loops decrease code readability, complicate error management, and increase bug introduction risks.',
      fixCode: `// Bad Practice (Callback nesting):
getUser(userId, (user) => {
  getOrders(user.id, (orders) => {
    getOrderDetails(orders[0].id, (details) => {
      console.log(details);
    });
  });
});

// Solution: Refactor utilizing async/await and ES6 Promises
async function fetchOrderDetails(userId) {
  try {
    const user = await getUser(userId);
    const orders = await getOrders(user.id);
    const details = await getOrderDetails(orders[0].id);
    return details;
  } catch (error) {
    console.error("Failed to load details", error);
  }
}`,
      referenceUrl: 'https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Asynchronous/Promises'
    };
  }

  // 4. Low Color Contrast
  if (type === 'poor-contrast') {
    return {
      explanation: 'The text color contrast ratio falls below WCAG AA requirements (4.5:1 ratio). Low contrast renders readability extremely difficult for visually impaired users, impacting page accessibility scores.',
      fixCode: `/* Bad Practice */
.my-text {
  color: #7f8c8d; /* Medium grey text */
  background-color: #ffffff; /* White background. Ratio is 3.5:1 */
}

/* Solution: Darken foreground color to increase contrast to at least 4.5:1 */
.my-text {
  color: #2c3e50; /* Dark slate text. Ratio becomes 9.8:1 */
  background-color: #ffffff;
}`,
      referenceUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html'
    };
  }

  // 5. Mixed Content
  if (type.startsWith('mixed-content')) {
    return {
      explanation: 'An asset (image, stylesheet, or script) is being loaded over unencrypted HTTP protocol inside a secure HTTPS context. Browsers block active HTTP mixed content (like scripts), causing loading failures and protocol security warnings.',
      fixCode: `<!-- Bad Practice -->
<script src="http://example.com/analytics.js"></script>

<!-- Solution: Ensure all assets load securely over HTTPS -->
<script src="https://example.com/analytics.js"></script>`,
      referenceUrl: 'https://developer.mozilla.org/en-US/docs/Web/Security/Mixed_content'
    };
  }

  // 6. Duplicate ID
  if (type === 'duplicate-id') {
    return {
      explanation: 'Multiple elements carry the same ID attribute. Document IDs must be unique per document page. Duplicate IDs cause page styling glitches, broken focus transitions, and unpredictable results on DOM queries.',
      fixCode: `<!-- Bad Practice -->
<div id="sidebar">Left Menu</div>
<div id="sidebar">Right Menu</div>

<!-- Solution: Convert duplicate IDs to reusable CSS class names -->
<div class="sidebar">Left Menu</div>
<div class="sidebar">Right Menu</div>`,
      referenceUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/id'
    };
  }

  // Default Fallback
  return {
    explanation: `An issue of category "${category}" and type "${type}" was identified. Review the issue title and file details to trace and resolve the issue.`,
    referenceUrl: 'https://developer.mozilla.org/en-US/'
  };
}
