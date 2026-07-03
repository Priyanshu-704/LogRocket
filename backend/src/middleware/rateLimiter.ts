import { Request, Response, NextFunction } from 'express';

interface RateLimitData {
  count: number;
  resetTime: number;
}

const store = new Map<string, RateLimitData>();

// Periodic memory cleanup timer to prevent storage leaks
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, value] of store.entries()) {
      if (now > value.resetTime) {
        store.delete(key);
      }
    }
  }, 5 * 60 * 1000); // Clean every 5 minutes
}

/**
 * Custom in-memory rate-limiting middleware factory.
 * @param limit Max requests allowed in the window.
 * @param windowMs Timeframe window in milliseconds.
 */
export function rateLimiter(limit = 100, windowMs = 60 * 1000) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Identify by IP address or API Key header
    const apiKey = req.headers['x-api-key'] || req.query.apiKey;
    const identifier = typeof apiKey === 'string' ? `key:${apiKey}` : `ip:${req.ip || 'unknown'}`;
    
    const now = Date.now();
    let clientData = store.get(identifier);

    if (!clientData || now > clientData.resetTime) {
      clientData = {
        count: 1,
        resetTime: now + windowMs
      };
      store.set(identifier, clientData);

      res.setHeader('X-RateLimit-Limit', limit);
      res.setHeader('X-RateLimit-Remaining', limit - 1);
      res.setHeader('X-RateLimit-Reset', Math.ceil(clientData.resetTime / 1000));
      
      return next();
    }

    if (clientData.count >= limit) {
      res.setHeader('X-RateLimit-Limit', limit);
      res.setHeader('X-RateLimit-Remaining', 0);
      res.setHeader('Retry-After', Math.ceil((clientData.resetTime - now) / 1000));
      
      return res.status(429).json({
        status: 'fail',
        statusCode: 429,
        message: 'Too many requests. Please throttle your transmission rates.'
      });
    }

    clientData.count++;
    
    res.setHeader('X-RateLimit-Limit', limit);
    res.setHeader('X-RateLimit-Remaining', limit - clientData.count);
    res.setHeader('X-RateLimit-Reset', Math.ceil(clientData.resetTime / 1000));
    
    next();
  };
}

export default rateLimiter;
