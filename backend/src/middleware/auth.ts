import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import crypto from 'crypto';
import ApiKey from '../models/ApiKey';
import Project from '../models/Project';

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    role: string;
  };
}

/**
 * Protect middleware to verify JWT Authorization bearer token or API Key.
 */
export async function protect(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  let token: string | undefined;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  // Fallback: Check API Key header for developer tools
  const rawApiKey = req.headers['x-api-key'] || req.query.apiKey;
  if (!token && rawApiKey) {
    // Only allow API key auth for source map uploads and issue details/listing!
    const pathPattern = req.baseUrl + req.path;
    const isAllowedApiKeyPath = 
      (req.method === 'POST' && /\/api\/projects\/[^/]+\/source-maps/.test(pathPattern)) ||
      (req.method === 'GET' && /\/api\/issues\/[^/]+/.test(pathPattern)) ||
      (req.method === 'GET' && /\/api\/issues\/detail\/[^/]+/.test(pathPattern));

    if (!isAllowedApiKeyPath) {
      return res.status(403).json({
        status: 'fail',
        message: 'API Key is not authorized to access this administrative endpoint.'
      });
    }

    try {
      const hashedKey = crypto.createHash('sha256').update(String(rawApiKey)).digest('hex');
      const keyRecord = await ApiKey.findOne({ key: hashedKey, isActive: true });
      if (keyRecord) {
        const project = await Project.findById(keyRecord.projectId);
        if (project) {
          req.user = {
            userId: project.ownerId.toString(),
            role: 'developer'
          };
          return next();
        }
      }
    } catch (err) {}
  }

  if (!token) {
    return res.status(401).json({
      status: 'fail',
      message: 'You are not logged in. Please provide a Bearer token or valid API Key.'
    });
  }

  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      status: 'fail',
      message: 'Invalid or expired token. Access denied.'
    });
  }
}

/**
 * Restrict routes to specific user roles.
 */
export function restrictTo(...roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        status: 'fail',
        message: 'You do not have permission to perform this action.'
      });
    }
    next();
  };
}
