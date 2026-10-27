import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { StreamParser, parseStreamChunk } from '../src/parser';

const fixtures = fileURLToPath(new URL('../fixtures/', import.meta.url));
const stream1 = readFileSync(fixtures + 'stream1.txt', 'utf8');
const stream2 = readFileSync(fixtures + 'stream2-edge.txt', 'utf8');

describe('parseStreamChunk, real SAM grammar (G-D1-2)', () => {
  it('parses recorded stream1: 3 detections, inclusive corners, mask payloads', () => {
    const dets = parseStreamChunk(stream1);
    expect(dets).toHaveLength(3);
    expect(dets[0]).toMatchObject({
      id: 0, frame: 0, x: 433, y: 682, width: 15, height: 14,
      score: 1, srcW: 959, srcH: 1024,
    });
    expect(dets[0].mask).toMatch(/^data=14,15,~/);
    expect(dets[1]).toMatchObject({ id: 1, x: 761, y: 316, width: 15, height: 14 });
    expect(dets[2]).toMatchObject({ id: 2, x: 541, y: 564, width: 15, height: 16 });
  });

  it('handles sparse ids, confidence fields; drops garbage + partial tail', () => {
    const dets = parseStreamChunk(stream2);
    expect(dets.map((d) => d.id)).toEqual([0, 2]);
    expect(dets[0]).toMatchObject({ score: 0.96, width: 10, height: 10 });
    expect(dets[0].mask).toBe('data=2,2,~AB');
    expect(dets[1]).toMatchObject({ score: 1 });
    expect(dets[1].mask).toBe('data=2,2,!CD');
  });

  it('returns [] for empty input, pure garbage, and zero-match streams', () => {
    expect(parseStreamChunk('')).toEqual([]);
    expect(parseStreamChunk('hello\nworld\n')).toEqual([]);
  });
});

describe('StreamParser incremental push/flush', () => {
  it('reassembles a record split mid-mask-payload across chunks', () => {
    const p = new StreamParser();
    const rec = '<0f>0<|box;x1=1;y1=2;x2=3;y2=4;w=10;h=10|><|mask;x=0;y=0;data=2,2,~PAYLOAD|>';
    const cut = rec.indexOf('PAYL');
    expect(p.push(rec.slice(0, cut))).toEqual([]);
    const dets = p.push(rec.slice(cut));
    expect(dets).toHaveLength(1);
    expect(dets[0]).toMatchObject({ id: 0, x: 1, y: 2, width: 3, height: 3 });
    expect(dets[0].mask).toBe('data=2,2,~PAYLOAD');
  });

  it('never emits a partial record: held across push, dropped on flush', () => {
    const p = new StreamParser();
    const full = '<0f>0<|box;x1=1;y1=2;x2=3;y2=4;w=10;h=10|><|mask;x=0;y=0;data=2,2,~AB|>';
    expect(p.push('garbage\n' + full.slice(0, 20))).toEqual([]);
    expect(p.flush()).toEqual([]); // incomplete record is not a detection
    expect(p.flush()).toEqual([]);
  });

  it('parses a whole fixture fed in small streaming chunks', () => {
    const p = new StreamParser();
    const out = [];
    for (let i = 0; i < stream1.length; i += 7) out.push(...p.push(stream1.slice(i, i + 7)));
    out.push(...p.flush());
    expect(out).toHaveLength(3);
    expect(out.map((d) => d.id)).toEqual([0, 1, 2]);
  });
});
