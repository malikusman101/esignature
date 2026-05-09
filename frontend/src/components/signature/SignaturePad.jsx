/**
 * SIGNATURE PAD COMPONENT
 *
 * Three modes (tabs):
 *  1. Draw   – free-hand canvas drawing (react-signature-canvas)
 *  2. Type   – type your name, rendered in a script font
 *  3. Upload – drag & drop an image of your signature
 *
 * onSave(dataUrl: string) is called with a PNG data URL
 * when the user clicks "Apply Signature".
 *
 * Usage:
 *   <SignaturePad onSave={(dataUrl) => setSignature(dataUrl)} />
 */

import React, { useRef, useState, useEffect } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { useDropzone } from 'react-dropzone';
import { Pen, Type, Upload, Trash2, Check } from 'lucide-react';

const FONT_STYLES = [
  { label: 'Dancing Script', value: "'Dancing Script', cursive" },
  { label: 'Pacifico',       value: "'Pacifico', cursive" },
  { label: 'Sacramento',     value: "'Sacramento', cursive" },
];

const COLORS = ['#000000', '#1a1a2e', '#1e40af', '#15803d', '#7c3aed'];

export default function SignaturePad({ onSave, onCancel, initialData = null }) {
  const [tab, setTab] = useState('draw');
  const [color, setColor] = useState('#000000');
  const [typedName, setTypedName] = useState('');
  const [fontStyle, setFontStyle] = useState(FONT_STYLES[0].value);
  const [uploadedImg, setUploadedImg] = useState(null);
  const [isEmpty, setIsEmpty] = useState(!initialData);

  const sigCanvasRef = useRef(null);
  const typeCanvasRef = useRef(null);

  // If we have initial data, load it into the draw canvas
  useEffect(() => {
    if (initialData && sigCanvasRef.current) {
      sigCanvasRef.current.fromDataURL(initialData);
      setIsEmpty(false);
    }
  }, [initialData]);

  // Whenever typed name or font changes, re-render to canvas
  useEffect(() => {
    if (tab !== 'type' || !typeCanvasRef.current) return;
    const canvas = typeCanvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!typedName) return;

    ctx.fillStyle = color;
    ctx.font = `48px ${fontStyle}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText(typedName, canvas.width / 2, canvas.height / 2);
    setIsEmpty(false);
  }, [typedName, fontStyle, color, tab]);

  const clear = () => {
    if (tab === 'draw' && sigCanvasRef.current) {
      sigCanvasRef.current.clear();
      setIsEmpty(true);
    }
    if (tab === 'type') { setTypedName(''); setIsEmpty(true); }
    if (tab === 'upload') { setUploadedImg(null); setIsEmpty(true); }
  };

  const getDataUrl = () => {
    if (tab === 'draw') {
      return sigCanvasRef.current?.toDataURL('image/png');
    }
    if (tab === 'type') {
      return typeCanvasRef.current?.toDataURL('image/png');
    }
    if (tab === 'upload') {
      return uploadedImg;
    }
    return null;
  };

  const handleSave = () => {
    const dataUrl = getDataUrl();
    if (!dataUrl || isEmpty) return;
    onSave(dataUrl);
  };

  // Dropzone for upload tab
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'image/*': ['.png', '.jpg', '.jpeg'] },
    maxFiles: 1,
    onDrop: (files) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setUploadedImg(e.target.result);
        setIsEmpty(false);
      };
      reader.readAsDataURL(files[0]);
    },
  });

  const TABS = [
    { id: 'draw',   label: 'Draw',   icon: Pen    },
    { id: 'type',   label: 'Type',   icon: Type   },
    { id: 'upload', label: 'Upload', icon: Upload  },
  ];

  return (
    <div style={styles.wrapper}>
      {/* Tab bar */}
      <div style={styles.tabs}>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            style={{ ...styles.tab, ...(tab === id ? styles.tabActive : {}) }}
            onClick={() => { setTab(id); setIsEmpty(true); }}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Color picker (draw + type) */}
      {tab !== 'upload' && (
        <div style={styles.colorRow}>
          <span style={styles.colorLabel}>Color:</span>
          {COLORS.map((c) => (
            <button
              key={c}
              style={{
                ...styles.colorDot,
                background: c,
                outline: color === c ? `2px solid ${c}` : 'none',
                outlineOffset: 2,
              }}
              onClick={() => setColor(c)}
            />
          ))}
        </div>
      )}

      {/* ── DRAW TAB ── */}
      {tab === 'draw' && (
        <div style={styles.canvasWrapper}>
          <SignatureCanvas
            ref={sigCanvasRef}
            penColor={color}
            canvasProps={{ width: 500, height: 160, style: styles.canvas }}
            onBegin={() => setIsEmpty(false)}
          />
          <p style={styles.hint}>Draw your signature above</p>
        </div>
      )}

      {/* ── TYPE TAB ── */}
      {tab === 'type' && (
        <div style={styles.typeWrapper}>
          <input
            type="text"
            placeholder="Type your full name..."
            value={typedName}
            onChange={(e) => setTypedName(e.target.value)}
            style={styles.typeInput}
            maxLength={50}
          />

          {/* Font selector */}
          <div style={styles.fontRow}>
            {FONT_STYLES.map((f) => (
              <button
                key={f.value}
                style={{
                  ...styles.fontBtn,
                  borderColor: fontStyle === f.value ? '#1a1a2e' : '#e2e8f0',
                  fontFamily: f.value,
                }}
                onClick={() => setFontStyle(f.value)}
              >
                {typedName || 'Preview'}
              </button>
            ))}
          </div>

          {/* Hidden canvas for export */}
          <canvas
            ref={typeCanvasRef}
            width={500}
            height={160}
            style={{ display: 'none' }}
          />
        </div>
      )}

      {/* ── UPLOAD TAB ── */}
      {tab === 'upload' && (
        <div style={styles.uploadWrapper}>
          {uploadedImg ? (
            <div style={styles.uploadPreview}>
              <img src={uploadedImg} alt="Signature" style={{ maxHeight: 120, maxWidth: '100%', objectFit: 'contain' }} />
            </div>
          ) : (
            <div {...getRootProps()} style={{ ...styles.dropzone, ...(isDragActive ? styles.dropzoneActive : {}) }}>
              <input {...getInputProps()} />
              <Upload size={24} color="#94a3b8" />
              <p style={styles.dropzoneText}>
                {isDragActive ? 'Drop it here!' : 'Drag & drop or click to upload signature image'}
              </p>
              <p style={styles.dropzoneHint}>PNG or JPG – transparent background works best</p>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div style={styles.actions}>
        <button style={{ ...styles.btn, ...styles.btnGhost }} onClick={clear}>
          <Trash2 size={14} /> Clear
        </button>
        <div style={{ display: 'flex', gap: 8 }}>
          {onCancel && (
            <button style={{ ...styles.btn, ...styles.btnOutline }} onClick={onCancel}>
              Cancel
            </button>
          )}
          <button
            style={{ ...styles.btn, ...styles.btnPrimary, opacity: isEmpty ? 0.5 : 1 }}
            onClick={handleSave}
            disabled={isEmpty}
          >
            <Check size={14} /> Apply Signature
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  wrapper: {
    background: '#fff',
    border: '1.5px solid #e2e8f0',
    borderRadius: 14,
    overflow: 'hidden',
    fontFamily: 'var(--font-body, DM Sans, sans-serif)',
  },
  tabs: {
    display: 'flex',
    borderBottom: '1px solid #e2e8f0',
  },
  tab: {
    flex: 1,
    padding: '12px 16px',
    border: 'none',
    background: 'transparent',
    fontSize: 13,
    fontWeight: 600,
    color: '#94a3b8',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderBottom: '2px solid transparent',
    transition: 'all 0.15s',
  },
  tabActive: {
    color: '#1a1a2e',
    borderBottomColor: '#1a1a2e',
    background: '#f8fafc',
  },
  colorRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 16px',
    borderBottom: '1px solid #e2e8f0',
  },
  colorLabel: { fontSize: 12, color: '#64748b', fontWeight: 600 },
  colorDot: {
    width: 18, height: 18,
    borderRadius: '50%',
    border: 'none',
    cursor: 'pointer',
    transition: 'transform 0.1s',
  },
  canvasWrapper: { padding: '0 0 8px', position: 'relative' },
  canvas: {
    display: 'block',
    width: '100%',
    maxWidth: 500,
    height: 160,
    cursor: 'crosshair',
    background: '#fafbff',
    backgroundImage: 'linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px)',
    backgroundSize: '100% 40px',
    backgroundPosition: '0 120px',
  },
  hint: { fontSize: 11, color: '#94a3b8', textAlign: 'center', paddingBottom: 8 },
  typeWrapper: { padding: 16 },
  typeInput: {
    width: '100%',
    padding: '10px 14px',
    border: '1.5px solid #e2e8f0',
    borderRadius: 8,
    fontSize: 14,
    marginBottom: 12,
    outline: 'none',
  },
  fontRow: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  fontBtn: {
    flex: 1,
    minWidth: 120,
    padding: '10px 16px',
    border: '2px solid',
    borderRadius: 8,
    background: '#fafbff',
    fontSize: 18,
    cursor: 'pointer',
    textAlign: 'center',
    transition: 'border-color 0.15s',
  },
  uploadWrapper: { padding: 16 },
  uploadPreview: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
    background: '#f8fafc',
    borderRadius: 8,
  },
  dropzone: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 120,
    border: '2px dashed #e2e8f0',
    borderRadius: 8,
    cursor: 'pointer',
    transition: 'border-color 0.15s, background 0.15s',
    padding: 16,
  },
  dropzoneActive: { borderColor: '#1a1a2e', background: '#f0f4ff' },
  dropzoneText: { fontSize: 14, color: '#475569', textAlign: 'center' },
  dropzoneHint: { fontSize: 12, color: '#94a3b8' },
  actions: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    borderTop: '1px solid #e2e8f0',
    background: '#f8fafc',
  },
  btn: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
    border: 'none', cursor: 'pointer', transition: 'all 0.15s',
  },
  btnPrimary: { background: '#1a1a2e', color: '#fff' },
  btnOutline: { background: 'transparent', color: '#1a1a2e', border: '1.5px solid #e2e8f0' },
  btnGhost: { background: 'transparent', color: '#94a3b8' },
};