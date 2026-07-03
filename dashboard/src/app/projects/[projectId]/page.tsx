"use client";

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '../../../context/AuthContext';
import { useSocket } from '../../../context/SocketContext';
import Sidebar from '../../../components/Sidebar';
import VitalsCard from '../../../components/VitalsCard';
import { ShieldAlert, Activity, Wifi, WifiOff, FileCode, CheckCircle, BarChart3, AlertCircle } from 'lucide-react';

interface Project {
  _id: string;
  name: string;
  webhookUrl?: string;
}

interface Issue {
  _id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  resolved: boolean;
}

export default function ProjectDashboard() {
  const router = useRouter();
  const { projectId } = useParams() as { projectId: string };
  const { token, apiBaseUrl, isDemoMode } = useAuth();
  const { isConnected, emitEvent, registerListener } = useSocket();

  const [project, setProject] = useState<Project | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);

  // Web Vitals initial states
  const [vitals, setVitals] = useState({
    fcp: 1200,
    lcp: 2100,
    cls: 0.05,
    fid: 24
  });

  const [latestReportTime, setLatestReportTime] = useState<Date | null>(null);

  useEffect(() => {
    if (!token) {
      router.push('/login');
      return;
    }

    fetchProjectData();
  }, [token, projectId]);

  // Handle Socket.IO connection and join project rooms
  useEffect(() => {
    if (!isConnected) return;

    // Join room
    emitEvent('join-project', projectId);

    // Register live listeners
    const unregisterReport = registerListener('report:received', (data: any) => {
      console.log('[Live] New Report Received:', data);
      setLatestReportTime(new Date());
      if (data.metrics) {
        setVitals({
          fcp: data.metrics.fcp || vitals.fcp,
          lcp: data.metrics.lcp || vitals.lcp,
          cls: typeof data.metrics.cls === 'number' ? data.metrics.cls : vitals.cls,
          fid: data.metrics.fid || vitals.fid
        });
      }
    });

    const unregisterIssue = registerListener('issue:analyzed', (newIssue: any) => {
      console.log('[Live] New Issue Analyzed:', newIssue);
      setIssues(prev => {
        // Prevent duplicate updates
        const exists = prev.find(item => item._id === newIssue.issueId);
        if (exists) return prev;
        return [
          {
            _id: newIssue.issueId,
            severity: newIssue.severity,
            resolved: false
          },
          ...prev
        ];
      });
    });

    return () => {
      unregisterReport();
      unregisterIssue();
    };
  }, [isConnected, projectId]);

  const fetchProjectData = async () => {
    setLoading(true);
    try {
      if (isDemoMode) {
        setProject({ _id: projectId, name: 'Alpha SaaS Frontend', webhookUrl: '' });
        setIssues([
          { _id: '1', severity: 'critical', resolved: false },
          { _id: '2', severity: 'high', resolved: false },
          { _id: '3', severity: 'medium', resolved: false },
          { _id: '4', severity: 'low', resolved: true }
        ]);
        setVitals({ fcp: 1450, lcp: 2800, cls: 0.12, fid: 45 });
        setLoading(false);
        return;
      }

      // Fetch Project meta
      const projResp = await fetch(`${apiBaseUrl}/api/projects`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const projData = await projResp.json();
      if (projResp.ok && projData.status === 'success') {
        const found = projData.data.projects.find((p: any) => p._id === projectId);
        if (found) {
          setProject(found);
        }
      }

      // Fetch Issues lists
      const issueResp = await fetch(`${apiBaseUrl}/api/issues/${projectId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const issueData = await issueResp.json();
      if (issueResp.ok && issueData.status === 'success') {
        setIssues(issueData.data.issues);
      }
    } catch (err) {
      console.error('Failed to resolve dashboard payloads', err);
    } finally {
      setLoading(false);
    }
  };

  const getUnresolvedCount = (sev?: string) => {
    return issues.filter(iss => {
      const matchSev = sev ? iss.severity === sev : true;
      return matchSev && !iss.resolved;
    }).length;
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

  return (
    <div className="flex h-screen bg-dark-950 text-white overflow-hidden">
      <Sidebar projectId={projectId} projectName={project?.name} />

      <main className="flex-1 overflow-y-auto p-8">
        {/* Dashboard Header */}
        <header className="flex items-center justify-between mb-8 pb-6 border-b border-dark-800">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Overview</h1>
            <p className="text-sm text-dark-400 mt-1">Real-time vitals and issue stats.</p>
          </div>
          
          {/* Real-time Status Badge */}
          <div className="flex items-center gap-2 px-3.5 py-2 bg-dark-900 border border-dark-800 rounded-xl">
            {isConnected ? (
              <>
                <Wifi className="w-4 h-4 text-emerald-400 animate-pulse" />
                <span className="text-xs text-dark-200 font-semibold">Live Socket Connected</span>
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4 text-rose-500" />
                <span className="text-xs text-dark-400 font-semibold">Offline (Reconnecting...)</span>
              </>
            )}
          </div>
        </header>

        {/* Live Event Warning Banner */}
        {latestReportTime && (
          <div className="mb-8 p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
            <span>Telemetry data updated live at {latestReportTime.toLocaleTimeString()}</span>
          </div>
        )}

        {/* Web Vitals Section */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-dark-100 mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-400" />
            <span>Google Core Web Vitals (Telemetry)</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <VitalsCard name="FCP" value={vitals.fcp} />
            <VitalsCard name="LCP" value={vitals.lcp} />
            <VitalsCard name="CLS" value={vitals.cls} />
            <VitalsCard name="FID" value={vitals.fid} />
          </div>
        </section>

        {/* Summary Stats & Issues Counts */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Critical Severity Card */}
          <div className="bg-rose-950/20 border border-rose-900/30 rounded-xl p-6 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-rose-400">Critical Audits</span>
              <p className="text-3xl font-extrabold text-white mt-2">{getUnresolvedCount('critical')}</p>
            </div>
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl">
              <ShieldAlert className="w-6 h-6 text-rose-500" />
            </div>
          </div>

          {/* High Severity Card */}
          <div className="bg-amber-950/20 border border-amber-900/30 rounded-xl p-6 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400">High Severity</span>
              <p className="text-3xl font-extrabold text-white mt-2">{getUnresolvedCount('high')}</p>
            </div>
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
              <AlertCircle className="w-6 h-6 text-amber-500" />
            </div>
          </div>

          {/* Total Unresolved Card */}
          <div className="bg-emerald-950/10 border border-emerald-900/20 rounded-xl p-6 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Total Unresolved</span>
              <p className="text-3xl font-extrabold text-white mt-2">{getUnresolvedCount()}</p>
            </div>
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
              <CheckCircle className="w-6 h-6 text-emerald-500" />
            </div>
          </div>
        </section>

        {/* Audit Guidance Code Snippet */}
        <section className="bg-dark-900 border border-dark-800 rounded-xl p-6">
          <h3 className="text-lg font-bold text-dark-100 mb-2">SDK Integration Setup</h3>
          <p className="text-sm text-dark-400 mb-4">Include the script below in your application HTML template to audit runtime crashes, accessibility, performance, and custom events.</p>
          <div className="p-4 bg-dark-950 border border-dark-800 rounded-lg flex items-center justify-between">
            <code className="text-xs font-mono text-dark-300 break-all select-all">
              {`<script src="${apiBaseUrl}/sdk/analyzer.js" data-project-id="${projectId}"></script>`}
            </code>
          </div>
        </section>
      </main>
    </div>
  );
}
