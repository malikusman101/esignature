/**
 * UPLOAD DOCUMENT PAGE
 *
 * Step 1 – Drop/select PDF file
 * Step 2 – Add signers (name + email + role + color)
 * Step 3 – Place signature fields on the PDF visually
 * Step 4 – Send / Save as draft
 *
 * The field placement uses a simplified overlay approach:
 * we show the first-page thumbnail and let users click to place fields.
 * Real PDF rendering (react-pdf) would be used for multi-page docs.
 */

import React, { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { Upload, Plus, Trash2, Send, Save, ArrowLeft, ArrowRight, User, FileText, ChevronDown } from 'lucide-react';
import Sidebar from '../components/sidebar';
import { documentsAPI } from '../services/api';
import toast from 'react-hot-toast';

const FIELD_TYPES = [
  { type:'signature',  label:'Signature',  icon:'✍️' },
  { type:'initials',   label:'Initials',   icon:'🔤' },
  { type:'date',       label:'Date',       icon:'📅' },
  { type:'text',       label:'Text',       icon:'T'  },
  { type:'checkbox',   label:'Checkbox',   icon:'☑️' },
  { type:'name',       label:'Full Name',  icon:'👤' },
];

const SIGNER_COLORS = ['#3B82F6','#8B5CF6','#EC4899','#F59E0B','#10B981','#EF4444'];

const STEPS = ['Upload','Signers','Fields','Review'];

export default function UploadDocumentPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [signers, setSigners] = useState([{ name:'', email:'', role:'signer', color: SIGNER_COLORS[0] }]);
  const [fields, setFields] = useState([]);
  const [activeSignerIdx, setActiveSignerIdx] = useState(0);
  const [activeFieldType, setActiveFieldType] = useState('signature');
  const [loading, setLoading] = useState(false);
  const [uploadedDoc, setUploadedDoc] = useState(null);
  const fieldAreaRef = useRef(null);

  // ── Step 1: File drop ────────────────────────────────────────────────────
  const onDrop = useCallback((acceptedFiles) => {
    const f = acceptedFiles[0];
    if (!f) return;
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.pdf$/i, ''));
  }, [title]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'application/pdf': ['.pdf'] }, maxFiles: 1, maxSize: 10*1024*1024,
  });

  // ── Step 2: Signer management ─────────────────────────────────────────────
  const addSigner = () => {
    if (signers.length >= 6) return toast.error('Maximum 6 signers');
    setSigners(s => [...s, { name:'', email:'', role:'signer', color: SIGNER_COLORS[s.length % SIGNER_COLORS.length] }]);
  };
  const removeSigner = (i) => {
    setSigners(s => s.filter((_,idx) => idx !== i));
    setFields(f => f.filter(field => field.signerIndex !== i).map(field => ({
      ...field, signerIndex: field.signerIndex > i ? field.signerIndex - 1 : field.signerIndex
    })));
  };
  const updateSigner = (i, key, val) => setSigners(s => s.map((x,idx) => idx===i ? {...x,[key]:val} : x));

  // ── Step 3: Field placement ────────────────────────────────────────────────
  const handleAreaClick = (e) => {
    if (!fieldAreaRef.current) return;
    const rect = fieldAreaRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    const defaults = {
      signature: { width:22, height:8 }, initials: { width:10, height:8 },
      date: { width:14, height:5 }, text: { width:20, height:5 },
      checkbox: { width:4, height:4 }, name: { width:18, height:5 },
    };
    const { width, height } = defaults[activeFieldType] || { width:18, height:6 };

    setFields(f => [...f, {
      id: Date.now().toString(),
      type: activeFieldType,
      page: 1,
      x: Math.max(0, Math.min(x - width/2, 100 - width)),
      y: Math.max(0, Math.min(y - height/2, 100 - height)),
      width, height,
      required: true,
      signerIndex: activeSignerIdx,
      label: '',
    }]);
  };

  const removeField = (id) => setFields(f => f.filter(x => x.id !== id));

  // ── Upload + Send ─────────────────────────────────────────────────────────
  const handleUpload = async () => {
    if (!file) return toast.error('Please select a file');
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', title || file.name);
      const { data } = await documentsAPI.upload(formData);
      setUploadedDoc(data.data.document);
      toast.success('Document uploaded!');
      setStep(1);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed');
    } finally { setLoading(false); }
  };

  const validateSigners = () => {
    for (const s of signers) {
      if (!s.name.trim()) return toast.error('All signers need a name') || false;
      if (!s.email.trim() || !/\S+@\S+\.\S+/.test(s.email)) return toast.error('Valid email required for each signer') || false;
    }
    return true;
  };

  const handleSend = async () => {
    if (!validateSigners()) return;
    setLoading(true);
    try {
      await documentsAPI.send(uploadedDoc.id, {
        signers: signers.map(s => ({ name:s.name, email:s.email, role:s.role, color:s.color })),
        fields: fields.map(f => ({
          signerIndex: f.signerIndex, type:f.type, page:f.page,
          x:f.x, y:f.y, width:f.width, height:f.height, required:f.required, label:f.label,
        })),
        message,
      });
      toast.success('Document sent for signature!');
      navigate(`/documents/${uploadedDoc.id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send');
    } finally { setLoading(false); }
  };

  const handleSaveDraft = async () => {
    if (!uploadedDoc) return;
    toast.success('Saved as draft');
    navigate(`/documents/${uploadedDoc.id}`);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page">
          {/* Header */}
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:28 }}>
            <button className="btn btn-ghost btn-sm btn-icon" onClick={() => step > 0 ? setStep(s=>s-1) : navigate('/documents')}>
              <ArrowLeft size={18}/>
            </button>
            <div>
              <h1 style={{ fontSize:24, fontWeight:700 }}>New Document</h1>
              <p style={{ color:'var(--text-2)', fontSize:13 }}>Step {step+1} of {STEPS.length}: {STEPS[step]}</p>
            </div>
          </div>

          {/* Step indicator */}
          <div style={{ display:'flex', gap:0, marginBottom:32, background:'var(--surface)', borderRadius:12, padding:6, border:'1px solid var(--border)', maxWidth:480 }}>
            {STEPS.map((s,i) => (
              <div key={s} style={{
                flex:1, textAlign:'center', padding:'8px 4px', borderRadius:8, fontSize:13, fontWeight:600,
                background: i===step ? 'var(--primary)' : 'transparent',
                color: i===step ? '#fff' : i<step ? 'var(--success)' : 'var(--text-3)',
                transition:'all 0.2s',
              }}>{i < step ? '✓ ' : ''}{s}</div>
            ))}
          </div>

          {/* ── STEP 0: Upload ── */}
          {step === 0 && (
            <div style={{ maxWidth:600 }}>
              <div {...getRootProps()} style={{
                border: `2px dashed ${isDragActive ? 'var(--primary)' : 'var(--border-dark)'}`,
                borderRadius:16, padding:48, textAlign:'center', cursor:'pointer',
                background: isDragActive ? '#f0f4ff' : 'var(--surface)',
                transition:'all 0.2s', marginBottom:20,
              }}>
                <input {...getInputProps()}/>
                <div style={{ width:64, height:64, borderRadius:16, background:'#eff6ff', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
                  <Upload size={28} color="#3b82f6"/>
                </div>
                {file ? (
                  <>
                    <p style={{ fontSize:16, fontWeight:700, marginBottom:4 }}>✅ {file.name}</p>
                    <p style={{ color:'var(--text-2)', fontSize:13 }}>{(file.size/1024).toFixed(0)} KB • Click to change</p>
                  </>
                ) : (
                  <>
                    <p style={{ fontSize:16, fontWeight:700, marginBottom:8 }}>
                      {isDragActive ? 'Drop it here!' : 'Drag & drop your PDF here'}
                    </p>
                    <p style={{ color:'var(--text-2)', fontSize:13, marginBottom:16 }}>or click to browse files</p>
                    <span style={{ background:'var(--surface-2)', padding:'6px 16px', borderRadius:20, fontSize:12, color:'var(--text-2)' }}>PDF only • Max 10MB</span>
                  </>
                )}
              </div>

              {file && (
                <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                  <div className="form-group">
                    <label className="form-label">Document Title</label>
                    <input className="form-input" value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Service Agreement 2024"/>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Message to Signers (optional)</label>
                    <textarea className="form-input" value={message} onChange={e=>setMessage(e.target.value)}
                      placeholder="Please review and sign this document at your earliest convenience..." rows={3}/>
                  </div>
                  <button className="btn btn-primary btn-lg" onClick={handleUpload} disabled={loading}>
                    {loading ? <><span className="spinner"/>Uploading...</> : <>Upload & Continue <ArrowRight size={16}/></>}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── STEP 1: Signers ── */}
          {step === 1 && (
            <div style={{ maxWidth:620 }}>
              <p style={{ color:'var(--text-2)', marginBottom:20, fontSize:14 }}>Add everyone who needs to sign or review this document.</p>
              {signers.map((signer, i) => (
                <div key={i} className="card" style={{ marginBottom:12, padding:16 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <div style={{ width:28, height:28, borderRadius:'50%', background:signer.color, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:12, fontWeight:700 }}>
                        {i+1}
                      </div>
                      <span style={{ fontWeight:600, fontSize:14 }}>Signer {i+1}</span>
                    </div>
                    {signers.length > 1 && (
                      <button className="btn btn-ghost btn-sm btn-icon" onClick={() => removeSigner(i)} style={{ color:'var(--error)' }}>
                        <Trash2 size={14}/>
                      </button>
                    )}
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
                    <div className="form-group" style={{ marginBottom:0 }}>
                      <label className="form-label">Full Name *</label>
                      <input className="form-input" placeholder="Jane Smith" value={signer.name}
                        onChange={e => updateSigner(i,'name',e.target.value)}/>
                    </div>
                    <div className="form-group" style={{ marginBottom:0 }}>
                      <label className="form-label">Email *</label>
                      <input className="form-input" type="email" placeholder="jane@example.com" value={signer.email}
                        onChange={e => updateSigner(i,'email',e.target.value)}/>
                    </div>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                    <div className="form-group" style={{ marginBottom:0 }}>
                      <label className="form-label">Role</label>
                      <select className="form-input" value={signer.role} onChange={e=>updateSigner(i,'role',e.target.value)}>
                        <option value="signer">Signer</option>
                        <option value="approver">Approver</option>
                        <option value="viewer">Viewer (CC)</option>
                      </select>
                    </div>
                    <div className="form-group" style={{ marginBottom:0 }}>
                      <label className="form-label">Color</label>
                      <div style={{ display:'flex', gap:6, marginTop:4 }}>
                        {SIGNER_COLORS.map(c => (
                          <button key={c} onClick={() => updateSigner(i,'color',c)}
                            style={{ width:24, height:24, borderRadius:'50%', background:c, border:signer.color===c ? '3px solid var(--primary)' : '2px solid transparent', cursor:'pointer', outline:'none' }}/>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              <button className="btn btn-outline" onClick={addSigner} style={{ marginBottom:24 }}>
                <Plus size={15}/> Add Another Signer
              </button>
              <div style={{ display:'flex', gap:10 }}>
                <button className="btn btn-outline" onClick={() => setStep(0)}><ArrowLeft size={15}/> Back</button>
                <button className="btn btn-primary" onClick={() => validateSigners() && setStep(2)}>
                  Continue to Fields <ArrowRight size={15}/>
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 2: Field Placement ── */}
          {step === 2 && (
            <div style={{ display:'grid', gridTemplateColumns:'220px 1fr', gap:20 }}>
              {/* Left panel */}
              <div>
                <p style={{ fontSize:12, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10 }}>Field Types</p>
                {FIELD_TYPES.map(ft => (
                  <button key={ft.type} onClick={()=>setActiveFieldType(ft.type)}
                    style={{
                      display:'flex', alignItems:'center', gap:8, width:'100%', padding:'9px 12px',
                      borderRadius:8, border:'none', marginBottom:4, cursor:'pointer', fontSize:13, fontWeight:500,
                      background: activeFieldType===ft.type ? 'var(--primary)' : 'var(--surface)',
                      color: activeFieldType===ft.type ? '#fff' : 'var(--text)',
                      border: activeFieldType===ft.type ? 'none' : '1px solid var(--border)',
                    }}>
                    <span>{ft.icon}</span> {ft.label}
                  </button>
                ))}
                <div style={{ marginTop:20, borderTop:'1px solid var(--border)', paddingTop:16 }}>
                  <p style={{ fontSize:12, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10 }}>Assign To</p>
                  {signers.map((s,i) => (
                    <button key={i} onClick={()=>setActiveSignerIdx(i)}
                      style={{
                        display:'flex', alignItems:'center', gap:8, width:'100%', padding:'8px 12px',
                        borderRadius:8, border:`2px solid ${activeSignerIdx===i ? s.color : 'var(--border)'}`,
                        background: activeSignerIdx===i ? s.color+'18' : 'var(--surface)',
                        marginBottom:4, cursor:'pointer', fontSize:13,
                      }}>
                      <div style={{ width:20, height:20, borderRadius:'50%', background:s.color, color:'#fff', fontSize:10, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center' }}>{i+1}</div>
                      <span style={{ fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>{s.name||`Signer ${i+1}`}</span>
                    </button>
                  ))}
                </div>
                <div style={{ marginTop:16, fontSize:12, color:'var(--text-3)', lineHeight:1.6, padding:'10px 12px', background:'var(--surface-2)', borderRadius:8 }}>
                  💡 Click anywhere on the document to place a field
                </div>
              </div>

              {/* Field placement area */}
              <div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                  <p style={{ fontSize:14, fontWeight:600 }}>Click to place fields • {fields.length} placed</p>
                  {fields.length > 0 && (
                    <button className="btn btn-ghost btn-sm" onClick={()=>setFields([])} style={{ color:'var(--error)' }}>
                      <Trash2 size={13}/> Clear all
                    </button>
                  )}
                </div>

                {/* Mock PDF page */}
                <div ref={fieldAreaRef} onClick={handleAreaClick}
                  style={{
                    position:'relative', width:'100%', paddingTop:'141%', /* A4 aspect ratio */
                    background:'white', borderRadius:8, boxShadow:'var(--shadow-lg)',
                    border:'1px solid var(--border)', cursor:'crosshair', overflow:'hidden',
                  }}>
                  {/* Lined paper effect */}
                  <div style={{ position:'absolute', inset:0, backgroundImage:'repeating-linear-gradient(transparent, transparent 27px, #e8eaf6 28px)', backgroundSize:'100% 28px', opacity:0.4 }}/>

                  {/* PDF icon / placeholder */}
                  <div style={{ position:'absolute', top:'5%', left:'50%', transform:'translateX(-50%)', textAlign:'center', pointerEvents:'none' }}>
                    <FileText size={32} color="#e2e8f0" style={{ margin:'0 auto' }}/>
                    <p style={{ fontSize:12, color:'#e2e8f0', marginTop:6 }}>Click to place fields on document</p>
                  </div>

                  {/* Placed fields */}
                  {fields.map(f => {
                    const signerColor = signers[f.signerIndex]?.color || '#3b82f6';
                    return (
                      <div key={f.id} style={{
                        position:'absolute',
                        left:`${f.x}%`, top:`${f.y}%`,
                        width:`${f.width}%`, height:`${f.height}%`,
                        background: signerColor+'22',
                        border:`2px solid ${signerColor}`,
                        borderRadius:4, display:'flex', alignItems:'center', justifyContent:'center',
                        fontSize:10, fontWeight:700, color:signerColor, gap:4,
                        userSelect:'none',
                      }}>
                        {FIELD_TYPES.find(x=>x.type===f.type)?.icon} {f.type}
                        <button
                          onClick={e=>{e.stopPropagation();removeField(f.id);}}
                          style={{ position:'absolute', top:-8, right:-8, background:signerColor, border:'none', borderRadius:'50%', width:16, height:16, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'#fff', fontSize:10 }}>
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div style={{ display:'flex', gap:10, marginTop:20 }}>
              <button className="btn btn-outline" onClick={()=>setStep(1)}><ArrowLeft size={15}/> Back</button>
              <button className="btn btn-primary" onClick={()=>setStep(3)}>Review & Send <ArrowRight size={15}/></button>
            </div>
          )}

          {/* ── STEP 3: Review ── */}
          {step === 3 && (
            <div style={{ maxWidth:580 }}>
              <div className="card" style={{ marginBottom:16 }}>
                <h3 style={{ fontWeight:700, marginBottom:12 }}>📄 Document</h3>
                <p style={{ fontSize:15, fontWeight:600 }}>{title}</p>
                {message && <p style={{ color:'var(--text-2)', fontSize:13, marginTop:6, fontStyle:'italic' }}>"{message}"</p>}
              </div>
              <div className="card" style={{ marginBottom:16 }}>
                <h3 style={{ fontWeight:700, marginBottom:12 }}>👥 Signers ({signers.length})</h3>
                {signers.map((s,i) => (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                    <div style={{ width:32, height:32, borderRadius:'50%', background:s.color, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:700, fontSize:12 }}>{i+1}</div>
                    <div>
                      <p style={{ fontWeight:600, fontSize:14 }}>{s.name}</p>
                      <p style={{ fontSize:12, color:'var(--text-2)' }}>{s.email} • {s.role}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="card" style={{ marginBottom:24 }}>
                <h3 style={{ fontWeight:700, marginBottom:8 }}>🏷️ Fields ({fields.length})</h3>
                {fields.length === 0 ? (
                  <p style={{ color:'var(--text-3)', fontSize:13 }}>No fields placed — signers will sign blank document.</p>
                ) : (
                  <p style={{ fontSize:13, color:'var(--text-2)' }}>
                    {fields.filter(f=>f.type==='signature').length} signature(s), {fields.filter(f=>f.type==='date').length} date(s), {fields.filter(f=>!['signature','date'].includes(f.type)).length} other field(s)
                  </p>
                )}
              </div>
              <div style={{ display:'flex', gap:10 }}>
                <button className="btn btn-outline" onClick={()=>setStep(2)}><ArrowLeft size={15}/> Back</button>
                <button className="btn btn-outline" onClick={handleSaveDraft} disabled={loading}>
                  <Save size={15}/> Save as Draft
                </button>
                <button className="btn btn-primary" onClick={handleSend} disabled={loading}>
                  {loading ? <><span className="spinner"/>Sending...</> : <><Send size={15}/> Send for Signature</>}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}