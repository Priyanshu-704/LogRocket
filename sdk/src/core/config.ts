import { AnalyzerConfig } from '../types';

export const DEFAULT_CONFIG: Partial<AnalyzerConfig> = {
  endpoint: 'https://api.mytool.com/sdk/report',
  environment: 'production',
  debug: false,
  sampleRate: 1.0,
  collectors: {
    dom: true,
    css: true,
    errors: true,
    network: true,
    performance: true,
    'static-code': true,
    security: true,
  },
  rules: {}
};

/**
 * Merges user config with defaults.
 */
export function mergeConfig(userConfig: AnalyzerConfig): AnalyzerConfig {
  if (!userConfig.projectId) {
    throw new Error('[AnalyzerSDK] Missing required option: projectId');
  }

  return {
    ...DEFAULT_CONFIG,
    ...userConfig,
    collectors: {
      ...DEFAULT_CONFIG.collectors,
      ...userConfig.collectors,
    },
    rules: {
      ...DEFAULT_CONFIG.rules,
      ...userConfig.rules,
    }
  };
}
