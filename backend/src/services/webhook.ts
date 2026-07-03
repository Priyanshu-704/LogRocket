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
import dns from 'dns';
import { promisify } from 'util';

const lookupPromise = promisify(dns.lookup);

function isIPv4Private(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) return true;
  const [p1, p2] = parts;
  return (
    p1 === 127 ||
    p1 === 10 ||
    (p1 === 172 && p2 >= 16 && p2 <= 31) ||
    (p1 === 192 && p2 === 168) ||
    (p1 === 169 && p2 === 254) ||
    p1 === 0 ||
    p1 >= 224
  );
}

function isIPv6Private(ip: string): boolean {
  const normalized = ip.toLowerCase().trim();
  if (normalized === '::1' || normalized === '::' || normalized === '0:0:0:0:0:0:0:1') return true;
  if (normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) return true; // fe80::/10
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true; // fc00::/7
  
  if (normalized.startsWith('::ffff:')) {
    const ipv4Part = normalized.substring(7);
    return isIPv4Private(ipv4Part);
  }
  return false;
}

async function resolveAndValidateHost(hostname: string): Promise<{ ip: string; isPrivate: boolean }> {
  if (hostname === 'localhost') return { ip: '127.0.0.1', isPrivate: true };
  try {
    const { address, family } = await lookupPromise(hostname);
    let isPrivate = false;
    if (family === 4) {
      isPrivate = isIPv4Private(address);
    } else if (family === 6) {
      isPrivate = isIPv6Private(address);
    } else {
      isPrivate = true;
    }
    return { ip: address, isPrivate };
  } catch {
    return { ip: '', isPrivate: true };
  }
}

export async function dispatchWebhook(url: string, payload: WebhookPayload): Promise<boolean> {
  if (typeof fetch === 'undefined') {
    console.error('[Webhook] fetch API is not available.');
    return false;
  }

  try {
    const parsedUrl = new URL(url);
    const { ip, isPrivate } = await resolveAndValidateHost(parsedUrl.hostname);
    if (isPrivate) {
      console.warn(`[Webhook] Blocked SSRF attempt to private host: ${parsedUrl.hostname} (${ip})`);
      return false;
    }

    const originalHost = parsedUrl.host;
    parsedUrl.hostname = ip;
    const requestUrl = parsedUrl.toString();

    const response = await fetch(requestUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Analyzer-Event': payload.event,
        'User-Agent': 'JS-Code-Analyzer-Webhook/1.0',
        'Host': originalHost
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
