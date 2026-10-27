import type { Context, Next } from 'hono';

export const KILL_VALUE = 'disabled';

/** ENVIRONMENT kill switch: when ENVIRONMENT=disabled, /api/* is closed. */
export async function killswitch(c: Context, next: Next): Promise<Response | void> {
  const env = (c.env as Record<string, string | undefined> | undefined)?.ENVIRONMENT;
  if (env === KILL_VALUE) {
    return c.json({ error: 'SERVICE_DISABLED' }, 503);
  }
  await next();
}
