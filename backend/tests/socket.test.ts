import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initSocket, emitToProject } from '../src/services/socket';
import Project from '../src/models/Project';

vi.mock('../src/models/Project', () => {
  return {
    default: {
      findOne: vi.fn()
    }
  };
});

// Mock Server from socket.io
const mockTo = vi.fn().mockReturnThis();
const mockEmit = vi.fn();
const mockIoInstance = {
  use: vi.fn(),
  on: vi.fn(),
  to: mockTo,
  emit: mockEmit
};

vi.mock('socket.io', () => {
  return {
    Server: vi.fn().mockImplementation(() => mockIoInstance)
  };
});

describe('Socket.io Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize server and support project broadcasts', () => {
    const mockHttpServer = {} as any;
    
    const io = initSocket(mockHttpServer);
    expect(io).toBe(mockIoInstance);
    expect(mockIoInstance.use).toHaveBeenCalled();
    expect(mockIoInstance.on).toHaveBeenCalledWith('connection', expect.any(Function));

    // Test emission utility
    emitToProject('project_123', 'issue:analyzed', { issueId: 'issue_abc' });
    
    expect(mockIoInstance.to).toHaveBeenCalledWith('project:project_123');
    expect(mockIoInstance.to('project:project_123').emit).toHaveBeenCalledWith('issue:analyzed', { issueId: 'issue_abc' });
  });
});
