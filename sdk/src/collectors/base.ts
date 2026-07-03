import type { Analyzer } from '../core/analyzer';

export interface Collector {
  name: string;
  init(analyzer: Analyzer): void;
  scan?(): void;
  destroy(): void;
}

export abstract class BaseCollector implements Collector {
  abstract name: string;
  protected analyzer!: Analyzer;
  protected active = false;

  init(analyzer: Analyzer): void {
    this.analyzer = analyzer;
    this.active = true;
  }

  destroy(): void {
    this.active = false;
  }

  protected reportIssue(issue: Omit<import('../types').Issue, 'id' | 'timestamp'>) {
    if (!this.active) return;
    
    // Check if the specific rule is disabled in the configuration
    const rulesConfig = this.analyzer.config.rules;
    if (rulesConfig) {
      const ruleVal = rulesConfig[issue.type];
      if (ruleVal === false) {
        return; // Rule explicitly disabled
      }
      if (typeof ruleVal === 'object') {
        if (ruleVal.enabled === false) {
          return; // Rule explicitly disabled
        }
        if (ruleVal.severity) {
          // Override severity
          issue.severity = ruleVal.severity;
        }
      }
    }

    // Create deterministic ID based on category, type, and location details
    const locator = issue.location?.selector || 
                    issue.location?.fileName || 
                    issue.location?.outerHTML || 
                    issue.message;
    
    const hashInput = `${issue.category}:${issue.type}:${locator}`;
    const id = this.hashString(hashInput);

    this.analyzer.addIssue({
      ...issue,
      id,
      timestamp: Date.now()
    });
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(36);
  }
}
