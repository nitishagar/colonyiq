import { useRef, useState } from 'react';
import { drawBoxes, type OverlayBox } from './lib/overlay';

const API_BASE = import.meta.env.VITE_API_BASE ?? '';

export default function App() {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [boxes, setBoxes] = useState<OverlayBox[]>([]);
  const [status, setStatus] = useState('Take or upload a plate photo.');
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  function onFile(file: File | undefined) {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPhotoUrl(url);
    // Placeholder: demo overlay until /api/segment is wired.
    setBoxes([
      { x: 60, y: 80, width: 40, height: 38, label: 'demo' },
      { x: 150, y: 200, width: 34, height: 34, label: 'demo' },
    ]);
    setStatus(`Loaded ${file.name} — overlay is a placeholder.`);
  }

  function onImageLoad() {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (img && canvas) drawBoxes(canvas, img.clientWidth, img.clientHeight, boxes);
  }

  async function onSegment() {
    setStatus('Segmentation not wired yet — see /api/segment.');
    if (API_BASE) setStatus(`API base: ${API_BASE} (placeholder, no request sent).`);
  }

  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: 16, fontFamily: 'system-ui' }}>
      <h1>ColonyIQ</h1>
      <p>{status}</p>
      <p style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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
          <input
            type="file"
            accept="image/*"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
        </label>
        <button type="button" onClick={onSegment} disabled={!photoUrl}>
          Segment
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
    </main>
  );
}
