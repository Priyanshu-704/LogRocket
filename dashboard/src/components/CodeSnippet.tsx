"use client";

import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface CodeSnippetProps {
  code: string;
  language?: string;
}

export const CodeSnippet: React.FC<CodeSnippetProps> = ({ code, language = 'javascript' }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard', err);
    }
  };

  return (
    <div className="relative group rounded-lg border border-dark-800 bg-dark-950 overflow-hidden mt-3">
      {/* Code Header Bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-dark-800 bg-dark-900/50">
        <span className="text-xs font-mono text-dark-400 select-none">{language}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-[11px] text-dark-300 hover:text-emerald-400 transition-colors"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy code</span>
            </>
          )}
        </button>
      </div>

      {/* Code scroll body */}
      <pre className="p-4 overflow-x-auto text-xs font-mono leading-relaxed text-dark-100 select-text max-h-96">
        <code>{code}</code>
      </pre>
    </div>
  );
};

export default CodeSnippet;
