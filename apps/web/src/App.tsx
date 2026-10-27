import { useRef, useState } from 'react';
import { drawBoxes, type OverlayBox } from './lib/overlay';
import {
  extractReportText,
  fetchReport,
  finalizeCount,
  segmentPlate,
  type SentTile,
} from './lib/segment';
import { cropTileDataUri, fileToDataTile, planQuadrants } from './lib/tile';

const API_BASE = import.meta.env.VITE_API_BASE ?? '';

export default function App() {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [boxes, setBoxes] = useState<OverlayBox[]>([]);
  const [status, setStatus] = useState('Take or upload a plate photo.');
  const [report, setReport] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tiled, setTiled] = useState(false);
  const [dilution, setDilution] = useState('1');
  const [volume, setVolume] = useState('0.1');
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bitmapRef = useRef<ImageBitmap | null>(null);
  const fileRef = useRef<File | null>(null);

  function draw(current: OverlayBox[], naturalW: number, naturalH: number) {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (img && canvas) drawBoxes(canvas, img.clientWidth, img.clientHeight, current, naturalW, naturalH);
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    bitmapRef.current?.close();
    bitmapRef.current = await createImageBitmap(file);
    fileRef.current = file;
    setPhotoUrl(URL.createObjectURL(file));
    setBoxes([]);
    setReport(null);
    setStatus(`Loaded ${file.name} (${bitmapRef.current.width}×${bitmapRef.current.height}).`);
  }

  function onImageLoad() {
    const bmp = bitmapRef.current;
    if (bmp) draw(boxes, bmp.width, bmp.height);
  }

  async function onSegment() {
    const bmp = bitmapRef.current;
    const file = fileRef.current;
    if (!bmp || !file) return;
    if (!API_BASE) {
      setStatus('API base not configured (VITE_API_BASE).');
      return;
    }
    setBusy(true);
    setReport(null);
    try {
      const { width: W, height: H } = bmp;
      const tiles = tiled
        ? planQuadrants(W, H)
        : [{ x: 0, y: 0, width: W, height: H, row: 0, col: 0 }];
      setStatus(`Segmenting ${tiles.length} tile(s)…`);
      const sent: SentTile[] = [];
      for (const tile of tiles) {
        const { dataUri, sendScale } = await cropTileDataUri(bmp, tile);
        sent.push({ tile, dataUri, sendScale });
      }
      const global = await segmentPlate(API_BASE, sent);
      const { boxes: kept, count } = finalizeCount(global);
      const numbered: OverlayBox[] = kept.map((b, i) => ({ ...b, label: String(i + 1) }));
      setBoxes(numbered);
      draw(numbered, W, H);
      setStatus(`Counted ${count} colonies — writing report…`);
      const dish = await fileToDataTile(file);
      const rep = await fetchReport(API_BASE, {
        image: dish,
        count,
        dilutionFactor: Number(dilution) || undefined,
        platedVolumeMl: Number(volume) || undefined,
      });
      setReport(extractReportText(rep));
      setStatus(`Done: ${count} colonies (deterministic count; report below).`);
    } catch (err) {
      setStatus(`Failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: 16, fontFamily: 'system-ui' }}>
      <h1>ColonyIQ</h1>
      <p>{status}</p>
      <p style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <label>
          Take photo
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
        </label>
        <label>
          Upload
          <input type="file" accept="image/*" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
        <label>
          <input type="checkbox" checked={tiled} onChange={(e) => setTiled(e.target.checked)} />
          Tiled (dense plate)
        </label>
        <label>
          Dilution
          <input
            type="number"
            min="1"
            value={dilution}
            onChange={(e) => setDilution(e.target.value)}
            style={{ width: 80 }}
          />
        </label>
        <label>
          mL plated
          <input
            type="number"
            min="0"
            step="0.1"
            value={volume}
            onChange={(e) => setVolume(e.target.value)}
            style={{ width: 70 }}
          />
        </label>
        <button type="button" onClick={onSegment} disabled={!photoUrl || busy}>
          {busy ? 'Working…' : 'Segment'}
        </button>
      </p>
      {photoUrl && (
        <div style={{ position: 'relative' }}>
          <img
            ref={imgRef}
            src={photoUrl}
            alt="Agar plate"
            style={{ width: '100%' }}
            onLoad={onImageLoad}
          />
          <canvas
            ref={canvasRef}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          />
        </div>
      )}
      {report && (
        <pre style={{ whiteSpace: 'pre-wrap', background: '#f5f5f5', padding: 8 }}>{report}</pre>
      )}
    </main>
  );
}
