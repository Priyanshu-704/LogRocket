"use client";

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '../../../../../context/AuthContext';
import Sidebar from '../../../../../components/Sidebar';
import CodeSnippet from '../../../../../components/CodeSnippet';
import { ShieldAlert, AlertTriangle, AlertCircle, Info, Calendar, ArrowLeft, CheckCircle2, History, Globe, Cpu } from 'lucide-react';

interface Occurrence {
  url: string;
  userAgent: string;
  timestamp: string;
  location?: {
    line?: number;
    column?: number;
    selector?: string;
    outerHTML?: string;
    fileName?: string;
  };
  metadata?: any;
}

interface Issue {
  _id: string;
  category: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  resolved: boolean;
  firstOccurrence: string;
  lastOccurrence: string;
  occurrencesCount: number;
  location?: {
    line?: number;
    column?: number;
    selector?: string;
    outerHTML?: string;
    fileName?: string;
  };
  metadata?: any;
  aiSuggestion?: {
    explanation: string;
    fixCode?: string;
    referenceUrl?: string;
  };
  occurrencesHistory: Occurrence[];
}

export default function IssueDetails() {
  const router = useRouter();
  const { projectId, issueId } = useParams() as { projectId: string; issueId: string };
  const { token, apiBaseUrl, isDemoMode } = useAuth();

  const [project, setProject] = useState<{ name: string } | null>(null);
  const [issue, setIssue] = useState<Issue | null>(null);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    if (!token) {
      router.push('/login');
      return;
    }

    fetchIssueDetails();
  }, [token, projectId, issueId]);

  const fetchIssueDetails = async () => {
    setLoading(true);
    try {
      if (isDemoMode) {
        setProject({ name: 'Alpha SaaS Frontend' });
        
        // Mock detailed issue payload
        const mockIssue: Issue = {
          _id: issueId,
          category: 'security',
          type: 'unsafe-inner-html',
          severity: 'critical',
          title: 'Unsafe DOM Assignment',
          message: 'Assigned unescaped input to element.innerHTML.',
          resolved: false,
          firstOccurrence: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
          lastOccurrence: new Date(Date.now() - 120 * 1000).toISOString(),
          occurrencesCount: 14,
          location: {
            line: 42,
            column: 15,
            fileName: 'bundle.js',
            selector: 'div#modal-body',
            outerHTML: '<div id="modal-body" class="p-4"></div>'
          },
          aiSuggestion: {
            explanation: 'Directly assigning unescaped variables or user inputs to element.innerHTML creates a serious Cross-Site Scripting (XSS) injection risk. Malicious scripts can execute in the context of the user session.',
            fixCode: `// Bad Practice:\nelement.innerHTML = userProvidedInput;\n\n// Solution 1: Use textContent for plain text (automatically sanitizes)\nelement.textContent = userProvidedInput;\n\n// Solution 2: Use DOMPurify to sanitize HTML payloads if markup rendering is required\nimport DOMPurify from 'dompurify';\nelement.innerHTML = DOMPurify.sanitize(userProvidedInput);`,
            referenceUrl: 'https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html'
          },
          occurrencesHistory: [
            {
              url: 'https://demo-app.dev/landing',
              userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              timestamp: new Date(Date.now() - 120 * 1000).toISOString(),
              location: { line: 42, column: 15, fileName: 'bundle.js', selector: 'div#modal-body' }
            },
            {
              url: 'https://demo-app.dev/checkout',
              userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1',
              timestamp: new Date(Date.now() - 600 * 1000).toISOString(),
              location: { line: 42, column: 15, fileName: 'bundle.js', selector: 'div#modal-body' }
            }
          ]
        };
        setIssue(mockIssue);
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

      // Fetch specific issue details
      const issueResp = await fetch(`${apiBaseUrl}/api/issues/${projectId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const issueData = await issueResp.json();
      if (issueResp.ok && issueData.status === 'success') {
        const foundIssue = issueData.data.issues.find((i: any) => i._id === issueId);
        if (foundIssue) {
          setIssue(foundIssue);
        }
      }
    } catch (err) {
      console.error('Failed to query issue details', err);
    } finally {
      setLoading(false);
    }
  };

  const handleResolveIssue = async () => {
    if (isDemoMode) {
      if (issue) setIssue({ ...issue, resolved: true });
      return;
    }

    setResolving(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/issues/${projectId}/${issueId}/resolve`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await response.json();
      if (response.ok && data.status === 'success') {
        setIssue(data.data.issue);
      }
    } catch (err) {
      console.error('Failed to resolve issue', err);
    } finally {
      setResolving(false);
    }
  };

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

  if (loading) {
    return (
      <div className="flex h-screen bg-dark-950 text-white">
        <div className="w-64 bg-dark-900 border-r border-dark-800 animate-pulse" />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!issue) {
    return (
      <div className="flex h-screen bg-dark-950 text-white">
        <Sidebar projectId={projectId} projectName={project?.name} />
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <AlertCircle className="w-12 h-12 text-rose-500 mb-4" />
          <h3 className="text-lg font-semibold">Issue Not Found</h3>
          <button onClick={() => router.push(`/projects/${projectId}/issues`)} className="text-emerald-400 underline mt-2 text-sm">
            Back to logs
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-dark-950 text-white overflow-hidden">
      <Sidebar projectId={projectId} projectName={project?.name} />

      <main className="flex-1 overflow-y-auto p-8">
        {/* Back Link */}
        <button
          onClick={() => router.push(`/projects/${projectId}/issues`)}
          className="flex items-center gap-2 text-xs text-dark-400 hover:text-white transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Issues Log</span>
        </button>

        {/* Detailed Issue Header */}
        <header className="flex flex-col md:flex-row md:items-start justify-between gap-6 pb-6 border-b border-dark-800 mb-8">
          <div>
            <div className="flex items-center gap-2.5 mb-3 flex-wrap">
              {getSeverityBadge(issue.severity)}
              <span className="text-xs bg-dark-900 border border-dark-800 text-dark-300 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                {issue.category}
              </span>
              <span className="text-[11px] text-dark-400 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                <span>Last seen {new Date(issue.lastOccurrence).toLocaleString()}</span>
              </span>
            </div>

            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white leading-tight">
              {issue.title}
            </h1>
            <p className="mt-2 text-sm text-dark-300 font-mono bg-dark-950 p-3 rounded-lg border border-dark-800/40">
              {issue.message}
            </p>
          </div>

          {/* Resolve Control */}
          <div className="shrink-0">
            {issue.resolved ? (
              <span className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl font-bold text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <span>Resolved</span>
              </span>
            ) : (
              <button
                onClick={handleResolveIssue}
                disabled={resolving}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-dark-950 rounded-xl font-bold text-sm transition-all"
              >
                {resolving ? (
                  <div className="w-5 h-5 border-2 border-dark-950 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Resolve Issue</span>
                  </>
                )}
              </button>
            )}
          </div>
        </header>

        {/* AI suggestions container */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {/* AI Suggestion Card */}
            {issue.aiSuggestion ? (
              <section className="bg-gradient-to-br from-dark-900 to-emerald-950/10 border border-emerald-500/20 rounded-2xl p-6 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
                
                <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-emerald-400" />
                  <span>AI Refactoring Suggestion</span>
                </h3>
                
                <p className="text-sm text-dark-200 leading-relaxed">
                  {issue.aiSuggestion.explanation}
                </p>

                {issue.aiSuggestion.fixCode && (
                  <CodeSnippet code={issue.aiSuggestion.fixCode} language="javascript" />
                )}

                {issue.aiSuggestion.referenceUrl && (
                  <a
                    href={issue.aiSuggestion.referenceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block mt-4 text-xs font-bold text-emerald-400 hover:underline"
                  >
                    Read WCAG / MDN reference documentation &rarr;
                  </a>
                )}
              </section>
            ) : (
              <section className="bg-dark-900 border border-dark-800 rounded-2xl p-6 text-center">
                <p className="text-sm text-dark-400">Evaluating AI recommendation details in the background...</p>
              </section>
            )}

            {/* Location coordinates details */}
            {issue.location && (
              <section className="bg-dark-900 border border-dark-800 rounded-2xl p-6">
                <h3 className="text-md font-bold text-dark-100 mb-4">Origin Coordinates</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                  <div className="p-3 bg-dark-950 rounded-lg">
                    <p className="text-dark-500 font-medium">Source File</p>
                    <p className="font-semibold text-dark-200 truncate mt-1">{issue.location.fileName || 'global'}</p>
                  </div>
                  <div className="p-3 bg-dark-950 rounded-lg">
                    <p className="text-dark-500 font-medium">Line Number</p>
                    <p className="font-semibold text-dark-200 mt-1">{issue.location.line || '-'}</p>
                  </div>
                  <div className="p-3 bg-dark-950 rounded-lg">
                    <p className="text-dark-500 font-medium">Column Number</p>
                    <p className="font-semibold text-dark-200 mt-1">{issue.location.column || '-'}</p>
                  </div>
                  <div className="p-3 bg-dark-950 rounded-lg">
                    <p className="text-dark-500 font-medium">DOM Selector</p>
                    <p className="font-semibold text-dark-200 truncate mt-1" title={issue.location.selector}>
                      {issue.location.selector || 'none'}
                    </p>
                  </div>
                </div>

                {issue.location.outerHTML && (
                  <div className="mt-4">
                    <p className="text-xs text-dark-400 mb-2">Target outerHTML DOM Tag</p>
                    <CodeSnippet code={issue.location.outerHTML} language="html" />
                  </div>
                )}
              </section>
            )}
          </div>

          {/* Occurrence checklist sidebar */}
          <div className="space-y-6">
            <section className="bg-dark-900 border border-dark-800 rounded-2xl p-5 shadow-lg">
              <h3 className="text-md font-bold text-white mb-4 flex items-center gap-2">
                <History className="w-5 h-5 text-emerald-400" />
                <span>Occurrences ({issue.occurrencesCount})</span>
              </h3>
              
              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                {issue.occurrencesHistory.map((occ, idx) => (
                  <div key={idx} className="p-3 bg-dark-950 border border-dark-800/40 rounded-lg space-y-2 text-xs">
                    <div className="flex items-center justify-between text-[10px] text-dark-500">
                      <span>Hit #{issue.occurrencesCount - idx}</span>
                      <span>{new Date(occ.timestamp).toLocaleTimeString()}</span>
                    </div>

                    <div className="flex items-start gap-1.5 text-dark-300">
                      <Globe className="w-3.5 h-3.5 text-dark-500 shrink-0 mt-0.5" />
                      <span className="break-all font-mono">{occ.url}</span>
                    </div>

                    <div className="text-[10px] text-dark-400 truncate" title={occ.userAgent}>
                      {occ.userAgent.includes('Chrome') ? 'Chrome / ' : 'Safari / '}
                      {occ.userAgent.includes('Macintosh') ? 'macOS' : 'Mobile Device'}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
