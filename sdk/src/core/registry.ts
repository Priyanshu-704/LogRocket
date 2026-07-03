import { Collector } from '../collectors/base';
import { Plugin } from '../types';
import { Analyzer } from './analyzer';

export class Registry {
  private collectors = new Map<string, Collector>();
  private plugins = new Map<string, Plugin>();
  private analyzer: Analyzer;

  constructor(analyzer: Analyzer) {
    this.analyzer = analyzer;
  }

  registerCollector(name: string, collector: Collector): void {
    const isEnabled = this.analyzer.config.collectors?.[name as keyof typeof this.analyzer.config.collectors] !== false;
    
    if (isEnabled) {
      this.analyzer.logger.debug(`Registering and initializing collector: ${name}`);
      try {
        collector.init(this.analyzer);
        this.collectors.set(name, collector);
      } catch (err) {
        this.analyzer.logger.error(`Failed to initialize collector "${name}"`, err);
      }
    } else {
      this.analyzer.logger.debug(`Collector "${name}" is disabled via config.`);
    }
  }

  registerPlugin(plugin: Plugin): void {
    if (this.plugins.has(plugin.name)) {
      this.analyzer.logger.warn(`Plugin with name "${plugin.name}" is already registered.`);
      return;
    }

    this.analyzer.logger.debug(`Loading plugin: ${plugin.name}`);
    try {
      plugin.analyze(this.analyzer);
      this.plugins.set(plugin.name, plugin);
    } catch (err) {
      this.analyzer.logger.error(`Failed to initialize plugin "${plugin.name}"`, err);
    }
  }

  getCollector(name: string): Collector | undefined {
    return this.collectors.get(name);
  }

  scanAll(): void {
    this.collectors.forEach(collector => {
      if (collector.scan) {
        this.analyzer.logger.debug(`Executing on-demand scan for: ${collector.name}`);
        try {
          collector.scan();
        } catch (err) {
          this.analyzer.logger.error(`Error during scan of collector "${collector.name}"`, err);
        }
      }
    });
  }

  clear(): void {
    this.analyzer.logger.debug('Destroying all registered collectors and plugins');
    
    this.collectors.forEach(collector => {
      try {
        collector.destroy();
      } catch (err) {
        this.analyzer.logger.error(`Failed to destroy collector "${collector.name}"`, err);
      }
    });
    this.collectors.clear();

    this.plugins.forEach(plugin => {
      try {
        if (plugin.destroy) {
          plugin.destroy();
        }
      } catch (err) {
        this.analyzer.logger.error(`Failed to destroy plugin "${plugin.name}"`, err);
      }
    });
    this.plugins.clear();
  }
}
