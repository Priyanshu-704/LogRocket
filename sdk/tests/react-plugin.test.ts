import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Analyzer } from '../src/core/analyzer';
import { ReactPlugin } from '../src/plugins/react';

describe('ReactPlugin Integration', () => {
  let analyzer: Analyzer;
  let reactPlugin: ReactPlugin;

  beforeEach(() => {
    analyzer = new Analyzer();
    analyzer.init({
      projectId: 'test-project',
      collectors: {
        dom: false,
        css: false,
        errors: false,
        network: false,
        performance: false,
        'static-code': false,
        security: false
      }
    });

    reactPlugin = new ReactPlugin();
    analyzer.use(reactPlugin);
  });

  afterEach(() => {
    analyzer.destroy();
  });

  it('should capture component exceptions', () => {
    const error = new Error('State mapping failed');
    const errorInfo = { componentStack: '\n  in HeaderComponent\n  in App' };

    reactPlugin.captureException(error, errorInfo);

    const report = analyzer.getReport();
    const issue = report?.issues.find(i => i.type === 'react-render-error');
    expect(issue).toBeDefined();
    expect(issue?.title).toBe('React Error in <HeaderComponent>');
    expect(issue?.message).toBe('State mapping failed');
    expect(issue?.metadata?.componentStack).toContain('HeaderComponent');
  });

  it('should report slow render durations exceeding 16.6ms frame budgets', () => {
    reactPlugin.trackRenderDuration('ProductList', 45.2);

    const report = analyzer.getReport();
    const issue = report?.issues.find(i => i.type === 'slow-react-render');
    expect(issue).toBeDefined();
    expect(issue?.title).toContain('ProductList');
    expect(issue?.metadata?.renderDurationMs).toBe(45.2);
  });

  it('should not report fast render durations', () => {
    reactPlugin.trackRenderDuration('Navbar', 4.5);

    const report = analyzer.getReport();
    const issue = report?.issues.find(i => i.type === 'slow-react-render');
    expect(issue).toBeUndefined();
  });

  it('should correctly wrap React components using createErrorBoundary', () => {
    // Mock class-based React Component model
    class MockReactComponent {
      props: any;
      constructor(props: any) {
        this.props = props;
      }
    }

    const mockReactInstance = {
      Component: MockReactComponent,
      createElement: vi.fn((type, props, ...children) => ({ type, props, children }))
    };

    const ErrorBoundary = reactPlugin.createErrorBoundary(mockReactInstance);
    expect(ErrorBoundary).toBeDefined();

    const instance = new ErrorBoundary({ children: 'test-children' });
    expect(instance.state.hasError).toBe(false);

    // Call lifecycle hooks
    const error = new Error('Test boundary crash');
    const info = { componentStack: 'in TestComponent' };
    
    instance.componentDidCatch(error, info);

    const report = analyzer.getReport();
    const issue = report?.issues.find(i => i.type === 'react-render-error');
    expect(issue).toBeDefined();
    expect(issue?.title).toBe('React Error in <TestComponent>');
  });
});
