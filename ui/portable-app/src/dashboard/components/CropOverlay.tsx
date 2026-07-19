import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Crop, RotateCcw } from 'lucide-react';

interface CropRegion {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface CropOverlayProps {
  imageSrc: string;
  videoWidth: number;
  videoHeight: number;
  cropRegion: CropRegion | null;
  onCropChange: (region: CropRegion | null) => void;
}

export default function CropOverlay({ imageSrc, videoWidth, videoHeight, cropRegion, onCropChange }: CropOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentRect, setCurrentRect] = useState<CropRegion | null>(cropRegion);
  const [displayScale, setDisplayScale] = useState(1);

  useEffect(() => {
    setCurrentRect(cropRegion);
  }, [cropRegion]);

  useEffect(() => {
    if (containerRef.current && videoWidth > 0) {
      const containerW = containerRef.current.clientWidth;
      setDisplayScale(containerW / videoWidth);
    }
  }, [videoWidth]);

  const getRelativePos = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min((e.clientX - rect.left) / displayScale, videoWidth)),
      y: Math.max(0, Math.min((e.clientY - rect.top) / displayScale, videoHeight)),
    };
  }, [displayScale, videoWidth, videoHeight]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const pos = getRelativePos(e);
    setStartPos(pos);
    setIsDragging(true);
    setCurrentRect(null);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const pos = getRelativePos(e);
    const newRect: CropRegion = {
      x: Math.round(Math.min(startPos.x, pos.x)),
      y: Math.round(Math.min(startPos.y, pos.y)),
      w: Math.round(Math.abs(pos.x - startPos.x)),
      h: Math.round(Math.abs(pos.y - startPos.y)),
    };
    setCurrentRect(newRect);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    if (currentRect && currentRect.w > 20 && currentRect.h > 10) {
      onCropChange(currentRect);
    }
  };

  const handleReset = () => {
    setCurrentRect(null);
    onCropChange(null);
  };

  return (
    <div style={{ position: 'relative' }}>
      {/* Instructions */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        background: 'var(--bg-card)',
        borderRadius: '8px 8px 0 0',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
          <Crop size={16} style={{ color: 'var(--accent)' }} />
          <span style={{ color: 'var(--text-muted)' }}>
            Kéo chuột để chọn vùng phụ đề trên video
          </span>
        </div>
        {currentRect && (
          <button
            onClick={handleReset}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 10px',
              fontSize: 12,
              background: 'var(--bg-hover)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            <RotateCcw size={12} /> Đặt lại
          </button>
        )}
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: videoWidth && videoHeight ? `${videoWidth}/${videoHeight}` : '16/9',
          background: '#0a0a0f',
          cursor: isDragging ? 'crosshair' : 'crosshair',
          overflow: 'hidden',
          userSelect: 'none',
        }}
      >
        <img
          src={imageSrc}
          alt="Video frame for cropping"
          draggable={false}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            pointerEvents: 'none',
          }}
        />

        {/* Dim overlay outside crop */}
        {currentRect && (
          <>
            <div style={{
              position: 'absolute',
              top: 0, left: 0, right: 0,
              height: currentRect.y * displayScale,
              background: 'rgba(0,0,0,0.6)',
              pointerEvents: 'none',
            }} />
            <div style={{
              position: 'absolute',
              top: (currentRect.y + currentRect.h) * displayScale,
              left: 0, right: 0, bottom: 0,
              background: 'rgba(0,0,0,0.6)',
              pointerEvents: 'none',
            }} />
            <div style={{
              position: 'absolute',
              top: currentRect.y * displayScale,
              left: 0,
              width: currentRect.x * displayScale,
              height: currentRect.h * displayScale,
              background: 'rgba(0,0,0,0.6)',
              pointerEvents: 'none',
            }} />
            <div style={{
              position: 'absolute',
              top: currentRect.y * displayScale,
              left: (currentRect.x + currentRect.w) * displayScale,
              right: 0,
              height: currentRect.h * displayScale,
              background: 'rgba(0,0,0,0.6)',
              pointerEvents: 'none',
            }} />

            {/* Crop border */}
            <div style={{
              position: 'absolute',
              top: currentRect.y * displayScale,
              left: currentRect.x * displayScale,
              width: currentRect.w * displayScale,
              height: currentRect.h * displayScale,
              border: '2px dashed #00d4ff',
              boxShadow: '0 0 8px rgba(0,212,255,0.4)',
              pointerEvents: 'none',
            }} />

            {/* Dimension label */}
            <div style={{
              position: 'absolute',
              top: (currentRect.y + currentRect.h) * displayScale + 6,
              left: currentRect.x * displayScale,
              fontSize: 11,
              color: '#00d4ff',
              background: 'rgba(0,0,0,0.7)',
              padding: '2px 6px',
              borderRadius: 4,
              pointerEvents: 'none',
            }}>
              {currentRect.w} × {currentRect.h} px
            </div>
          </>
        )}
      </div>
    </div>
  );
}
