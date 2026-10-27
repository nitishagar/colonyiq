import { safeFetch } from './egress';

// Model IDs pinned server-side (G-SEC-2). Never accept from the client.
export const SAM_MODEL = 'sam-3.1';
export const SPARK_MODEL = 'muse-spark-1.2';

const META_RESPONSES_URL = 'https://api.meta.ai/v1/responses';

export interface MetaEnv {
  META_API_KEY?: string;
}

/**
 * Pass-through to Meta Model API: exactly 1 upstream call per request.
 * Returns the upstream response untouched (status + body).
 */
export async function metaPassThrough(
  env: MetaEnv,
  body: Record<string, unknown>,
  fetchFn: typeof fetch = fetch,
): Promise<Response> {
  const key = env.META_API_KEY;
  if (!key) {
    return Response.json({ error: 'UPSTREAM_NOT_CONFIGURED' }, { status: 500 });
  }
  return safeFetch(
    META_RESPONSES_URL,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
    },
    30_000,
    fetchFn,
  );
}
