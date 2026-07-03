import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import ApiKey from '../src/models/ApiKey';
import Report from '../src/models/Report';
import Issue from '../src/models/Issue';

vi.mock('../src/models/ApiKey', () => {
  return {
    default: {
      findOne: vi.fn()
    }
  };
});

vi.mock('../src/models/Report', () => {
  return {
    default: {
      create: vi.fn()
    }
  };
});

vi.mock('../src/models/Issue', () => {
  return {
    default: {
      findOneAndUpdate: vi.fn()
    }
  };
});

describe('SDK Ingestion Endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reject reports with missing x-api-key header', async () => {
    const res = await request(app)
      .post('/sdk/report')
      .send({
        projectId: 'project_123',
        url: 'http://localhost/test'
      });

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toContain('Missing API Key');
  });

  it('should accept valid reports and return 202 status code', async () => {
    // 1. Mock API Key resolution
    (ApiKey.findOne as any).mockResolvedValue({
      _id: 'key_id_123',
      projectId: 'project_123',
      isActive: true
    });

    // 2. Mock Report creation
    (Report.create as any).mockResolvedValue({
      _id: 'report_id_abc'
    });

    // 3. Mock Issue upsert
    (Issue.findOneAndUpdate as any).mockResolvedValue({});

    const res = await request(app)
      .post('/sdk/report')
      .set('x-api-key', 'key_valid_123')
      .send({
        projectId: 'project_123',
        url: 'https://site.com',
        userAgent: 'Mozilla/5.0',
        issues: [
          {
            category: 'dom',
            type: 'duplicate-id',
            severity: 'high',
            title: 'Duplicate ID',
            message: 'Id #foo was defined twice'
          }
        ]
      });

    expect(res.statusCode).toBe(202);
    expect(res.body.status).toBe('success');
    expect(res.body.reportId).toBe('report_id_abc');
    expect(ApiKey.findOne).toHaveBeenCalled();
    expect(Report.create).toHaveBeenCalled();
    expect(Issue.findOneAndUpdate).toHaveBeenCalled();
  });
});
