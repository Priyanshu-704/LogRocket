import { describe, it, expect, vi, beforeEach } from 'vitest';
import { addJob } from '../src/services/queue';
import Issue from '../src/models/Issue';
import Project from '../src/models/Project';
import { generateAISuggestion } from '../src/services/ai';
import { dispatchWebhook } from '../src/services/webhook';

vi.mock('../src/models/Issue', () => {
  return {
    default: {
      findById: vi.fn()
    }
  };
});

vi.mock('../src/models/Project', () => {
  return {
    default: {
      findById: vi.fn()
    }
  };
});

vi.mock('../src/services/ai', () => {
  return {
    generateAISuggestion: vi.fn().mockReturnValue({
      explanation: 'Test Explanation',
      fixCode: 'const test = true;',
      referenceUrl: 'http://docs.com'
    })
  };
});

vi.mock('../src/services/webhook', () => {
  return {
    dispatchWebhook: vi.fn().mockResolvedValue(true)
  };
});

describe('Background Queue Pipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should process issues, attach AI fixes, and trigger webhooks', async () => {
    const mockIssueSave = vi.fn().mockResolvedValue({});
    const mockIssue = {
      _id: 'issue_123',
      projectId: 'project_123',
      category: 'javascript',
      type: 'exposed-secret',
      title: 'API Key Leak',
      message: 'AWS Key leaked',
      severity: 'critical',
      location: {},
      aiSuggestion: {} as any,
      save: mockIssueSave
    };

    (Issue.findById as any).mockResolvedValue(mockIssue);
    (Project.findById as any).mockResolvedValue({
      _id: 'project_123',
      webhookUrl: 'https://webhook.site/endpoint'
    });

    // Run queue trigger
    await addJob('PROCESS_ISSUE', {
      issueId: 'issue_123',
      projectId: 'project_123'
    });

    // Wait a brief tick since queue execution falls back to setTimeout memory loop
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(Issue.findById).toHaveBeenCalledWith('issue_123');
    expect(generateAISuggestion).toHaveBeenCalled();
    expect(mockIssue.aiSuggestion.explanation).toBe('Test Explanation');
    expect(mockIssueSave).toHaveBeenCalled();

    // Check project webhooks trigger
    expect(Project.findById).toHaveBeenCalledWith('project_123');
    expect(dispatchWebhook).toHaveBeenCalled();
  });
});
