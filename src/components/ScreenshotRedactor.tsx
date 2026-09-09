'use client';

import { download } from '@/lib/export';
import { useEffect, useRef, useState } from 'react';

/**
 * Hides the identifying parts of a real game screenshot.
 *
 * A generated collage is clear, but it is a claim; a screenshot of the game is
 * evidence, and buyers read it as such. The reason a seller cannot simply post
 * one is that a Fortnite locker screen carries the display name — and often
 * the email in the top corner of the launcher — which is enough to look the
 * account up and enough to try to recover it after the sale.
 *
 * So: pick the screenshot, drag the boxes over those, save. The boxes start
 * where those things usually sit and are dragged from there, because every
 * capture is cropped differently and a fixed position would quietly stop
 * covering the name on the next screenshot.
 *
 * Mosaic rather than a solid block, which is what the listings this imitates
 * use — a black bar says "something was removed here" more loudly than a
 * blurred patch, and draws the eye straight to it.
 */

interface Box {
  id: string;
  /** Fractions of the image, so a box survives the preview being scaled. */
  x: number;
  y: number;
  w: number;
  h: number;
}

const DEFAULT_BOXES: Box[] = [
  // Where Fortnite puts the display name on the locker and lobby screens.
  { id: 'name', x: 0.03, y: 0.04, w: 0.22, h: 0.06 },
  // The launcher's account corner, and where an email overlay usually lands.
  { id: 'email', x: 0.72, y: 0.02, w: 0.26, h: 0.05 },
];

/** Big enough to destroy text, small enough to read as a deliberate blur. */
const MOSAIC = 14;

export function ScreenshotRedactor() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [boxes, setBoxes] = useState<Box[]>(DEFAULT_BOXES);
  const [dragging, setDragging] = useState<{ id: string; dx: number; dy: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  function load(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const loaded = new Image();
      loaded.onload = () => {
        setImage(loaded);
        setBoxes(DEFAULT_BOXES);
      };
      loaded.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  }

  // Redrawn on every box move: the canvas is the preview, so there is no
  // second representation to keep in step with it.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;

    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(image, 0, 0);

    for (const box of boxes) {
      const x = Math.round(box.x * canvas.width);
      const y = Math.round(box.y * canvas.height);
      const w = Math.max(4, Math.round(box.w * canvas.width));
      const h = Math.max(4, Math.round(box.h * canvas.height));

      // Mosaic by drawing the region into itself at a fraction of the size and
      // back out again with smoothing off — no pixel loop, and the result is
      // the same blocky average.
      const cols = Math.max(1, Math.round(w / MOSAIC));
      const rows = Math.max(1, Math.round(h / MOSAIC));
      const scratch = document.createElement('canvas');
      scratch.width = cols;
      scratch.height = rows;
      const small = scratch.getContext('2d');
      if (!small) continue;
      small.imageSmoothingEnabled = true;
      small.drawImage(canvas, x, y, w, h, 0, 0, cols, rows);

      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(scratch, 0, 0, cols, rows, x, y, w, h);
      ctx.imageSmoothingEnabled = true;
    }
  }, [image, boxes]);

  function pointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const fx = (event.clientX - rect.left) / rect.width;
    const fy = (event.clientY - rect.top) / rect.height;

    // Topmost box under the pointer wins, so overlapping boxes stay separable.
    const hit = [...boxes]
      .reverse()
      .find((box) => fx >= box.x && fx <= box.x + box.w && fy >= box.y && fy <= box.y + box.h);
    if (!hit) return;

    setDragging({ id: hit.id, dx: fx - hit.x, dy: fy - hit.y });
    canvas.setPointerCapture(event.pointerId);
  }

  function pointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!dragging) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const fx = (event.clientX - rect.left) / rect.width;
    const fy = (event.clientY - rect.top) / rect.height;

    setBoxes((current) =>
      current.map((box) =>
        box.id === dragging.id
          ? {
              ...box,
              // Clamped so a box cannot be dragged off the picture and lost.
              x: Math.min(1 - box.w, Math.max(0, fx - dragging.dx)),
              y: Math.min(1 - box.h, Math.max(0, fy - dragging.dy)),
            }
          : box,
      ),
    );
  }

  function resize(id: string, factor: number) {
    setBoxes((current) =>
      current.map((box) =>
        box.id === id
          ? {
              ...box,
              w: Math.min(1 - box.x, Math.max(0.04, box.w * factor)),
              h: Math.min(1 - box.y, Math.max(0.02, box.h * factor)),
            }
          : box,
      ),
    );
  }

  function save() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (blob) download('fortnite-screenshot.png', blob);
    }, 'image/png');
  }

  return (
    <div className="pane">
      <div style={{ marginBottom: 12 }}>
        <div>
          <h3 style={{ font: '650 15px/1.2 system-ui', margin: 0 }}>Скриншот из игры</h3>
          <p className="note" style={{ margin: '4px 0 0' }}>
            Закройте ник и почту — по ним аккаунт находят и пробуют вернуть после продажи.
            Перетащите прямоугольники мышью.
          </p>
        </div>
        <input
          type="file"
          accept="image/*"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) load(file);
          }}
          className="note"
        />
      </div>

      {image && (
        <>
          <canvas
            ref={canvasRef}
            onPointerDown={pointerDown}
            onPointerMove={pointerMove}
            onPointerUp={() => setDragging(null)}
            style={{
              width: '100%',
              borderRadius: 10,
              border: '1px solid var(--border)',
              cursor: dragging ? 'grabbing' : 'grab',
              touchAction: 'none',
            }}
          />
          <div className="row" style={{ marginTop: 10 }}>
            {boxes.map((box) => (
              <span key={box.id} className="row" style={{ gap: 4 }}>
                <span className="note">{box.id === 'name' ? 'ник' : 'почта'}</span>
                <button className="btn secondary small" onClick={() => resize(box.id, 1.2)}>
                  +
                </button>
                <button className="btn secondary small" onClick={() => resize(box.id, 0.85)}>
                  −
                </button>
              </span>
            ))}
            <button className="btn" onClick={save}>
              Сохранить скриншот
            </button>
          </div>
        </>
      )}
    </div>
  );
}
