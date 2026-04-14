// Simple in-memory rate limiter for serverless (per-instance)
const requests = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number = 10, windowMs: number = 60_000): { success: boolean; remaining: number } {
  const now = Date.now();
  const entry = requests.get(key);

  if (!entry || now > entry.resetAt) {
    requests.set(key, { count: 1, resetAt: now + windowMs });
    return { success: true, remaining: limit - 1 };
  }

  if (entry.count >= limit) {
    return { success: false, remaining: 0 };
  }

  entry.count++;
  return { success: true, remaining: limit - entry.count };
}
