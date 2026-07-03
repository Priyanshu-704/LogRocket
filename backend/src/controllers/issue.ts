import { Response, NextFunction } from 'express';
import Issue from '../models/Issue';
import Project from '../models/Project';
import AuditLog from '../models/AuditLog';
import { AuthenticatedRequest } from '../middleware/auth';

/**
 * Retrieves all issues for a given project, filterable by state.
 */
export async function getIssues(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { projectId } = req.params;
    const { category, severity, resolved, type } = req.query;
    const userId = req.user?.userId;

    // Verify user owns the project
    const project = await Project.findOne({ _id: projectId, ownerId: userId });
    if (!project) {
      return res.status(404).json({ status: 'fail', message: 'Project not found or access denied.' });
    }

    // Build filter query
    const filterQuery: any = { projectId };

    if (category) filterQuery.category = category;
    if (severity) filterQuery.severity = severity;
    if (type) filterQuery.type = type;
    
    if (resolved !== undefined) {
      filterQuery.resolved = resolved === 'true';
    }

    const issues = await Issue.find(filterQuery).sort({ lastOccurrence: -1 });

    res.status(200).json({
      status: 'success',
      results: issues.length,
      data: { issues }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Marks a unique issue as resolved.
 */
export async function resolveIssue(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { projectId, issueId } = req.params;
    const userId = req.user?.userId;

    // Verify project belongs to user
    const project = await Project.findOne({ _id: projectId, ownerId: userId });
    if (!project) {
      return res.status(404).json({ status: 'fail', message: 'Project not found or access denied.' });
    }

    const issue = await Issue.findOneAndUpdate(
      { _id: issueId, projectId },
      { resolved: true },
      { new: true }
    );

    if (!issue) {
      return res.status(404).json({ status: 'fail', message: 'Issue not found for this project.' });
    }

    // Write to audit log
    await AuditLog.create({
      userId,
      projectId,
      action: `ISSUE_RESOLVE:${issueId}`,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.status(200).json({
      status: 'success',
      data: { issue }
    });
  } catch (err) {
    next(err);
  }
}
