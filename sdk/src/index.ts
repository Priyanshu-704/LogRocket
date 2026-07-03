import { Analyzer } from './core/analyzer';

// Instantiate the singleton SDK core
const analyzerInstance = new Analyzer();

// Export named and default exports for module bundlers (ES/CJS)
export default analyzerInstance;
export { analyzerInstance as Analyzer };

// Bind singleton to global window object for direct HTML CDN script tags
if (typeof window !== 'undefined') {
  (window as any).Analyzer = analyzerInstance;

  // Auto-initialize if loaded via CDN script tag with data-project-id attributes
  if (typeof document !== 'undefined') {
    const currentScript = document.currentScript || document.querySelector('script[data-project-id]');
    if (currentScript) {
      const projectId = currentScript.getAttribute('data-project-id');
      if (projectId) {
        const environment = (currentScript.getAttribute('data-env') || 'production') as any;
        const endpoint = currentScript.getAttribute('data-endpoint') || 'http://localhost:5000/sdk/report';
        const debug = currentScript.getAttribute('data-debug') === 'true' || environment === 'development';
        
        analyzerInstance.init({
          projectId,
          environment,
          endpoint,
          debug
        });
        
        analyzerInstance.logger.info(`Auto-initialized SDK for project: ${projectId}`);
        // Run initial audit scan
        setTimeout(() => {
          analyzerInstance.scan();
        }, 500);
      }
    }
  }
}
