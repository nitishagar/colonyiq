import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const splitsPath = fileURLToPath(new URL('../splits.json', import.meta.url));
const splits = JSON.parse(readFileSync(splitsPath, 'utf8')) as {
  _note: string;
  dev: string[];
  test: string[];
};

describe('eval splits (G-EVAL-8)', () => {
  it('dev20 = 10 lower-res + 10 bright (tune freely)', () => {
    expect(splits.dev).toHaveLength(20);
    expect(splits.dev.filter((p) => p.startsWith('lower-res/'))).toHaveLength(10);
    expect(splits.dev.filter((p) => p.startsWith('bright/'))).toHaveLength(10);
  });

  it('test20 = 10 dark + 10 vague (run once)', () => {
    expect(splits.test).toHaveLength(20);
    expect(splits.test.filter((p) => p.startsWith('dark/'))).toHaveLength(10);
    expect(splits.test.filter((p) => p.startsWith('vague/'))).toHaveLength(10);
  });

  it('dev and test are disjoint and filename-keyed (971/972 mismatch noted)', () => {
    const dev = new Set(splits.dev);
    expect(splits.test.every((p) => !dev.has(p))).toBe(true);
    expect(new Set([...splits.dev, ...splits.test]).size).toBe(40);
    expect(splits._note).toMatch(/971/);
    expect(splits._note).toMatch(/filename/i);
  });

  it('documents the 734 (54-vs-78) and 1399 (-1) quirks', () => {
    expect(splits._note).toMatch(/734/);
    expect(splits._note).toMatch(/1399/);
    expect(splits._note).toMatch(/-1/);
  });
});
