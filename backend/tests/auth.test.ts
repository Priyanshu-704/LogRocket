import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import User from '../src/models/User';

vi.mock('../src/models/User', () => {
  return {
    default: {
      findOne: vi.fn(),
      create: vi.fn(),
      findById: vi.fn()
    }
  };
});

describe('Auth Endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should register a new user successfully', async () => {
    (User.findOne as any).mockResolvedValue(null);
    (User.create as any).mockResolvedValue({
      _id: 'mock_user_id',
      name: 'John Doe',
      email: 'john@example.com',
      role: 'developer'
    });

    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password123'
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.status).toBe('success');
    expect(res.body.token).toBeDefined();
    expect(res.body.data.user.name).toBe('John Doe');
  });

  it('should login a user successfully', async () => {
    const mockComparePassword = vi.fn().mockResolvedValue(true);
    const mockUser = {
      _id: 'mock_user_id',
      name: 'John Doe',
      email: 'john@example.com',
      role: 'developer',
      comparePassword: mockComparePassword
    };

    // Chainable mock for select
    const selectMock = vi.fn().mockResolvedValue(mockUser);
    (User.findOne as any).mockReturnValue({ select: selectMock });

    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'john@example.com',
        password: 'password123'
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.token).toBeDefined();
    expect(mockComparePassword).toHaveBeenCalledWith('password123');
  });
});
