export interface WebhookPayload {
  event: 'issue.created' | 'issue.resolved';
  projectId: string;
  issue: {
    id: string;
    category: string;
    type: string;
    severity: string;
    title: string;
    message: string;
  };
  timestamp: number;
}

/**
 * Dispatches outbound secure JSON POST payloads to developer webhook endpoints.
 */
export async function dispatchWebhook(url: string, payload: WebhookPayload): Promise<boolean> {
  if (typeof fetch === 'undefined') {
    console.error('[Webhook] fetch API is not available.');
    return false;
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Analyzer-Event': payload.event,
        'User-Agent': 'JS-Code-Analyzer-Webhook/1.0'
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000) // Timeout after 5 seconds
    });

    if (!response.ok) {
      console.warn(`[Webhook] Dispatch failed to ${url}. Status code: ${response.status}`);
      return false;
    }

    console.log(`[Webhook] Event [${payload.event}] dispatched successfully to ${url}`);
    return true;
  } catch (err) {
    console.error(`[Webhook] Outbound dispatch error for ${url}:`, err);
    return false;
  }
}
