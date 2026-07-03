import { Response, NextFunction } from 'express';
import crypto from 'crypto';
import Project from '../models/Project';
import ApiKey from '../models/ApiKey';
import AuditLog from '../models/AuditLog';
import { AuthenticatedRequest } from '../middleware/auth';

/**
 * Creates a new project workspace.
 */
export async function createProject(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { name } = req.body;
    const userId = req.user?.userId;

    if (!name || name.trim() === '') {
      return res.status(400).json({ status: 'fail', message: 'Project name is required.' });
    }

    const project = await Project.create({
      name: name.trim(),
      ownerId: userId
    });

    // Generate initial API Key for the project
    const rawKey = `key_${crypto.randomBytes(24).toString('hex')}`;
    await ApiKey.create({
      key: rawKey,
      projectId: project._id,
      name: 'Default SDK Key'
    });

    // Write to security audit log
    await AuditLog.create({
      userId,
      projectId: project._id,
      action: 'PROJECT_CREATE',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.status(201).json({
      status: 'success',
      data: {
        project,
        apiKey: rawKey
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Retrieves projects owned by the authenticated developer.
 */
export async function getProjects(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const projects = await Project.find({ ownerId: req.user?.userId });
    
    res.status(200).json({
      status: 'success',
      results: projects.length,
      data: { projects }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Provisions a new API key for a project.
 */
export async function generateApiKey(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { projectId } = req.params;
    const { keyName } = req.body;
    const userId = req.user?.userId;

    const project = await Project.findOne({ _id: projectId, ownerId: userId });
    if (!project) {
      return res.status(404).json({ status: 'fail', message: 'Project not found or access denied.' });
    }

    const rawKey = `key_${crypto.randomBytes(24).toString('hex')}`;
    const apiKey = await ApiKey.create({
      key: rawKey,
      projectId: project._id,
      name: keyName || 'SDK Key'
    });

    await AuditLog.create({
      userId,
      projectId: project._id,
      action: 'API_KEY_GENERATE',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.status(201).json({
      status: 'success',
      data: {
        apiKey: rawKey,
        name: apiKey.name,
        isActive: apiKey.isActive
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Updates project settings like Webhook URL.
 */
export async function updateProjectSettings(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { projectId } = req.params;
    const { webhookUrl } = req.body;
    const userId = req.user?.userId;

    const project = await Project.findOneAndUpdate(
      { _id: projectId, ownerId: userId },
      { webhookUrl: webhookUrl?.trim() || '' },
      { new: true }
    );

    if (!project) {
      return res.status(404).json({ status: 'fail', message: 'Project not found or access denied.' });
    }

    res.status(200).json({
      status: 'success',
      data: { project }
    });
  } catch (err) {
    next(err);
  }
}
