"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import Link from 'next/link';
import { Code2, ArrowRight } from 'lucide-react';

export default function Home() {
  const router = useRouter();
  const { token, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && token) {
      router.push('/projects');
    }
  }, [token, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-screen flex items-center justify-center bg-dark-950 text-white h-screen">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-dark-300 text-sm">Loading workspace session...</span>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-dark-950 flex flex-col items-center justify-center p-6 text-center select-none h-screen relative overflow-hidden">
      {/* Dynamic backdrop background grids */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-emerald-500/10 via-dark-950 to-dark-950 pointer-events-none z-0" />

      <div className="relative z-10 max-w-2xl flex flex-col items-center">
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl mb-6 animate-pulse">
          <Code2 className="w-12 h-12 text-emerald-400" />
        </div>

        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-white leading-tight">
          Real-Time Frontend <br />
          <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">Code Quality Inspector</span>
        </h1>

        <p className="mt-6 text-lg text-dark-300 leading-relaxed max-w-lg">
          Zero-configuration runtime metrics, accessibility checking, mixed content scanners, and automated AI suggestions in one lightweight CDN tag.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center w-full max-w-sm">
          <Link
            href="/login"
            className="flex items-center justify-center gap-2 px-6 py-3.5 bg-emerald-500 hover:bg-emerald-455 text-dark-950 font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/20 hover:scale-[1.02]"
          >
            <span>Open Console</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/register"
            className="flex items-center justify-center px-6 py-3.5 bg-dark-900 hover:bg-dark-800 text-dark-100 border border-dark-800 font-bold rounded-xl transition-all hover:scale-[1.02]"
          >
            Create Account
          </Link>
        </div>
      </div>
    </main>
  );
}
