import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FileText, Plus, Search, Filter, Download, Trash2, Send, Bell, Eye } from 'lucide-react';
import { format } from 'date-fns';
import Sidebar from '../components/sidebar';
import { documentsAPI } from '../services/api';
import toast from 'react-hot-toast';

const STATUS_OPTIONS = ['all','draft','pending','in_progress','completed','declined','voided'];

const StatusBadge = ({ status }) => (
  <span className={`badge badge-${status}`}>{status.replace('_',' ')}</span>
);

export default function DocumentsPage() {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [actionLoading, setActionLoading] = useState({});

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await documentsAPI.getAll({ search, status, page, limit: 10 });
      setDocuments(data.data.documents);
      setPagination(data.data.pagination);
    } catch { toast.error('Failed to load documents'); }
    finally { setLoading(false); }
  }, [search, status, page]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  // Debounce search
  const [searchInput, setSearchInput] = useState('');
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const handleDownload = async (doc, e) => {
    e.stopPropagation();
    try {
      setActionLoading(p => ({ ...p, [doc.id+'dl']: true }));
      const { data } = await documentsAPI.download(doc.id);
      const url = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }));
      const a = document.createElement('a'); a.href = url;
      a.download = `${doc.title}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error('Download failed'); }
    finally { setActionLoading(p => ({ ...p, [doc.id+'dl']: false })); }
  };

  const handleRemind = async (doc, e) => {
    e.stopPropagation();
    try {
      setActionLoading(p => ({ ...p, [doc.id+'rm']: true }));
      await documentsAPI.remind(doc.id);
      toast.success('Reminder sent!');
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setActionLoading(p => ({ ...p, [doc.id+'rm']: false })); }
  };

  const handleVoid = async (doc, e) => {
    e.stopPropagation();
    if (!window.confirm(`Void "${doc.title}"? This cannot be undone.`)) return;
    try {
      setActionLoading(p => ({ ...p, [doc.id+'vd']: true }));
      await documentsAPI.void(doc.id, 'Voided by owner');
      toast.success('Document voided');
      fetchDocs();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setActionLoading(p => ({ ...p, [doc.id+'vd']: false })); }
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page">
          {/* Header */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:28 }}>
            <div>
              <h1 style={{ fontSize:26, fontWeight:700, marginBottom:4 }}>Documents</h1>
              <p style={{ color:'var(--text-2)', fontSize:14 }}>{pagination.total} total documents</p>
            </div>
            <Link to="/documents/new" className="btn btn-primary"><Plus size={16}/> New Document</Link>
          </div>

          {/* Filters bar */}
          <div style={{ display:'flex', gap:12, marginBottom:20, flexWrap:'wrap' }}>
            <div style={{ position:'relative', flex:1, minWidth:200 }}>
              <Search size={15} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'var(--text-3)' }}/>
              <input className="form-input" style={{ paddingLeft:36 }} placeholder="Search documents..."
                value={searchInput} onChange={e => setSearchInput(e.target.value)} />
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <Filter size={15} color="var(--text-3)"/>
              <select className="form-input" style={{ width:'auto', cursor:'pointer' }}
                value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
                {STATUS_OPTIONS.map(s => (
                  <option key={s} value={s}>{s === 'all' ? 'All Status' : s.replace('_',' ')}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="card" style={{ padding:0, overflow:'hidden' }}>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Document</th>
                    <th>Status</th>
                    <th>Signers</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array(5).fill(0).map((_,i) => (
                      <tr key={i}><td colSpan={5}><div style={{ height:20, background:'#e2e8f0', borderRadius:4, animation:'pulse 1.5s infinite' }}/></td></tr>
                    ))
                  ) : documents.length === 0 ? (
                    <tr><td colSpan={5} style={{ textAlign:'center', padding:48, color:'var(--text-3)' }}>
                      <FileText size={36} style={{ margin:'0 auto 12px', color:'var(--text-3)' }}/>
                      <p>No documents found</p>
                    </td></tr>
                  ) : documents.map(doc => (
                    <tr key={doc.id} style={{ cursor:'pointer' }}
                      onClick={() => navigate(`/documents/${doc.id}`)}>
                      <td>
                        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                          <div style={{ width:34, height:34, borderRadius:8, background:'#eff6ff', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                            <FileText size={15} color="#3b82f6"/>
                          </div>
                          <div>
                            <p style={{ fontWeight:600, fontSize:14, marginBottom:2 }}>{doc.title}</p>
                            <p style={{ fontSize:12, color:'var(--text-3)' }}>
                              {(doc.fileSize/1024).toFixed(0)} KB
                            </p>
                          </div>
                        </div>
                      </td>
                      <td><StatusBadge status={doc.status}/></td>
                      <td>
                        <div style={{ display:'flex', gap:-4 }}>
                          {(doc.signers||[]).slice(0,4).map((s,i) => (
                            <div key={s.id} title={`${s.name} (${s.status})`}
                              style={{ width:26, height:26, borderRadius:'50%', background:s.color||'#3b82f6', border:'2px solid #fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, color:'#fff', marginLeft: i>0 ? -6 : 0, zIndex:10-i }}>
                              {s.name[0].toUpperCase()}
                            </div>
                          ))}
                          {(doc.signers||[]).length > 4 && (
                            <div style={{ width:26, height:26, borderRadius:'50%', background:'#e2e8f0', border:'2px solid #fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, color:'var(--text-2)', marginLeft:-6 }}>
                              +{doc.signers.length-4}
                            </div>
                          )}
                          {(doc.signers||[]).length === 0 && <span style={{ fontSize:13, color:'var(--text-3)' }}>—</span>}
                        </div>
                      </td>
                      <td style={{ fontSize:13, color:'var(--text-2)' }}>
                        {format(new Date(doc.createdAt), 'MMM d, yyyy')}
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        <div style={{ display:'flex', gap:4 }}>
                          <button className="btn btn-ghost btn-sm btn-icon" title="View"
                            onClick={() => navigate(`/documents/${doc.id}`)}>
                            <Eye size={14}/>
                          </button>
                          {['completed','in_progress'].includes(doc.status) && (
                            <button className="btn btn-ghost btn-sm btn-icon" title="Download"
                              onClick={e => handleDownload(doc, e)} disabled={actionLoading[doc.id+'dl']}>
                              <Download size={14}/>
                            </button>
                          )}
                          {['pending','in_progress'].includes(doc.status) && (
                            <button className="btn btn-ghost btn-sm btn-icon" title="Send Reminder"
                              onClick={e => handleRemind(doc, e)} disabled={actionLoading[doc.id+'rm']}>
                              <Bell size={14}/>
                            </button>
                          )}
                          {!['completed','voided','cancelled','declined'].includes(doc.status) && (
                            <button className="btn btn-ghost btn-sm btn-icon" title="Void" style={{ color:'var(--error)' }}
                              onClick={e => handleVoid(doc, e)} disabled={actionLoading[doc.id+'vd']}>
                              <Trash2 size={14}/>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div style={{ display:'flex', justifyContent:'center', alignItems:'center', gap:8, padding:'16px 24px', borderTop:'1px solid var(--border)' }}>
                <button className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => setPage(p => p-1)}>Previous</button>
                <span style={{ fontSize:13, color:'var(--text-2)' }}>Page {page} of {pagination.pages}</span>
                <button className="btn btn-outline btn-sm" disabled={page >= pagination.pages} onClick={() => setPage(p => p+1)}>Next</button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}