import React, { useState } from 'react';
import { Copy, Check, Scissors } from 'lucide-react';

interface OcrChunkerProps {
  text: string;
}

export default function OcrChunker({ text }: OcrChunkerProps) {
  const [chunkSize, setChunkSize] = useState(500);
  const [splitMethod, setSplitMethod] = useState<'chars' | 'lines'>('chars');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  if (!text) return null;

  const getChunks = () => {
    if (splitMethod === 'chars') {
      const chunks: string[] = [];
      let i = 0;
      while (i < text.length) {
        chunks.push(text.slice(i, i + chunkSize));
        i += chunkSize;
      }
      return chunks;
    } else {
      const lines = text.split('\n');
      const chunks: string[] = [];
      for (let i = 0; i < lines.length; i += chunkSize) {
        chunks.push(lines.slice(i, i + chunkSize).join('\n'));
      }
      return chunks.filter(c => c.trim().length > 0);
    }
  };

  const chunks = getChunks();

  const handleCopy = (chunkText: string, index: number) => {
    navigator.clipboard.writeText(chunkText);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 1500);
  };

  return (
    <div style={{ marginTop: '1.25rem', borderTop: '1px solid var(--color-border)', paddingTop: '1.25rem' }}>
      <h4 style={{ fontSize: '0.8rem', fontWeight: 600, color: 'white', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
        <Scissors className="w-4 h-4 text-cyan-400" />
        Chia nhỏ văn bản để dịch song song (Mutil-task)
      </h4>

      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '12px' }}>
        <select
          value={splitMethod}
          onChange={(e) => { setSplitMethod(e.target.value as any); setChunkSize(e.target.value === 'chars' ? 500 : 10); }}
          className="select-item"
          style={{ padding: '4px 8px', fontSize: '0.7rem', backgroundColor: 'var(--color-bg-dark)', border: '1px solid var(--color-border)', color: 'white', borderRadius: '6px' }}
        >
          <option value="chars">Chia theo số ký tự</option>
          <option value="lines">Chia theo số dòng</option>
        </select>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)' }}>Kích thước chunk:</span>
          <input
            type="number"
            value={chunkSize}
            onChange={(e) => setChunkSize(Math.max(1, parseInt(e.target.value) || 1))}
            style={{ width: '60px', padding: '4px 8px', fontSize: '0.7rem', backgroundColor: 'var(--color-bg-dark)', border: '1px solid var(--color-border)', color: 'white', borderRadius: '6px', textAlign: 'center' }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '250px', overflowY: 'auto' }}>
        {chunks.map((chunk, idx) => (
          <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '8px', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid var(--color-border)', borderRadius: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.65rem', color: 'var(--color-cyan)', fontWeight: 600 }}>Chunk #{idx + 1} ({splitMethod === 'chars' ? `${chunk.length} ký tự` : `${chunk.split('\n').length} dòng`})</span>
              <button
                onClick={() => handleCopy(chunk, idx)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', color: copiedIndex === idx ? '#10b981' : 'var(--color-text-secondary)', fontSize: '0.6rem' }}
              >
                {copiedIndex === idx ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                <span>{copiedIndex === idx ? 'Đã copy' : 'Copy'}</span>
              </button>
            </div>
            <pre style={{ margin: 0, padding: '4px', fontSize: '0.65rem', color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap', fontFamily: 'monospace', maxHeight: '80px', overflowY: 'auto' }}>
              {chunk}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
}
