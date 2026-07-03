"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { Code2, Plus, Terminal, Clipboard, Check, Calendar, FolderGit2, AlertTriangle } from 'lucide-react';

interface Project {
  _id: string;
  name: string;
  createdAt: string;
}

export default function ProjectsPage() {
  const router = useRouter();
  const { token, apiBaseUrl, isDemoMode, logout } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [copiedSnippetId, setCopiedSnippetId] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      router.push('/login');
      return;
    }

    fetchProjects();
  }, [token]);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      if (isDemoMode) {
        // Mock projects list
        setProjects([
          { _id: 'demo_proj_1', name: 'Alpha SaaS Frontend', createdAt: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString() },
          { _id: 'demo_proj_2', name: 'Beta Checkout Portal', createdAt: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString() }
        ]);
        setLoading(false);
        return;
      }

      const response = await fetch(`${apiBaseUrl}/api/projects`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok && data.status === 'success') {
        setProjects(data.data.projects);
      }
    } catch (err) {
      console.error('Failed to fetch projects', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    try {
      if (isDemoMode) {
        const mockNew: Project = {
          _id: `demo_proj_${Date.now()}`,
          name: newProjectName.trim(),
          createdAt: new Date().toISOString()
        };
        setProjects([...projects, mockNew]);
        setNewProjectName('');
        setShowModal(false);
        return;
      }

      const response = await fetch(`${apiBaseUrl}/api/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ name: newProjectName })
      });
      
      const data = await response.json();
      if (response.ok && data.status === 'success') {
        setProjects([...projects, data.data.project]);
        setNewProjectName('');
        setShowModal(false);
      }
    } catch (err) {
      console.error('Failed to create project', err);
    }
  };

  const copySnippet = (projId: string) => {
    const snippet = `<script 
  src="${apiBaseUrl}/sdk/analyzer.js" 
  data-project-id="${projId}" 
  data-env="production">
</script>`;
    
    navigator.clipboard.writeText(snippet);
    setCopiedSnippetId(projId);
    setTimeout(() => setCopiedSnippetId(null), 2000);
  };

  return (
    <div className="min-h-screen bg-dark-950 text-white p-8">
      {/* Top Navigation Bar */}
      <header className="max-w-6xl mx-auto flex items-center justify-between mb-12 border-b border-dark-800 pb-6">
        <div className="flex items-center gap-2">
          <Code2 className="w-8 h-8 text-emerald-400" />
          <h1 className="text-xl font-bold">Antigravity Console</h1>
        </div>
        <div className="flex items-center gap-4">
          {isDemoMode && (
            <span className="text-xs bg-amber-500/10 border border-amber-500/20 text-amber-400 px-3 py-1 rounded-full flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Demo Mode</span>
            </span>
          )}
          <button 
            onClick={logout} 
            className="text-sm text-dark-400 hover:text-rose-400 font-medium transition-colors"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-white">Workspaces</h2>
            <p className="text-sm text-dark-400 mt-1">Select a workspace to view performance audits and issues.</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-dark-950 font-bold rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Create Workspace</span>
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-44 bg-dark-900 border border-dark-800 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-20 bg-dark-900/40 border border-dark-800 rounded-2xl">
            <FolderGit2 className="w-12 h-12 text-dark-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-dark-200">No workspaces yet</h3>
            <p className="text-sm text-dark-400 mt-1 mb-6">Create a workspace to obtain the integration CDN code snippet.</p>
            <button
              onClick={() => setShowModal(true)}
              className="px-5 py-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 rounded-xl transition-all"
            >
              Add First Project
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {projects.map((proj) => (
              <div 
                key={proj._id}
                className="bg-dark-900 border border-dark-800 hover:border-dark-700 rounded-xl p-6 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <h3 className="text-lg font-bold text-dark-100">{proj.name}</h3>
                    <button
                      onClick={() => router.push(`/projects/${proj._id}`)}
                      className="text-xs text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 px-3 py-1.5 rounded-lg font-bold transition-all"
                    >
                      Open Dashboard
                    </button>
                  </div>
                  
                  <div className="flex items-center gap-1.5 text-xs text-dark-400 mt-2">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Created {new Date(proj.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* CDN Script Snippet box */}
                <div className="mt-6 bg-dark-950 rounded-lg p-3 border border-dark-800/40 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <Terminal className="w-4 h-4 text-emerald-400 shrink-0" />
                    <code className="text-xs font-mono text-dark-300 truncate select-all">
                      {`<script src="${apiBaseUrl}/sdk/analyzer.js" data-project-id="${proj._id}"></script>`}
                    </code>
                  </div>
                  <button
                    onClick={() => copySnippet(proj._id)}
                    className="p-1.5 hover:bg-dark-800 rounded text-dark-400 hover:text-emerald-400 shrink-0 transition-all"
                    title="Copy integration snippet"
                  >
                    {copiedSnippetId === proj._id ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Clipboard className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Creation Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 z-50">
          <div className="w-full max-w-md bg-dark-900 border border-dark-800 rounded-2xl p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2">Create Workspace</h3>
            <p className="text-sm text-dark-400 mb-6">Enter a title for your site or app workspace.</p>
            
            <form onSubmit={handleCreateProject} className="space-y-4">
              <input
                type="text"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="e.g. Acme Web Store"
                className="w-full px-4 py-3 bg-dark-950 border border-dark-800 focus:border-emerald-500 rounded-xl text-white outline-none placeholder-dark-500"
                required
                autoFocus
              />
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-dark-300 hover:bg-dark-800 rounded-lg text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-dark-950 font-bold rounded-lg text-sm transition-colors"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
