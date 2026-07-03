import { Plugin } from '../types';

export interface ReactErrorDetails {
  componentStack: string;
}

export class ReactPlugin implements Plugin {
  name = 'React Plugin';
  private analyzer: any;

  analyze(analyzer: any): void {
    this.analyzer = analyzer;
    this.analyzer.logger.debug('React Plugin loaded.');
  }

  /**
   * Captures errors caught inside React Error Boundaries.
   */
  captureException(error: Error, errorInfo: ReactErrorDetails): void {
    if (!this.analyzer) {
      console.warn('[AnalyzerSDK] React Plugin not initialized. Call Analyzer.use(new ReactPlugin()) first.');
      return;
    }

    const componentStack = errorInfo.componentStack || '';
    const componentNameMatch = componentStack.match(/^\s*in\s+(\w+)/m);
    const componentName = componentNameMatch ? componentNameMatch[1] : 'UnknownComponent';

    this.analyzer.addIssue({
      category: 'javascript',
      type: 'react-render-error',
      severity: 'critical',
      title: `React Error in <${componentName}>`,
      message: error.message || 'React component render crash',
      location: {
        fileName: componentName,
        outerHTML: componentStack.substring(0, 400).trim()
      },
      metadata: {
        componentStack,
        stack: error.stack
      }
    });
  }

  /**
   * Measures component render duration and reports slow renders (>16ms).
   */
  trackRenderDuration(componentName: string, durationMs: number): void {
    if (!this.analyzer) return;

    if (durationMs > 16.6) { // Exceeds single 60fps frame
      this.analyzer.addIssue({
        category: 'performance',
        type: 'slow-react-render',
        severity: durationMs > 50 ? 'medium' : 'low',
        title: `Slow React render: <${componentName}>`,
        message: `<${componentName}> component took ${durationMs.toFixed(1)}ms to render. Optimize state updates, use React.memo, or reduce child tree sizes.`,
        location: { fileName: componentName },
        metadata: {
          componentName,
          renderDurationMs: durationMs
        }
      });
    }
  }

  /**
   * Helper utility to create an ErrorBoundary wrapper if React is loaded.
   * Works dynamically to avoid strict compile-time dependency on standard React packages.
   */
  createErrorBoundary(ReactInstance: any, FallbackComponent?: any) {
    const self = this;

    if (!ReactInstance || !ReactInstance.Component) {
      throw new Error('[AnalyzerSDK] Invalid React instance provided to createErrorBoundary.');
    }

    return class AnalyzerErrorBoundary extends ReactInstance.Component {
      state = { hasError: false };

      static getDerivedStateFromError() {
        return { hasError: true };
      }

      componentDidCatch(error: Error, errorInfo: any) {
        self.captureException(error, errorInfo);
      }

      render() {
        if (this.state.hasError) {
          if (FallbackComponent) {
            return ReactInstance.createElement(FallbackComponent);
          }
          return ReactInstance.createElement(
            'div',
            { style: { padding: '20px', border: '1px solid #ff4d4f', borderRadius: '4px', backgroundColor: '#fff2f0' } },
            ReactInstance.createElement('h3', { style: { color: '#ff4d4f', margin: '0 0 10px 0' } }, 'Something went wrong.'),
            ReactInstance.createElement('p', null, 'A component crash was captured and reported.')
          );
        }
        return this.props.children;
      }
    };
  }
}
