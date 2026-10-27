import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { killswitch } from './middleware/killswitch';
import { UNAUTHENTICATED_LIMIT, checkLimit } from './middleware/rateLimiter';
import segment from './routes/segment';
import flag from './routes/flag';
import report from './routes/report';

export interface AppEnv {
  Bindings: {
    ENVIRONMENT?: string;
    ALLOWED_ORIGIN?: string;
    META_API_KEY?: string;
  };
}

export const PROD_ORIGIN = 'https://colonyiq-web.pages.dev';

export function isAllowedOrigin(origin: string, configured?: string): boolean {
  const allow = [PROD_ORIGIN, configured, 'http://localhost:5173', 'http://localhost:4321'].filter(
    Boolean,
  ) as string[];
  if (allow.includes(origin)) return true;
  // Branch deploy previews: https://<branch>.colonyiq-web.pages.dev
  if (/^https:\/\/[a-z0-9-]+\.colonyiq-web\.pages\.dev$/.test(origin)) return true;
  return false;
}

export function createApp() {
  const app = new Hono<AppEnv>();

  app.use('*', async (c, next) => {
    await next();
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('X-Frame-Options', 'DENY');
    c.header('Referrer-Policy', 'no-referrer');
  });

  app.use(
    '/api/*',
    cors({
      origin: (origin, c) => {
        const configured = (c.env as AppEnv['Bindings'] | undefined)?.ALLOWED_ORIGIN;
        return origin && isAllowedOrigin(origin, configured) ? origin : null;
      },
    }),
  );

  app.use('/api/*', killswitch);

  // Reject oversized bodies before they touch quota or the Meta key.
  app.use('/api/*', async (c, next) => {
    if (Number(c.req.header('content-length') ?? 0) > 6_000_000) {
      return c.json({ error: 'PAYLOAD_TOO_LARGE' }, 413);
    }
    await next();
  });

  app.use('/api/*', async (c, next) => {
    const ip = c.req.header('CF-Connecting-IP') ?? 'anon';
    if (!checkLimit(`api:${ip}`, UNAUTHENTICATED_LIMIT)) {
      c.header('Retry-After', '60');
      return c.json({ error: 'RATE_LIMITED' }, 429);
    }
    await next();
  });

  app.get('/', (c) => c.json({ ok: true, service: 'colonyiq-api' }));
  app.route('/api/segment', segment);
  app.route('/api/flag', flag);
  app.route('/api/report', report);

  return app;
}

export default createApp();
