import { useEffect, useRef } from 'react';
import type { PointerEvent } from 'react';

interface SignaturePadProps {
  onReady: (blob: Blob | null) => void;
}

export function SignaturePad({ onReady }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const dirty = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const pixelRatio = window.devicePixelRatio || 1;
    canvas.width = rect.width * pixelRatio;
    canvas.height = rect.height * pixelRatio;

    const context = canvas.getContext('2d');
    if (!context) return;
    context.scale(pixelRatio, pixelRatio);
    context.strokeStyle = '#0f172a';
    context.lineWidth = 2;
    context.lineCap = 'round';
    context.lineJoin = 'round';
  }, []);

  const position = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const handlePointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const context = canvas.getContext('2d');
    if (!context) return;

    drawing.current = true;
    canvas.setPointerCapture(event.pointerId);
    const point = position(event);
    context.beginPath();
    context.moveTo(point.x, point.y);
  };

  const handlePointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const context = canvasRef.current!.getContext('2d');
    if (!context) return;

    const point = position(event);
    context.lineTo(point.x, point.y);
    context.stroke();
    dirty.current = true;
  };

  const finishStroke = () => {
    if (!drawing.current) return;
    drawing.current = false;
    if (dirty.current) canvasRef.current!.toBlob(onReady);
  };

  const clear = () => {
    const canvas = canvasRef.current!;
    const context = canvas.getContext('2d');
    if (!context) return;

    context.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    dirty.current = false;
    onReady(null);
  };

  return (
    <div>
      <canvas
        ref={canvasRef}
        className="h-32 w-full touch-none rounded-md border border-slate-300 bg-white"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishStroke}
        onPointerCancel={finishStroke}
        onPointerLeave={finishStroke}
      />
      <button type="button" onClick={clear} className="mt-1 text-xs text-slate-500 underline">
        Clear signature
      </button>
    </div>
  );
}
