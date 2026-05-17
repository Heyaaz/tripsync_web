export type SystemSharePayload = {
  title: string;
  text?: string;
  url: string;
};

export type SystemShareResult = 'shared' | 'copied' | 'cancelled' | 'failed';

export async function shareWithSystemFallback(payload: SystemSharePayload): Promise<SystemShareResult> {
  if (!payload.url || typeof navigator === 'undefined') {
    return 'failed';
  }

  if (navigator.share) {
    try {
      await navigator.share(payload);
      return 'shared';
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return 'cancelled';
      }
    }
  }

  try {
    await navigator.clipboard.writeText(payload.url);
    return 'copied';
  } catch {
    return 'failed';
  }
}
