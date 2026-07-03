"use client";

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '../../../../context/AuthContext';
import Sidebar from '../../../../components/Sidebar';
import { Settings, Save, Key, RefreshCw, Check, Clipboard, AlertCircle } from 'lucide-react';

export default function ProjectSettings() {
  const router = useRouter();
  const { projectId } = useParams() as { projectId: string };
  const { token, apiBaseUrl, isDemoMode } = useAuth();

  const [project, setProject] = useState<{ name: string; webhookUrl?: string } | null>(null);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [apiKey, setApiKey] = useState('key_default_loading_placeholder');
  const [loading, setLoading] = useState(true);
  const [savingWebhook, setSavingWebhook] = useState(false);
  const [generatingKey, setGeneratingKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      router.push('/login');
      return;
    }

    fetchProjectAndKey();
  }, [token, projectId]);

  const fetchProjectAndKey = async () => {
    setLoading(true);
    try {
      if (isDemoMode) {
        setProject({ name: 'Alpha SaaS Frontend', webhookUrl: 'https://webhook.site/demo-endpoint' });
        setWebhookUrl('https://webhook.site/demo-endpoint');
        setApiKey('key_demo_secret_access_token_123456');
        setLoading(false);
        return;
      }

      // Fetch projects
      const projResp = await fetch(`${apiBaseUrl}/api/projects`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const projData = await projResp.json();
      if (projResp.ok && projData.status === 'success') {
        const found = projData.data.projects.find((p: any) => p._id === projectId);
        if (found) {
          setProject(found);
          setWebhookUrl(found.webhookUrl || '');
        }
      }

      // Fetch active API Key (masked)
      const keysResp = await fetch(`${apiBaseUrl}/api/projects/${projectId}/api-keys`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const keysData = await keysResp.json();
      if (keysResp.ok && keysData.status === 'success' && keysData.data.apiKeys?.length > 0) {
        setApiKey(keysData.data.apiKeys[0].maskedKey || keysData.data.apiKeys[0].key);
      } else {
        setApiKey('No active API key found. Please regenerate.');
      }
    } catch (err) {
      console.error('Failed to load project configuration details', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg(null);

    if (isDemoMode) {
      setProject(prev => prev ? { ...prev, webhookUrl } : null);
      setSuccessMsg('Settings updated successfully (Demo Mode).');
      return;
    }

    setSavingWebhook(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/projects/${projectId}/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ webhookUrl })
      });

      const data = await response.json();
      if (response.ok && data.status === 'success') {
        setProject(data.data.project);
        setSuccessMsg('Webhook endpoint URL registered successfully.');
      }
    } catch (err) {
      console.error('Failed to save webhook settings', err);
    } finally {
      setSavingWebhook(false);
    }
  };

  const handleRegenerateKey = async () => {
    if (!window.confirm('Are you sure you want to regenerate the API key? The old key will immediately stop working.')) {
      return;
    }

    setSuccessMsg(null);
    if (isDemoMode) {
      setApiKey(`key_regenerated_mock_${Math.random().toString(36).substring(2, 9)}`);
      setSuccessMsg('API key regenerated successfully.');
      return;
    }

    setGeneratingKey(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/projects/${projectId}/api-key`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ keyName: 'Default SDK Key' })
      });

      const data = await response.json();
      if (response.ok && data.status === 'success') {
        setApiKey(data.data.apiKey);
        setSuccessMsg('New API key generated and copied below.');
      }
    } catch (err) {
      console.error('Failed to generate key', err);
    } finally {
      setGeneratingKey(false);
    }
  };

  const copyApiKey = () => {
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
        <header className="pb-6 border-b border-dark-800 mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
            <Settings className="w-8 h-8 text-emerald-400" />
            <span>Settings</span>
          </h1>
          <p className="text-sm text-dark-400 mt-1">Configure workspace API access and outbound alert webhooks.</p>
        </header>

        {successMsg && (
          <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-3 text-sm text-emerald-400">
            <Check className="w-5 h-5 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <div className="max-w-2xl space-y-8">
          {/* Webhook Configuration Section */}
          <section className="bg-dark-900 border border-dark-800 rounded-2xl p-6 shadow-lg">
            <h3 className="text-md font-bold text-white mb-2">Outbound Webhooks</h3>
            <p className="text-xs text-dark-400 mb-6">Receive real-time HTTP POST alerts on your own server when critical or high severity issues occur.</p>
            
            <form onSubmit={handleUpdateWebhook} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-dark-300 mb-2">Webhook URL</label>
                <input
                  type="url"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://your-api.com/webhooks/js-alerts"
                  className="w-full px-4 py-3 bg-dark-950 border border-dark-800 focus:border-emerald-500 rounded-xl text-xs text-white outline-none placeholder-dark-500"
                />
              </div>
              <button
                type="submit"
                disabled={savingWebhook}
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-dark-950 font-bold rounded-lg text-xs transition-all"
              >
                <Save className="w-4 h-4" />
                <span>Save Webhook URL</span>
              </button>
            </form>
          </section>

          {/* API Key Credentials Section */}
          <section className="bg-dark-900 border border-dark-800 rounded-2xl p-6 shadow-lg">
            <h3 className="text-md font-bold text-white mb-2">SDK Client Credentials</h3>
            <p className="text-xs text-dark-400 mb-6">Use this API key in your script headers or query params to authorize client reports.</p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-dark-300 mb-2">Active SDK API Key</label>
                <div className="flex bg-dark-950 border border-dark-800 rounded-xl overflow-hidden">
                  <div className="p-3 border-r border-dark-800 bg-dark-900/40">
                    <Key className="w-4 h-4 text-emerald-400" />
                  </div>
                  <input
                    type="text"
                    value={apiKey}
                    readOnly
                    className="flex-1 px-4 py-3 bg-transparent text-xs font-mono text-dark-300 outline-none select-all"
                  />
                  <button
                    type="button"
                    onClick={copyApiKey}
                    className="px-4 py-3 bg-dark-900/50 hover:bg-dark-850 hover:text-emerald-400 transition-colors border-l border-dark-800 text-dark-400 flex items-center gap-1 text-xs"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-400" />
                        <span className="text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Clipboard className="w-4 h-4" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Danger Regenerate Action */}
              <div className="pt-4 border-t border-dark-800/60 flex items-center justify-between">
                <div className="flex items-start gap-2 max-w-md">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-dark-400">Regenerating the API key invalidates the existing credential token immediately. Any active client script utilizing the old key will fail reports with 401 Unauthorized.</p>
                </div>
                <button
                  type="button"
                  onClick={handleRegenerateKey}
                  disabled={generatingKey}
                  className="flex items-center gap-2 px-3.5 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 hover:border-rose-500/30 text-rose-400 rounded-lg text-xs font-bold transition-all shrink-0"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${generatingKey ? 'animate-spin' : ''}`} />
                  <span>Regenerate Key</span>
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
