import { Queue as BullQueue, Worker as BullWorker } from 'bullmq';
import IORedis from 'ioredis';
import Issue from '../models/Issue';
import Project from '../models/Project';
import { generateAISuggestion } from './ai';
import { emitToProject } from './socket';
import { dispatchWebhook } from './webhook';
import config from '../config';

let useRedis = process.env.NODE_ENV !== 'test';
let bullQueue: BullQueue | null = null;
let bullWorker: BullWorker | null = null;

// Initialize connection options
const redisOptions = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  maxRetriesPerRequest: null,
  connectTimeout: 2000
};

import fs from 'fs';
import path from 'path';

const QUEUE_FILE = path.join(process.cwd(), 'memory_queue.json');

// Resilient file-backed memory fallback queue structure
class MemoryQueue {
  private jobs: Array<{ name: string; data: any }> = [];
  private isProcessing = false;

  constructor() {
    this.loadJobs();
    // Start worker loop asynchronously after initialization
    setTimeout(() => this.startWorker(), 100);
  }

  private loadJobs() {
    try {
      if (fs.existsSync(QUEUE_FILE)) {
        const raw = fs.readFileSync(QUEUE_FILE, 'utf8');
        this.jobs = JSON.parse(raw);
        console.log(`[MemoryQueue] Loaded ${this.jobs.length} persisted fallback jobs from disk.`);
      }
    } catch (err: any) {
      console.warn(`[MemoryQueue] Failed to load persisted fallback jobs: ${err.message}`);
    }
  }

  private saveJobs() {
    try {
      fs.writeFileSync(QUEUE_FILE, JSON.stringify(this.jobs, null, 2), 'utf8');
    } catch (err: any) {
      console.error(`[MemoryQueue] Failed to persist fallback jobs: ${err.message}`);
    }
  }

  async add(name: string, data: any): Promise<void> {
    this.jobs.push({ name, data });
    this.saveJobs();
    this.startWorker();
  }

  private startWorker() {
    if (this.isProcessing) return;
    this.isProcessing = true;
    this.processNext();
  }

  private async processNext() {
    if (this.jobs.length === 0) {
      this.isProcessing = false;
      return;
    }

    const job = this.jobs[0];
    try {
      await processJob(job.name, job.data);
    } catch (err: any) {
      console.error(`[MemoryQueue] Persisted Job failed: ${job.name}`, err);
    }

    this.jobs.shift();
    this.saveJobs();
    
    // Process next job
    setTimeout(() => this.processNext(), 50);
  }
}

const memoryQueueInstance = new MemoryQueue();

if (useRedis) {
  // Try establishing Redis connectivity
  try {
    const connection = new IORedis({
      ...redisOptions,
      retryStrategy(times) {
        if (times > 2) {
          useRedis = false;
          console.warn('[Queue] Redis connection failed twice. Dropping back to MemoryQueue fallback.');
          return null; // stop retrying
        }
        return 1000;
      }
    });

    connection.on('error', (err) => {
      if (useRedis) {
        console.warn('[Queue] Redis connection error. Falling back to MemoryQueue.', err.message);
        useRedis = false;
        try { connection.disconnect(); } catch (e) {}
        if (bullQueue) {
          bullQueue.close().catch(() => {});
          bullQueue = null;
        }
        if (bullWorker) {
          bullWorker.close().catch(() => {});
          bullWorker = null;
        }
      }
    });

    if (useRedis) {
      bullQueue = new BullQueue('report-analysis', { connection: connection as any });
      bullWorker = new BullWorker('report-analysis', async (job) => {
        await processJob(job.name, job.data);
      }, { connection: connection as any });

      console.log('[Queue] BullMQ background queue initialized successfully.');
    }
  } catch (err) {
    useRedis = false;
    console.warn('[Queue] Redis setup crashed. Falling back to MemoryQueue.');
  }
}

/**
 * Main Job Processor running background tasks.
 */
async function processJob(name: string, data: any): Promise<void> {
  console.log(`[Queue] Processing Background Job: ${name}`, data);

  switch (name) {
    case 'PROCESS_ISSUE': {
      const { issueId, projectId } = data;
      
      const issue = await Issue.findById(issueId);
      if (!issue) {
        console.warn(`[Queue] PROCESS_ISSUE: Issue not found ${issueId}`);
        return;
      }

      // 1. Generate AI Suggestion
      const suggestion = generateAISuggestion(
        issue.category,
        issue.type,
        issue.title,
        issue.message,
        issue.location as any
      );

      // 2. Update issue in Database
      issue.aiSuggestion = {
        explanation: suggestion.explanation,
        fixCode: suggestion.fixCode || '',
        referenceUrl: suggestion.referenceUrl || ''
      };
      await issue.save();

      // 3. Push real-time alert via Socket.IO
      emitToProject(projectId, 'issue:analyzed', {
        issueId: issue._id,
        projectId,
        title: issue.title,
        severity: issue.severity,
        aiSuggestion: suggestion
      });

      // 4. Dispatch outbound webhook if project has webhook configured and severity is critical/high
      if (['high', 'critical'].includes(issue.severity)) {
        const project = await Project.findById(projectId);
        if (project && project.webhookUrl && project.webhookUrl.trim() !== '') {
          await addJob('SEND_WEBHOOK', {
            url: project.webhookUrl,
            payload: {
              event: 'issue.created',
              projectId,
              issue: {
                id: issue._id.toString(),
                category: issue.category,
                type: issue.type,
                severity: issue.severity,
                title: issue.title,
                message: issue.message
              },
              timestamp: Date.now()
            }
          });
        }
      }
      break;
    }

    case 'SEND_WEBHOOK': {
      const { url, payload } = data;
      await dispatchWebhook(url, payload);
      break;
    }

    default:
      console.warn(`[Queue] Unknown job name received: ${name}`);
  }
}

/**
 * Enqueues a new background job.
 */
export async function addJob(name: string, data: any): Promise<void> {
  if (useRedis && bullQueue) {
    await bullQueue.add(name, data);
  } else {
    await memoryQueueInstance.add(name, data);
  }
}
