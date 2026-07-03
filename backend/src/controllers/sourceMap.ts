import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import SourceMap from '../models/SourceMap';
import Project from '../models/Project';

/**
 * Uploads and registers a source map file for a project.
 */
export async function uploadSourceMap(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { projectId } = req.params;
    const { fileName, rawSourceMap } = req.body;

    if (!fileName || !rawSourceMap) {
      return res.status(400).json({
        status: 'fail',
        message: 'fileName and rawSourceMap fields are required.'
      });
    }

    if (typeof rawSourceMap !== 'string' || rawSourceMap.length > 10 * 1024 * 1024) {
      return res.status(400).json({
        status: 'fail',
        message: 'Invalid source map format or file size exceeds the 10MB limit.'
      });
    }

    try {
      const parsed = JSON.parse(rawSourceMap);
      if (typeof parsed !== 'object' || parsed === null || !parsed.mappings || !parsed.sources || !parsed.version) {
        return res.status(400).json({
          status: 'fail',
          message: 'Malformed source map: missing required fields (version, mappings, sources).'
        });
      }
    } catch (parseErr: any) {
      return res.status(400).json({
        status: 'fail',
        message: `Malformed source map JSON: ${parseErr.message}`
      });
    }

    // Verify project exists and belongs to the authenticated user
    const project = await Project.findOne({ _id: projectId, ownerId: req.user?.userId });
    if (!project) {
      return res.status(404).json({
        status: 'fail',
        message: 'Project not found or access denied.'
      });
    }

    // Upsert the source map entry
    const sourceMap = await SourceMap.findOneAndUpdate(
      { projectId: project._id, fileName },
      { rawSourceMap, createdAt: new Date() },
      { new: true, upsert: true }
    );

    res.status(200).json({
      status: 'success',
      message: 'Source map registered successfully.',
      data: {
        id: sourceMap._id,
        fileName: sourceMap.fileName
      }
    });
  } catch (err) {
    next(err);
  }
}
