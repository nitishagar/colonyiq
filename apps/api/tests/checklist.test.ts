import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../../', import.meta.url));

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (['node_modules', '.git', 'dist', 'out', '.wrangler'].includes(entry)) continue;
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const codeFiles = walk(root).filter((p) => /\.(ts|tsx|toml|py|json)$/.test(p) && !/package-lock\.json$/.test(p));
const nonTestCode = codeFiles.filter((p) => !/\/tests?\//.test(p) && !/\.test\./.test(p));

describe('privacy checklist (G-PRIV-1)', () => {
  it('README carries the verbatim privacy line', () => {
    const readme = readFileSync(join(root, 'README.md'), 'utf8');
    expect(readme).toContain(
      'photos are not stored by ColonyIQ; they are sent to Meta Model API for inference',
    );
  });

  it('Worker code performs no storage writes (no KV/R2/D1/Durable Objects)', () => {
    for (const f of nonTestCode.filter((p) => p.includes('apps/api/src'))) {
      const code = readFileSync(f, 'utf8');
      expect(code, f).not.toMatch(/\b(KVNamespace|R2Bucket|D1Database|DurableObject)\b/);
      expect(code, f).not.toMatch(/\.(put|write|exec|batch)\s*\(/);
    }
  });
});

describe('secrets checklist (G-SEC-3)', () => {
  it('no VITE_* secrets in code or config (public VITE_API_BASE URL is not a secret)', () => {
    for (const f of nonTestCode) {
      const content = readFileSync(f, 'utf8');
      // Secret-shaped client vars are banned outright ...
      expect(content, f).not.toMatch(/VITE_[A-Z_]*(KEY|SECRET|TOKEN|PASSWORD|PRIVATE)/);
      // ... and any VITE_ use must be a read of public config, never a value assignment.
      for (const line of content.split('\n')) {
        if (!line.includes('VITE_') || line.trim().startsWith('#')) continue;
        expect(line, `${f}: ${line}`).not.toMatch(/VITE_[A-Z_]*\s*=\s*['"]?[\w\-./:]{2,}/);
      }
    }
  });

  it('META_API_KEY never assigned a value outside tests (env binding reads only)', () => {
    const ASSIGN = /META_API_KEY['"]?\s*[:=]\s*['"][\w\-.]{4,}/;
    for (const f of nonTestCode) {
      for (const line of readFileSync(f, 'utf8').split('\n')) {
        if (!line.includes('META_API_KEY')) continue;
        expect(line, `${f}: ${line}`).not.toMatch(ASSIGN);
      }
    }
  });

  it('.env files are git-ignored and no real .env exists in the repo', () => {
    const gitignore = readFileSync(join(root, '.gitignore'), 'utf8').split('\n');
    expect(gitignore).toContain('.env');
    expect(gitignore).toContain('.env.*');
    const envFiles = walk(root).filter((p) => /(^|\/)\.env(\..*)?$/.test(p));
    expect(envFiles.filter((p) => !p.endsWith('.env.example'))).toEqual([]);
  });

  it('.env.example documents provisioning with no secret values', () => {
    const p = join(root, 'apps/api/.env.example');
    expect(existsSync(p)).toBe(true);
    expect(readFileSync(p, 'utf8')).toMatch(/wrangler secret put META_API_KEY/);
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      // Any uncommented line must not carry a value.
      expect(t, 'uncommented .env.example line').not.toMatch(/=\s*\S/);
    }
  });
});
