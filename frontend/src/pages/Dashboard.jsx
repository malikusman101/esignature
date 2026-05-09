/**
 * DASHBOARD PAGE
 *
 * Shows:
 *  - Welcome greeting + quick actions
 *  - Stat cards (total, pending, completed, declined)
 *  - Recent documents table
 */

import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FileText, Clock, CheckCircle, XCircle, Plus, ArrowRight, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import Sidebar from '../components/sidebar';
import { documentsAPI } from '../services/api';
import useAuthStore from '../store/authStore';

const StatusBadge = ({ status }) => (
  <span className={`badge badge-${status}`}>{status.replace('_', ' ')}</span>
);

export default function DashboardPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [recentDocs, setRecentDocs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [statsRes, docsRes] = await Promise.all([
          documentsAPI.getStats(),
          documentsAPI.getAll({ limit: 5, sortBy: 'createdAt', sortOrder: 'DESC' }),
        ]);
        setStats(statsRes.data.data.stats);
        setRecentDocs(docsRes.data.data.documents);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const STAT_CARDS = stats
    ? [
        { label: 'Total Documents', value: stats.total,     icon: FileText,    color: '#3b82f6', bg: '#eff6ff' },
        { label: 'Awaiting Signature', value: stats.pending, icon: Clock,      color: '#f59e0b', bg: '#fffbeb' },
        { label: 'Completed',        value: stats.completed, icon: CheckCircle, color: '#22c55e', bg: '#f0fdf4' },
        { label: 'Declined',         value: stats.declined,  icon: XCircle,    color: '#ef4444', bg: '#fef2f2' },
      ]
    : [];

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page">
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
            <div>
              <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>
                Good {getGreeting()}, {user?.firstName} 👋
              </h1>
              <p style={{ color: 'var(--text-2)', fontSize: 15 }}>
                Here's what's happening with your documents today.
              </p>
            </div>
            <Link to="/documents/new" className="btn btn-primary">
              <Plus size={16} /> New Document
            </Link>
          </div>

          {/* Stat cards */}
          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 32 }}>
              {[1,2,3,4].map(i => (
                <div key={i} style={{ height: 110, borderRadius: 14, background: '#e2e8f0', animation: 'pulse 1.5s infinite' }} />
              ))}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 16, marginBottom: 32 }}>
              {STAT_CARDS.map(({ label, value, icon: Icon, color, bg }) => (
                <div key={label} className="card" style={{ padding: '20px 24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <p style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 600, marginBottom: 8 }}>{label}</p>
                      <p style={{ fontSize: 36, fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>{value}</p>
                    </div>
                    <div style={{ width: 44, height: 44, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon size={20} color={color} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Quick actions */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginBottom: 32 }}>
            {/* Recent documents */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ fontSize: 16, fontWeight: 700 }}>Recent Documents</h2>
                <Link to="/documents" style={{ fontSize: 13, color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  View all <ArrowRight size={14} />
                </Link>
              </div>

              {loading ? (
                <div style={{ padding: 24 }}>
                  {[1,2,3].map(i => (
                    <div key={i} style={{ height: 48, borderRadius: 8, background: '#e2e8f0', marginBottom: 12 }} />
                  ))}
                </div>
              ) : recentDocs.length === 0 ? (
                <div style={{ padding: 48, textAlign: 'center' }}>
                  <FileText size={40} color="var(--text-3)" style={{ margin: '0 auto 12px' }} />
                  <p style={{ color: 'var(--text-2)', marginBottom: 16 }}>No documents yet</p>
                  <Link to="/documents/new" className="btn btn-primary btn-sm">Upload your first document</Link>
                </div>
              ) : (
                <div>
                  {recentDocs.map((doc) => (
                    <div key={doc.id}
                      onClick={() => navigate(`/documents/${doc.id}`)}
                      style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 24px', borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.12s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <FileText size={16} color="#3b82f6" />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.title}</p>
                        <p style={{ fontSize: 12, color: 'var(--text-3)' }}>{format(new Date(doc.createdAt), 'MMM d, yyyy')}</p>
                      </div>
                      <StatusBadge status={doc.status} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick tips */}
            <div className="card">
              <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Quick Actions</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { label: 'Upload a document', icon: FileText, to: '/documents/new' },
                  { label: 'View all documents', icon: TrendingUp, to: '/documents' },
                  { label: 'Edit your signature', icon: FileText, to: '/profile' },
                ].map(({ label, icon: Icon, to }) => (
                  <Link key={label} to={to}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, background: 'var(--surface-2)', fontSize: 14, fontWeight: 500, color: 'var(--text)', transition: 'all 0.12s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--border)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'var(--surface-2)'}
                  >
                    <Icon size={15} color="var(--text-2)" /> {label}
                    <ArrowRight size={14} color="var(--text-3)" style={{ marginLeft: 'auto' }} />
                  </Link>
                ))}
              </div>

              {/* Usage meter */}
              {user && (
                <div style={{ marginTop: 24, padding: '16px', background: 'var(--surface-2)', borderRadius: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>Documents Used</span>
                    <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{user.documentsUsed}/{user.documentsLimit}</span>
                  </div>
                  <div style={{ height: 6, background: 'var(--border)', borderRadius: 99 }}>
                    <div style={{
                      height: '100%',
                      width: `${Math.min(100, (user.documentsUsed / user.documentsLimit) * 100)}%`,
                      background: user.documentsUsed >= user.documentsLimit ? 'var(--error)' : 'var(--primary)',
                      borderRadius: 99,
                      transition: 'width 0.5s ease',
                    }} />
                  </div>
                  {user.plan === 'free' && (
                    <p style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 8 }}>
                      <Link to="/profile" style={{ fontWeight: 600, color: 'var(--primary)' }}>Upgrade to Pro</Link> for unlimited documents
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}