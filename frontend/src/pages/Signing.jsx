/**
 * SIGNING PAGE  (Public — no login required)
 *
 * Flow:
 *  1. Load signing data via token from URL
 *  2. Show PDF (via iframe pointing to /api/sign/:token/file)
 *  3. Render field overlays on the right panel
 *  4. For signature/initials fields → open SignaturePad modal
 *  5. On "Submit" → POST all field values to backend
 *
 * The split-screen layout: left = PDF viewer, right = fields form
 */

import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Check, X, Pen, AlertTriangle, CheckCircle } from 'lucide-react';
import SignaturePad from '../components/signature/SignaturePad';
import { signingAPI } from '../services/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const FIELD_ICONS = {
  signature:'✍️', initials:'🔤', date:'📅', text:'T',
  checkbox:'☑️', name:'👤', email:'📧', title:'💼', company:'🏢',
};

export default function SigningPage() {
  const { token } = useParams();
  const [signingData, setSigningData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fieldValues, setFieldValues] = useState({});
  const [sigPadField, setSigPadField] = useState(null); // field currently using pad
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [declined, setDeclined] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await signingAPI.getSigningData(token);
        setSigningData(data.data);
        // Pre-fill date fields with today
        const pre = {};
        (data.data.fields||[]).forEach(f => {
          if (f.type === 'date') pre[f.id] = format(new Date(), 'MM/dd/yyyy');
          if (f.type === 'checkbox') pre[f.id] = 'false';
        });
        setFieldValues(pre);
      } catch (err) {
        setError(err.response?.data?.message || 'Invalid or expired signing link');
      } finally { setLoading(false); }
    };
    load();
  }, [token]);

  const handleFieldChange = (fieldId, value) => {
    setFieldValues(p => ({...p, [fieldId]: value}));
  };

  const handleSignatureSave = (dataUrl) => {
    handleFieldChange(sigPadField.id, null); // clear text value
    setFieldValues(p => ({...p, [sigPadField.id]: '__sig__'})); // marker
    // Store the actual data url keyed by fieldId
    setFieldValues(p => ({...p, [`${sigPadField.id}_data`]: dataUrl, [sigPadField.id]: '__sig__'}));
    setSigPadField(null);
    toast.success('Signature applied!');
  };

  const handleSubmit = async () => {
    const { fields } = signingData;
    const required = fields.filter(f => f.required);
    const missing = required.filter(f => {
      const val = fieldValues[f.id];
      const data = fieldValues[`${f.id}_data`];
      return (!val || val === '') && !data;
    });

    if (missing.length > 0) {
      toast.error(`${missing.length} required field(s) still need to be completed`);
      return;
    }

    setSubmitting(true);
    try {
      const submittedFields = fields.map(f => ({
        id: f.id,
        value: ['signature','initials'].includes(f.type) ? null : fieldValues[f.id] || null,
        signatureData: ['signature','initials'].includes(f.type) ? fieldValues[`${f.id}_data`] || null : null,
      }));

      await signingAPI.submit(token, submittedFields);
      setSubmitted(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Submission failed. Please try again.');
    } finally { setSubmitting(false); }
  };

  const handleDecline = async () => {
    const reason = window.prompt('Why are you declining? (optional)');
    if (reason === null) return;
    try {
      await signingAPI.decline(token, reason);
      setDeclined(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'100vh', gap:16, fontFamily:'DM Sans,sans-serif' }}>
      <div style={{ width:40, height:40, border:'3px solid #e2e8f0', borderTopColor:'#1a1a2e', borderRadius:'50%', animation:'spin 0.7s linear infinite' }}/>
      <p style={{ color:'#64748b' }}>Loading document...</p>
    </div>
  );

  // ── Error ─────────────────────────────────────────────────────────────────
  if (error) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'100vh', gap:12, fontFamily:'DM Sans,sans-serif', padding:24 }}>
      <AlertTriangle size={48} color="#ef4444"/>
      <h2 style={{ fontSize:22, fontWeight:700 }}>Link Error</h2>
      <p style={{ color:'#64748b', textAlign:'center', maxWidth:380 }}>{error}</p>
    </div>
  );

  // ── Submitted ─────────────────────────────────────────────────────────────
  if (submitted) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'100vh', gap:16, fontFamily:'DM Sans,sans-serif', padding:24 }}>
      <div style={{ width:80, height:80, borderRadius:'50%', background:'#dcfce7', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <CheckCircle size={40} color="#22c55e"/>
      </div>
      <h2 style={{ fontSize:26, fontWeight:700 }}>Signed Successfully!</h2>
      <p style={{ color:'#64748b', textAlign:'center', maxWidth:400, lineHeight:1.6 }}>
        Your signature has been recorded. You'll receive a copy once all parties have signed.
      </p>
      <div style={{ background:'#f8fafc', borderRadius:12, padding:20, maxWidth:380, width:'100%', textAlign:'center' }}>
        <p style={{ fontSize:12, color:'#94a3b8' }}>Powered by eSign Platform • Legally Binding Electronic Signatures</p>
      </div>
    </div>
  );

  // ── Declined ──────────────────────────────────────────────────────────────
  if (declined) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'100vh', gap:16, fontFamily:'DM Sans,sans-serif', padding:24 }}>
      <div style={{ width:80, height:80, borderRadius:'50%', background:'#fee2e2', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <X size={40} color="#ef4444"/>
      </div>
      <h2 style={{ fontSize:26, fontWeight:700 }}>Document Declined</h2>
      <p style={{ color:'#64748b', textAlign:'center', maxWidth:400 }}>
        You have declined to sign this document. The sender has been notified.
      </p>
    </div>
  );

  // ── Completed status ──────────────────────────────────────────────────────
  if (signingData?.status === 'completed') return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'100vh', gap:16, fontFamily:'DM Sans,sans-serif', padding:24 }}>
      <CheckCircle size={56} color="#22c55e"/>
      <h2 style={{ fontSize:26, fontWeight:700 }}>Document Completed</h2>
      <p style={{ color:'#64748b' }}>All parties have signed this document.</p>
    </div>
  );

  const { document: doc, signer, fields = [] } = signingData || {};
  const fileUrl = signingAPI.getFileUrl(token);
  const completedFields = fields.filter(f => fieldValues[f.id] || fieldValues[`${f.id}_data`]).length;

  return (
    <div style={{ display:'flex', height:'100vh', fontFamily:'DM Sans,sans-serif', overflow:'hidden' }}>
      {/* ── PDF Viewer ────────────────────────────────────────────────────── */}
      <div style={{ flex:1, background:'#374151', display:'flex', flexDirection:'column' }}>
        {/* Top bar */}
        <div style={{ background:'#1a1a2e', padding:'12px 20px', display:'flex', alignItems:'center', gap:12, flexShrink:0 }}>
          <div style={{ width:30, height:30, background:'#e94560', borderRadius:7, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Pen size={14} color="#fff"/>
          </div>
          <div>
            <p style={{ color:'#fff', fontWeight:700, fontSize:14 }}>{doc?.title}</p>
            <p style={{ color:'rgba(255,255,255,0.5)', fontSize:11 }}>Requested by {doc?.signers?.find(s=>true)?.name || 'Document Owner'}</p>
          </div>
        </div>

        {/* PDF iframe */}
        <iframe
          src={fileUrl}
          title="Document Preview"
          style={{ flex:1, border:'none', width:'100%' }}
        />
      </div>

      {/* ── Right Panel: Fields ───────────────────────────────────────────── */}
      <div style={{ width:360, background:'#fff', borderLeft:'1px solid #e2e8f0', display:'flex', flexDirection:'column', overflow:'hidden', flexShrink:0 }}>
        {/* Signer info */}
        <div style={{ padding:'16px 20px', borderBottom:'1px solid #e2e8f0', background:'#f8fafc' }}>
          <p style={{ fontSize:12, color:'#94a3b8', marginBottom:4, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em' }}>Signing as</p>
          <p style={{ fontWeight:700, fontSize:16 }}>{signer?.name}</p>
          <p style={{ fontSize:13, color:'#64748b' }}>{signer?.email}</p>
          <div style={{ marginTop:10, height:4, background:'#e2e8f0', borderRadius:99 }}>
            <div style={{ height:'100%', width:`${fields.length > 0 ? (completedFields/fields.length)*100 : 0}%`, background:'#1a1a2e', borderRadius:99, transition:'width 0.3s' }}/>
          </div>
          <p style={{ fontSize:11, color:'#94a3b8', marginTop:4 }}>{completedFields} of {fields.length} fields completed</p>
        </div>

        {/* Fields list */}
        <div style={{ flex:1, overflowY:'auto', padding:'16px 20px' }}>
          {fields.length === 0 && (
            <div style={{ textAlign:'center', padding:32, color:'#94a3b8' }}>
              <p style={{ fontSize:14 }}>No fields to fill in. Click Submit to sign.</p>
            </div>
          )}
          {fields.map((field, idx) => {
            const isDone = !!(fieldValues[field.id] || fieldValues[`${field.id}_data`]);
            const isSigType = ['signature','initials'].includes(field.type);

            return (
              <div key={field.id} style={{
                marginBottom:12, padding:14, borderRadius:10,
                border:`1.5px solid ${isDone ? '#22c55e' : field.required ? '#1a1a2e' : '#e2e8f0'}`,
                background: isDone ? '#f0fdf4' : '#fff',
                transition:'all 0.2s',
              }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                  <span style={{ fontSize:16 }}>{FIELD_ICONS[field.type] || '📝'}</span>
                  <span style={{ fontSize:13, fontWeight:700, flex:1 }}>
                    {field.label || field.type.charAt(0).toUpperCase() + field.type.slice(1)}
                    {field.required && <span style={{ color:'#ef4444', marginLeft:4 }}>*</span>}
                  </span>
                  <span style={{ fontSize:11, color:'#94a3b8' }}>Page {field.page}</span>
                  {isDone && <Check size={14} color="#22c55e"/>}
                </div>

                {/* Signature / Initials → button to open pad */}
                {isSigType && (
                  fieldValues[`${field.id}_data`] ? (
                    <div style={{ position:'relative' }}>
                      <img src={fieldValues[`${field.id}_data`]} alt="Signature"
                        style={{ maxHeight:60, maxWidth:'100%', objectFit:'contain', border:'1px solid #e2e8f0', borderRadius:6, background:'#fafbff' }}/>
                      <button onClick={()=>setSigPadField(field)}
                        style={{ position:'absolute', top:4, right:4, background:'#1a1a2e', border:'none', color:'#fff', fontSize:10, padding:'2px 8px', borderRadius:4, cursor:'pointer' }}>
                        Change
                      </button>
                    </div>
                  ) : (
                    <button onClick={()=>setSigPadField(field)}
                      style={{ width:'100%', padding:'12px', border:'2px dashed #1a1a2e', borderRadius:8, background:'transparent', cursor:'pointer', fontSize:14, fontWeight:600, color:'#1a1a2e', display:'flex', alignItems:'center', justifyContent:'center', gap:6, fontFamily:'Dancing Script, cursive', fontSize:18 }}>
                      <Pen size={16} strokeWidth={2}/> Click to {field.type === 'initials' ? 'add initials' : 'sign here'}
                    </button>
                  )
                )}

                {/* Text fields */}
                {['text','name','email','title','company'].includes(field.type) && (
                  <input
                    type={field.type === 'email' ? 'email' : 'text'}
                    placeholder={field.placeholder || `Enter ${field.type}`}
                    value={fieldValues[field.id] || ''}
                    onChange={e => handleFieldChange(field.id, e.target.value)}
                    style={{ width:'100%', padding:'8px 10px', border:'1.5px solid #e2e8f0', borderRadius:7, fontSize:13, outline:'none' }}
                  />
                )}

                {/* Date field */}
                {field.type === 'date' && (
                  <input
                    type="date"
                    value={fieldValues[field.id] ? fieldValues[field.id].split('/').reverse().join('-') : ''}
                    onChange={e => {
                      const d = new Date(e.target.value);
                      handleFieldChange(field.id, d.toLocaleDateString('en-US'));
                    }}
                    style={{ width:'100%', padding:'8px 10px', border:'1.5px solid #e2e8f0', borderRadius:7, fontSize:13, outline:'none' }}
                  />
                )}

                {/* Checkbox */}
                {field.type === 'checkbox' && (
                  <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer' }}>
                    <input type="checkbox"
                      checked={fieldValues[field.id] === 'true'}
                      onChange={e => handleFieldChange(field.id, String(e.target.checked))}
                      style={{ width:18, height:18, cursor:'pointer' }}
                    />
                    <span style={{ fontSize:13 }}>{field.label || 'I agree'}</span>
                  </label>
                )}
              </div>
            );
          })}
        </div>

        {/* Action buttons */}
        <div style={{ padding:'16px 20px', borderTop:'1px solid #e2e8f0', display:'flex', flexDirection:'column', gap:8, background:'#f8fafc' }}>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{ padding:'13px', borderRadius:10, border:'none', background:'#1a1a2e', color:'#fff', fontSize:15, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, transition:'all 0.15s', opacity:submitting?0.7:1 }}>
            {submitting
              ? <><div style={{ width:18,height:18,border:'2px solid rgba(255,255,255,0.3)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin 0.7s linear infinite' }}/> Submitting...</>
              : <><Check size={18}/> Submit & Sign</>
            }
          </button>
          <button
            onClick={handleDecline}
            style={{ padding:'10px', borderRadius:10, border:'1.5px solid #e2e8f0', background:'transparent', color:'#94a3b8', fontSize:13, cursor:'pointer', fontWeight:500 }}>
            Decline to Sign
          </button>
          <p style={{ fontSize:10, color:'#94a3b8', textAlign:'center', lineHeight:1.5 }}>
            By clicking Submit you agree that your electronic signature is legally binding
          </p>
        </div>
      </div>

      {/* ── Signature Pad Modal ───────────────────────────────────────────── */}
      {sigPadField && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:16 }}>
          <div style={{ background:'#fff', borderRadius:16, width:'100%', maxWidth:560, boxShadow:'0 25px 50px rgba(0,0,0,0.25)' }}>
            <div style={{ padding:'16px 20px', borderBottom:'1px solid #e2e8f0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <h3 style={{ fontSize:16, fontWeight:700 }}>
                {sigPadField.type === 'initials' ? 'Add Your Initials' : 'Add Your Signature'}
              </h3>
              <button onClick={()=>setSigPadField(null)} style={{ background:'none', border:'none', cursor:'pointer' }}>
                <X size={20} color="#64748b"/>
              </button>
            </div>
            <div style={{ padding:16 }}>
              <SignaturePad
                onSave={handleSignatureSave}
                onCancel={()=>setSigPadField(null)}
                initialData={fieldValues[`${sigPadField.id}_data`]}
              />
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}