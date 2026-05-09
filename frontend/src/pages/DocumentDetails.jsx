import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Download, Bell, XCircle, FileText, Clock, CheckCircle, ChevronDown, ChevronUp, Shield } from 'lucide-react';
import Sidebar from '../components/sidebar';
import { documentsAPI } from '../services/api';
import toast from 'react-hot-toast';

const StatusBadge = ({ status }) => (
  <span className={`badge badge-${status}`} style={{ fontSize:13, padding:'5px 14px' }}>{status.replace('_',' ')}</span>
);

const SignerRow = ({ signer }) => {
  const statusIcon = { signed:'✅', pending:'⏳', viewed:'👁️', declined:'❌' };
  return (
    <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', borderRadius:10, background:'var(--surface-2)', marginBottom:8 }}>
      <div style={{ width:36, height:36, borderRadius:'50%', background:signer.color||'#3b82f6', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:700, fontSize:14, flexShrink:0 }}>
        {signer.name[0]?.toUpperCase()}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <p style={{ fontWeight:600, fontSize:14, marginBottom:2 }}>{signer.name}</p>
        <p style={{ fontSize:12, color:'var(--text-2)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{signer.email}</p>
      </div>
      <div style={{ textAlign:'right', flexShrink:0 }}>
        <div style={{ fontSize:16, marginBottom:2 }}>{statusIcon[signer.status] || '⏳'}</div>
        <span className={`badge badge-${signer.status}`}>{signer.status}</span>
      </div>
      {signer.signedAt && (
        <div style={{ fontSize:11, color:'var(--text-3)', textAlign:'right', flexShrink:0 }}>
          {format(new Date(signer.signedAt), 'MMM d, HH:mm')}
        </div>
      )}
    </div>
  );
};

const AuditEntry = ({ log }) => {
  const icons = {
    document_created:'📝', document_sent:'📨', document_viewed:'👁️', document_signed:'✍️',
    document_declined:'❌', document_completed:'✅', document_voided:'🚫', document_downloaded:'📥',
    field_filled:'🏷️', reminder_sent:'🔔',
  };
  return (
    <div style={{ display:'flex', gap:12, padding:'10px 0', borderBottom:'1px solid var(--border)' }}>
      <span style={{ fontSize:18, flexShrink:0 }}>{icons[log.action] || '📋'}</span>
      <div style={{ flex:1, minWidth:0 }}>
        <p style={{ fontSize:13, fontWeight:600, marginBottom:2 }}>{log.action.replace(/_/g,' ')}</p>
        {log.description && <p style={{ fontSize:12, color:'var(--text-2)' }}>{log.description}</p>}
        {log.ipAddress && <p style={{ fontSize:11, color:'var(--text-3)' }}>IP: {log.ipAddress}</p>}
      </div>
      <p style={{ fontSize:11, color:'var(--text-3)', flexShrink:0 }}>{format(new Date(log.createdAt), 'MMM d, HH:mm')}</p>
    </div>
  );
};

export default function DocumentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});
  const [showAudit, setShowAudit] = useState(false);

  const load = async () => {
    try {
      const { data } = await documentsAPI.getOne(id);
      setDoc(data.data.document);
    } catch { toast.error('Document not found'); navigate('/documents'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  const withLoad = (key, fn) => async () => {
    setActionLoading(p => ({...p,[key]:true}));
    try { await fn(); } finally { setActionLoading(p => ({...p,[key]:false})); }
  };

  const handleDownload = withLoad('dl', async () => {
    const { data } = await documentsAPI.download(id);
    const url = URL.createObjectURL(new Blob([data],{type:'application/pdf'}));
    const a = document.createElement('a'); a.href=url; a.download=`${doc.title}.pdf`; a.click();
    URL.revokeObjectURL(url);
    toast.success('Downloaded!');
  });

  const handleDownloadAudit = withLoad('audit', async () => {
    const { data } = await documentsAPI.downloadAudit(id);
    const url = URL.createObjectURL(new Blob([data],{type:'application/pdf'}));
    const a = document.createElement('a'); a.href=url; a.download=`audit_${doc.title}.pdf`; a.click();
    URL.revokeObjectURL(url);
  });

  const handleRemind = withLoad('remind', async () => {
    await documentsAPI.remind(id);
    toast.success('Reminder sent to all pending signers');
  });

  const handleVoid = withLoad('void', async () => {
    const reason = window.prompt('Reason for voiding (optional):');
    if (reason === null) return;
    await documentsAPI.void(id, reason || 'Voided by owner');
    toast.success('Document voided');
    load();
  });

  if (loading) return (
    <div className="app-layout"><Sidebar/>
      <main className="main-content"><div className="page" style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'60vh' }}>
        <div className="spinner spinner-dark" style={{ width:32, height:32 }}/>
      </div></main>
    </div>
  );
  if (!doc) return null;

  const completionPct = doc.signers?.length > 0
    ? Math.round((doc.signers.filter(s=>s.status==='signed').length / doc.signers.length) * 100)
    : 0;

  return (
    <div className="app-layout">
      <Sidebar/>
      <main className="main-content">
        <div className="page">
          {/* Header */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:28, gap:16, flexWrap:'wrap' }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
                <h1 style={{ fontSize:24, fontWeight:700, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{doc.title}</h1>
                <StatusBadge status={doc.status}/>
              </div>
              {doc.description && <p style={{ color:'var(--text-2)', fontSize:14 }}>{doc.description}</p>}
              <p style={{ fontSize:12, color:'var(--text-3)', marginTop:4 }}>
                ID: {doc.id} • Uploaded {format(new Date(doc.createdAt), 'MMMM d, yyyy')}
                {doc.completedAt && ` • Completed ${format(new Date(doc.completedAt), 'MMMM d, yyyy')}`}
              </p>
            </div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', flexShrink:0 }}>
              {['completed','in_progress'].includes(doc.status) && (
                <button className="btn btn-outline btn-sm" onClick={handleDownload} disabled={actionLoading.dl}>
                  {actionLoading.dl ? <span className="spinner spinner-dark"/> : <Download size={14}/>} Download PDF
                </button>
              )}
              {doc.status === 'completed' && (
                <button className="btn btn-outline btn-sm" onClick={handleDownloadAudit} disabled={actionLoading.audit}>
                  <Shield size={14}/> Audit Trail
                </button>
              )}
              {['pending','in_progress'].includes(doc.status) && (
                <button className="btn btn-outline btn-sm" onClick={handleRemind} disabled={actionLoading.remind}>
                  {actionLoading.remind ? <span className="spinner spinner-dark"/> : <Bell size={14}/>} Remind
                </button>
              )}
              {!['completed','voided','cancelled','declined'].includes(doc.status) && (
                <button className="btn btn-danger btn-sm" onClick={handleVoid} disabled={actionLoading.void}>
                  <XCircle size={14}/> Void
                </button>
              )}
            </div>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 340px', gap:20 }}>
            {/* Left */}
            <div>
              {/* Progress */}
              {doc.signers?.length > 0 && (
                <div className="card" style={{ marginBottom:16 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                    <h2 style={{ fontSize:16, fontWeight:700 }}>Signing Progress</h2>
                    <span style={{ fontSize:20, fontWeight:800, color:'var(--primary)' }}>{completionPct}%</span>
                  </div>
                  <div style={{ height:8, background:'var(--border)', borderRadius:99, marginBottom:16, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${completionPct}%`, background:completionPct===100?'var(--success)':'var(--primary)', borderRadius:99, transition:'width 0.5s' }}/>
                  </div>
                  {doc.signers.map(s => <SignerRow key={s.id} signer={s}/>)}
                </div>
              )}

              {/* Message */}
              {doc.message && (
                <div className="card" style={{ marginBottom:16 }}>
                  <h2 style={{ fontSize:15, fontWeight:700, marginBottom:8 }}>Message to Signers</h2>
                  <p style={{ color:'var(--text-2)', fontSize:14, fontStyle:'italic', lineHeight:1.6 }}>"{doc.message}"</p>
                </div>
              )}

              {/* Audit trail toggle */}
              <div className="card" style={{ padding:0, overflow:'hidden' }}>
                <button onClick={()=>setShowAudit(!showAudit)}
                  style={{ display:'flex', justifyContent:'space-between', alignItems:'center', width:'100%', padding:'16px 20px', background:'none', border:'none', cursor:'pointer', fontSize:16, fontWeight:700 }}>
                  <span>🔍 Activity Log ({doc.auditLogs?.length || 0} events)</span>
                  {showAudit ? <ChevronUp size={18}/> : <ChevronDown size={18}/>}
                </button>
                {showAudit && (
                  <div style={{ padding:'0 20px 16px' }}>
                    {(doc.auditLogs||[]).length === 0
                      ? <p style={{ color:'var(--text-3)', fontSize:13 }}>No activity yet</p>
                      : (doc.auditLogs||[]).map(log => <AuditEntry key={log.id} log={log}/>)
                    }
                  </div>
                )}
              </div>
            </div>

            {/* Right sidebar */}
            <div>
              <div className="card" style={{ marginBottom:12 }}>
                <h3 style={{ fontSize:14, fontWeight:700, marginBottom:12 }}>Document Info</h3>
                {[
                  ['Status', <StatusBadge status={doc.status}/>],
                  ['File', doc.originalFilename],
                  ['Size', `${(doc.fileSize/1024).toFixed(0)} KB`],
                  ['Pages', doc.pageCount],
                  ['Created', format(new Date(doc.createdAt),'MMM d, yyyy')],
                  doc.expiresAt && ['Expires', format(new Date(doc.expiresAt),'MMM d, yyyy')],
                ].filter(Boolean).map(([k,v]) => (
                  <div key={k} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px solid var(--border)' }}>
                    <span style={{ fontSize:13, color:'var(--text-2)' }}>{k}</span>
                    <span style={{ fontSize:13, fontWeight:600 }}>{v}</span>
                  </div>
                ))}
              </div>

              {doc.status === 'draft' && (
                <div className="card" style={{ background:'#fffbeb', borderColor:'#fde68a' }}>
                  <p style={{ fontSize:13, color:'#92400e', fontWeight:600, marginBottom:6 }}>⚠️ Draft Document</p>
                  <p style={{ fontSize:12, color:'#92400e' }}>This document hasn't been sent yet. Go to Documents and click "Send" to add signers.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}