import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import ApiKey from '../models/ApiKey';
import Report from '../models/Report';
import Issue from '../models/Issue';
import { addJob } from '../services/queue';
import { emitToProject } from '../services/socket';
import SourceMap from '../models/SourceMap';
import { findOriginalPosition } from '../utils/sourceMapParser';

/**
 * Handles incoming real-time telemetry reports from the client-side SDK.
 */
export async function ingestReport(req: Request, res: Response, next: NextFunction) {
  try {
    const rawApiKey = req.headers['x-api-key'] || req.query.apiKey;
    const { projectId, environment, sdkVersion, url, userAgent, issues = [], events = [], metrics = {} } = req.body;

    if (!rawApiKey) {
      return res.status(401).json({ status: 'fail', message: 'Missing API Key in headers or query parameters.' });
    }

    if (!projectId) {
      return res.status(400).json({ status: 'fail', message: 'Missing projectId in request payload.' });
    }

    if (!Array.isArray(issues)) {
      return res.status(400).json({ status: 'fail', message: 'issues must be an array.' });
    }

    if (!Array.isArray(events)) {
      return res.status(400).json({ status: 'fail', message: 'events must be an array.' });
    }

    if (issues.length > 50) {
      return res.status(400).json({ status: 'fail', message: 'Payload contains too many issues (max 50).' });
    }

    if (events.length > 100) {
      return res.status(400).json({ status: 'fail', message: 'Payload contains too many events (max 100).' });
    }

    if (url && (typeof url !== 'string' || url.length > 2000)) {
      return res.status(400).json({ status: 'fail', message: 'Invalid URL format.' });
    }

    if (userAgent && (typeof userAgent !== 'string' || userAgent.length > 500)) {
      return res.status(400).json({ status: 'fail', message: 'Invalid userAgent format.' });
    }

    const validCategories = ['html', 'css', 'javascript', 'dom', 'performance', 'accessibility', 'seo', 'security', 'code-quality', 'dx'];
    const validSeverities = ['low', 'medium', 'high', 'critical'];

    for (const item of issues) {
      if (
        !item ||
        typeof item.type !== 'string' ||
        typeof item.title !== 'string' ||
        typeof item.message !== 'string' ||
        !validCategories.includes(item.category) ||
        !validSeverities.includes(item.severity)
      ) {
        return res.status(400).json({ status: 'fail', message: 'Invalid issue payload structure.' });
      }
    }

    // 1. Verify API Key
    const hashedKey = crypto.createHash('sha256').update(String(rawApiKey)).digest('hex');
    const keyRecord = await ApiKey.findOne({
      key: hashedKey,
      projectId,
      isActive: true
    });

    if (!keyRecord) {
      return res.status(401).json({ status: 'fail', message: 'Invalid or deactivated API Key.' });
    }

    // 2. Save Session Report Metadata
    const report = await Report.create({
      projectId,
      environment: environment || 'production',
      sdkVersion: sdkVersion || '1.0.0',
      url,
      userAgent,
      metrics,
      issuesCount: issues.length,
      eventsCount: events.length
    });

    // 3. Upsert Issues with Deduplication (Fingerprinting)
    const issuePromises = issues.map(async (item: any) => {
      // Resolve minified location using Source Maps if present
      if (
        item.location &&
        typeof item.location.line === 'number' &&
        typeof item.location.column === 'number' &&
        item.location.fileName
      ) {
        try {
          const mapRecord = await SourceMap.findOne({
            projectId,
            fileName: item.location.fileName
          });
          if (mapRecord) {
            const originalPos = findOriginalPosition(
              mapRecord.rawSourceMap,
              item.location.line,
              item.location.column
            );
            if (originalPos && originalPos.source) {
              item.location.originalLocation = {
                line: originalPos.line,
                column: originalPos.column,
                fileName: originalPos.source,
                sourceContent: originalPos.sourceContent || ''
              };
            }
          }
        } catch (mapErr) {
          console.error('[SourceMapResolver] Error tracing stack trace:', mapErr);
        }
      }

      // Calculate a local fingerprint fallback if not provided
      const locator = item.location?.selector || 
                      item.location?.fileName || 
                      item.location?.outerHTML || 
                      item.message || 
                      'global';
      
      const fingerprint = item.id || `${item.category}:${item.type}:${locator}`;

      const occurrenceSample = {
        url,
        userAgent,
        timestamp: new Date(),
        location: item.location,
        metadata: item.metadata
      };

      // Perform upsert and return document
      return Issue.findOneAndUpdate(
        { projectId, fingerprint },
        {
          $set: {
            category: item.category,
            type: item.type,
            severity: item.severity,
            title: item.title,
            message: item.message,
            location: item.location,
            metadata: item.metadata,
            resolved: false, // Re-open issue if it occurs again
            lastOccurrence: new Date()
          },
          $setOnInsert: {
            firstOccurrence: new Date()
          },
          $inc: { occurrencesCount: 1 },
          $push: {
            occurrencesHistory: {
              $each: [occurrenceSample],
              $slice: -50 // Keep only last 50 occurrences
            }
          }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    });

    // Run parallel upserts safely
    const upsertedIssues = await Promise.all(issuePromises);

    // 4. Queue background rules check and AI suggestions for each issue
    for (const issueDoc of upsertedIssues) {
      if (issueDoc) {
        await addJob('PROCESS_ISSUE', {
          issueId: issueDoc._id.toString(),
          projectId
        });
      }
    }

    // 5. Broadcast live telemetry update via Socket.io project room
    emitToProject(projectId, 'report:received', {
      reportId: report._id,
      environment: report.environment,
      url: report.url,
      issuesCount: report.issuesCount,
      metrics: report.metrics
    });

    res.status(202).json({
      status: 'success',
      message: 'Report received and queued for analysis.',
      reportId: report._id
    });
  } catch (err) {
    next(err);
  }
}
