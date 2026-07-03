let isDebugEnabled = false;

const PREFIX = '[AnalyzerSDK]';

export const logger = {
  setDebug(enabled: boolean) {
    isDebugEnabled = enabled;
  },

  debug(message: string, ...args: any[]) {
    if (isDebugEnabled) {
      console.debug(`%c${PREFIX} [DEBUG] %c${message}`, 'color: #8a2be2; font-weight: bold;', 'color: inherit;', ...args);
    }
  },

  info(message: string, ...args: any[]) {
    console.info(`%c${PREFIX} [INFO] %c${message}`, 'color: #008080; font-weight: bold;', 'color: inherit;', ...args);
  },

  warn(message: string, ...args: any[]) {
    console.warn(`%c${PREFIX} [WARN] %c${message}`, 'color: #ffa500; font-weight: bold;', 'color: inherit;', ...args);
  },

  error(message: string, ...args: any[]) {
    console.error(`%c${PREFIX} [ERROR] %c${message}`, 'color: #ff4500; font-weight: bold;', 'color: inherit;', ...args);
  }
};
