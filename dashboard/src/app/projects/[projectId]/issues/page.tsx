"use client";

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '../../../../context/AuthContext';
import { useSocket } from '../../../../context/SocketContext';
import Sidebar from '../../../../components/Sidebar';
import { Search, ShieldAlert, AlertTriangle, AlertCircle, Info, CheckCircle2, ChevronRight, Eye } from 'lucide-react';

interface Issue {
  _id: string;
  category: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  resolved: boolean;
  occurrencesCount: number;
  lastOccurrence: string;
  aiSuggestion?: {
    explanation: string;
    fixCode?: string;
    referenceUrl?: string;
  };
}

export default function IssuesLog() {
  const router = useRouter();
  const { projectId } = useParams() as { projectId: string };
  const { token, apiBaseUrl, isDemoMode } = useAuth();
  const { isConnected, registerListener } = useSocket();

  const [project, setProject] = useState<{ name: string } | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedSeverity, setSelectedSeverity] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('unresolved'); // unresolved, resolved, all

  useEffect(() => {
    if (!token) {
      router.push('/login');
      return;
    }

    fetchProjectAndIssues();
  }, [token, projectId]);

  // Listen to live issues updates
  useEffect(() => {
    if (!isConnected) return;

    const unregisterIssue = registerListener('issue:analyzed', (data: any) => {
      console.log('[Socket] Issue analyzed live update:', data);
      
      setIssues(prev => {
        const index = prev.findIndex(iss => iss._id === data.issueId);
        if (index !== -1) {
          // Update issue in-place
          const updated = [...prev];
          updated[index] = {
            ...updated[index],
            aiSuggestion: data.aiSuggestion,
            resolved: false, // Ensure marked unresolved if it occurs again
            occurrencesCount: updated[index].occurrencesCount + 1,
            lastOccurrence: new Date().toISOString()
          };
          return updated;
        } else {
          // Prepend new issue
          return [
            {
              _id: data.issueId,
              category: data.category || 'javascript',
              type: data.type || 'error',
              severity: data.severity || 'medium',
              title: data.title || 'Error',
              message: data.message || 'An error occurred',
              resolved: false,
              occurrencesCount: 1,
              lastOccurrence: new Date().toISOString()
            },
            ...prev
          ];
        }
      });
    });

    return () => {
      unregisterIssue();
    };
  }, [isConnected]);

  const fetchProjectAndIssues = async () => {
    setLoading(true);
    try {
      if (isDemoMode) {
        setProject({ name: 'Alpha SaaS Frontend' });
        setIssues([
          {
            _id: 'iss_contrast',
            category: 'accessibility',
            type: 'poor-contrast',
            severity: 'high',
            title: 'Poor contrast ratio',
            message: 'Background color white fails minimum contrast check on grey text.',
            resolved: false,
            occurrencesCount: 12,
            lastOccurrence: new Date(Date.now() - 600 * 1000).toISOString()
          },
          {
            _id: 'iss_secret',
            category: 'security',
            type: 'exposed-secret',
            severity: 'critical',
            title: 'AWS Credentials Leak',
            message: 'Hardcoded secret token string AKIAIOSFODNN7EXAMPLE detected.',
            resolved: false,
            occurrencesCount: 1,
            lastOccurrence: new Date(Date.now() - 2 * 3600 * 1000).toISOString()
          },
          {
            _id: 'iss_unsafe',
            category: 'security',
            type: 'unsafe-inner-html',
            severity: 'critical',
            title: 'Unsafe DOM Assignment',
            message: 'Assigned unescaped input to element.innerHTML.',
            resolved: false,
            occurrencesCount: 45,
            lastOccurrence: new Date(Date.now() - 50 * 1000).toISOString()
          },
          {
            _id: 'iss_nested',
            category: 'code-quality',
            type: 'callback-hell',
            severity: 'medium',
            title: 'Deep nested scopes',
            message: 'Identified 5 nested levels of callback scopes in script.js.',
            resolved: true,
            occurrencesCount: 2,
            lastOccurrence: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString()
          }
        ]);
        setLoading(false);
        return;
      }

      // Fetch project details
      const projResp = await fetch(`${apiBaseUrl}/api/projects`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const projData = await projResp.json();
      if (projResp.ok && projData.status === 'success') {
        const found = projData.data.projects.find((p: any) => p._id === projectId);
        if (found) setProject(found);
      }

      // Fetch issues list
      const issueResp = await fetch(`${apiBaseUrl}/api/issues/${projectId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const issueData = await issueResp.json();
      if (issueResp.ok && issueData.status === 'success') {
        setIssues(issueData.data.issues);
      }
    } catch (err) {
      console.error('Failed to query project issues', err);
    } finally {
      setLoading(false);
    }
  };

  // Filtering Logic
  const filteredIssues = issues.filter(iss => {
    // Search filter
    const matchesSearch = iss.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          iss.message.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Category filter
    const matchesCategory = selectedCategory === 'all' || iss.category === selectedCategory;

    // Severity filter
    const matchesSeverity = selectedSeverity === 'all' || iss.severity === selectedSeverity;

    // Status filter
    const matchesStatus = selectedStatus === 'all' ||
                          (selectedStatus === 'resolved' && iss.resolved) ||
                          (selectedStatus === 'unresolved' && !iss.resolved);

    return matchesSearch && matchesCategory && matchesSeverity && matchesStatus;
  });

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'critical':
        return <span className="bg-rose-500/10 border border-rose-500/20 text-rose-500 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1"><ShieldAlert className="w-3 h-3" />Critical</span>;
      case 'high':
        return <span className="bg-amber-500/10 border border-amber-500/20 text-amber-500 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1"><AlertTriangle className="w-3 h-3" />High</span>;
      case 'medium':
        return <span className="bg-blue-500/10 border border-blue-500/20 text-blue-400 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1"><AlertCircle className="w-3 h-3" />Medium</span>;
      default:
        return <span className="bg-dark-800 border border-dark-700 text-dark-300 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1"><Info className="w-3 h-3" />Low</span>;
    }
  };

  const categories = ['all', 'javascript', 'css', 'dom', 'accessibility', 'seo', 'security', 'code-quality', 'performance'];

  return (
    <div className="flex h-screen bg-dark-950 text-white overflow-hidden">
      <Sidebar projectId={projectId} projectName={project?.name} />

      <main className="flex-1 overflow-y-auto p-8">
        <header className="flex flex-col md:flex-row md:items-center justify-between mb-8 pb-6 border-b border-dark-800 gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Issues Log</h1>
            <p className="text-sm text-dark-400 mt-1">Audit diagnostics resolved by category and origin.</p>
          </div>

          {/* Search box */}
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-3 w-4 h-4 text-dark-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search title, message..."
              className="w-full pl-10 pr-4 py-2.5 bg-dark-900 border border-dark-800 focus:border-emerald-500 rounded-xl text-sm text-white placeholder-dark-500 outline-none"
            />
          </div>
        </header>

        {/* Filter controls */}
        <section className="bg-dark-900/60 border border-dark-800 rounded-2xl p-5 mb-8">
          <div className="flex flex-wrap items-center gap-6 justify-between">
            {/* Severity and Status Toggles */}
            <div className="flex items-center gap-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-dark-400 mb-1.5">Severity</label>
                <select
                  value={selectedSeverity}
                  onChange={(e) => setSelectedSeverity(e.target.value)}
                  className="bg-dark-950 border border-dark-800 rounded-lg px-3 py-1.5 text-xs text-dark-200 outline-none"
                >
                  <option value="all">All Severities</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-dark-400 mb-1.5">Status</label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="bg-dark-950 border border-dark-800 rounded-lg px-3 py-1.5 text-xs text-dark-200 outline-none"
                >
                  <option value="unresolved">Unresolved Only</option>
                  <option value="resolved">Resolved Only</option>
                  <option value="all">All Issues</option>
                </select>
              </div>
            </div>

            {/* Category tabs list */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-dark-400 mb-1.5">Category</label>
              <div className="flex flex-wrap gap-1.5">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                      selectedCategory === cat
                        ? 'bg-emerald-500 text-dark-950'
                        : 'bg-dark-950 text-dark-300 border border-dark-800 hover:text-white'
                    }`}
                  >
                    {cat === 'all' ? 'All Categories' : cat.replace('-', ' ')}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Issues List Grid */}
        <section className="bg-dark-900 border border-dark-800 rounded-2xl overflow-hidden shadow-xl">
          {filteredIssues.length === 0 ? (
            <div className="text-center py-20">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4 animate-bounce" />
              <h3 className="text-lg font-semibold text-dark-200">No issues found</h3>
              <p className="text-sm text-dark-400 mt-1">Excellent! All checks conform with your filter layout.</p>
            </div>
          ) : (
            <div className="divide-y divide-dark-800">
              {filteredIssues.map((iss) => (
                <div 
                  key={iss._id}
                  onClick={() => router.push(`/projects/${projectId}/issues/${iss._id}`)}
                  className="p-5 hover:bg-dark-950/40 transition-all flex items-center justify-between gap-6 cursor-pointer group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      {getSeverityBadge(iss.severity)}
                      <span className="text-[10px] bg-dark-950 text-dark-400 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                        {iss.category}
                      </span>
                      {iss.resolved && (
                        <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded font-bold uppercase tracking-wide">
                          Resolved
                        </span>
                      )}
                      <span className="text-[11px] text-dark-500">
                        Occurred {iss.occurrencesCount} times • Last seen {new Date(iss.lastOccurrence).toLocaleTimeString()}
                      </span>
                    </div>

                    <h4 className="font-bold text-dark-100 group-hover:text-emerald-400 transition-colors mt-2 text-base truncate">
                      {iss.title}
                    </h4>
                    <p className="text-xs text-dark-400 mt-1 truncate max-w-2xl font-mono">
                      {iss.message}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button className="p-2 bg-dark-950 group-hover:bg-emerald-500/10 text-dark-400 group-hover:text-emerald-400 border border-dark-800 group-hover:border-emerald-500/20 rounded-lg transition-all">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
