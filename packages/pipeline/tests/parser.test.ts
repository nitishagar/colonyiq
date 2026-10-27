import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { StreamParser, parseStreamChunk } from '../src/parser';

const fixtures = fileURLToPath(new URL('../fixtures/', import.meta.url));
const stream1 = readFileSync(fixtures + 'stream1.txt', 'utf8');
const stream2 = readFileSync(fixtures + 'stream2-edge.txt', 'utf8');

describe('parseStreamChunk (G-D1-2)', () => {
  it('parses the recorded stream1 fixture: 3 detections, garbage ignored', () => {
    const dets = parseStreamChunk(stream1);
    expect(dets).toHaveLength(3);
    expect(dets[0]).toEqual({ x: 645, y: 1526, width: 44, height: 46, score: 0.93 });
    expect(dets[1]).toMatchObject({ x: 700, y: 1530, width: 40, height: 42, score: 0.88 });
    expect(dets[1].mask).toBe('aGVsbG8=');
    expect(dets[2]).toMatchObject({ x: 10, y: 20, width: 30, height: 32, score: 0.5 });
    expect(dets[0].mask).toBeUndefined();
  });

  it('handles edge cases: s=0/s=1.0 bounds, negative coords, masks, whitespace', () => {
    const dets = parseStreamChunk(stream2);
    // Lines 3 (garbage), 5 (missing h), 6 (s=2.0 out of range) are dropped.
    expect(dets).toHaveLength(4);
    expect(dets[0]).toMatchObject({ x: 0, y: 0, score: 0 });
    expect(dets[1]).toMatchObject({ x: -5, y: 100, score: 1, mask: 'QUJDRA==' });
    expect(dets[2]).toMatchObject({ score: 0.75, mask: 'aGVsbG8=' });
    expect(dets[3]).toMatchObject({ x: 7, y: 8, score: 0.01 });
  });

  it('returns [] for empty input and pure garbage', () => {
    expect(parseStreamChunk('')).toEqual([]);
    expect(parseStreamChunk('hello\nworld\n')).toEqual([]);
  });
});

describe('StreamParser incremental push/flush', () => {
  it('reassembles a <det> line split across chunk boundaries', () => {
    const p = new StreamParser();
    const full = '<det> x=12 y=34 w=56 h=78 s=0.91 </det>\n';
    const half = Math.floor(full.length / 2);
    expect(p.push(full.slice(0, half))).toEqual([]);
    const dets = p.push(full.slice(half));
    expect(dets).toHaveLength(1);
    expect(dets[0]).toMatchObject({ x: 12, y: 34, width: 56, height: 78, score: 0.91 });
  });

  it('buffers the trailing partial line and emits it on flush', () => {
    const p = new StreamParser();
    expect(p.push('garbage\n<det> x=1 y=2 w=3 h=4 s=0.5 </det>')).toEqual([]);
    const dets = p.flush();
    expect(dets).toHaveLength(1);
    expect(dets[0]).toMatchObject({ x: 1, y: 2 });
    expect(p.flush()).toEqual([]);
  });

  it('parses a whole fixture fed in small streaming chunks', () => {
    const p = new StreamParser();
    const out = [];
    for (let i = 0; i < stream1.length; i += 7) out.push(...p.push(stream1.slice(i, i + 7)));
    out.push(...p.flush());
    expect(out).toHaveLength(3);
  });
});
