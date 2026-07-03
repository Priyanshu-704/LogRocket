import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import Project from '../src/models/Project';
import ApiKey from '../src/models/ApiKey';
import AuditLog from '../src/models/AuditLog';
import { generateToken } from '../src/utils/jwt';

vi.mock('../src/models/Project', () => {
  return {
    default: {
      create: vi.fn(),
      find: vi.fn(),
      findOne: vi.fn()
    }
  };
});

vi.mock('../src/models/ApiKey', () => {
  return {
    default: {
      create: vi.fn()
    }
  };
});

vi.mock('../src/models/AuditLog', () => {
  return {
    default: {
      create: vi.fn()
    }
  };
});

describe('Project Management Endpoints', () => {
  let token: string;

  beforeEach(() => {
    vi.clearAllMocks();
    token = generateToken({ userId: 'user_123', role: 'developer' });
  });

  it('should reject requests with no token', async () => {
    const res = await request(app)
      .post('/api/projects')
      .send({ name: 'Web Application Workspace' });

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toContain('not logged in');
  });

  it('should create a project and generate initial key when authenticated', async () => {
    (Project.create as any).mockResolvedValue({
      _id: 'project_123',
      name: 'Web Application Workspace',
      ownerId: 'user_123'
    });

    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Web Application Workspace' });

    expect(res.statusCode).toBe(201);
    expect(res.body.status).toBe('success');
    expect(res.body.data.project.name).toBe('Web Application Workspace');
    expect(res.body.data.apiKey).toBeDefined();
    
    expect(Project.create).toHaveBeenCalled();
    expect(ApiKey.create).toHaveBeenCalled();
    expect(AuditLog.create).toHaveBeenCalled();
  });
});
