"use client";

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  emitEvent: (event: string, data: any) => void;
  registerListener: (event: string, callback: (data: any) => void) => () => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, isDemoMode, apiBaseUrl } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const listenersRef = useRef<{ [event: string]: Set<(data: any) => void> }>({});

  useEffect(() => {
    if (!token) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      setIsConnected(false);
      return;
    }

    if (isDemoMode) {
      console.log('[SocketContext] Authenticated in Demo Mode. Spawning simulated events pipeline.');
      setIsConnected(true);
      
      // Setup demo event simulation loop
      const interval = setInterval(() => {
        // 1. Simulate Report Received event
        triggerDemoEvent('report:received', {
          reportId: `rep_${Math.random().toString(36).substring(2, 9)}`,
          environment: Math.random() > 0.3 ? 'production' : 'development',
          url: 'https://demo-app.dev/landing',
          issuesCount: Math.floor(Math.random() * 4) + 1,
          metrics: {
            fcp: Math.floor(800 + Math.random() * 1200),
            lcp: Math.floor(1500 + Math.random() * 2000),
            cls: parseFloat((Math.random() * 0.25).toFixed(2)),
            fid: Math.floor(10 + Math.random() * 80)
          }
        });

        // 2. Simulate Issue Analyzed event occasionally
        if (Math.random() > 0.4) {
          const sampleIssues = [
            {
              issueId: 'iss_contrast',
              projectId: 'demo_proj',
              category: 'accessibility',
              title: 'Low color contrast ratio (3.2:1)',
              severity: 'high',
              aiSuggestion: {
                explanation: 'The contrast between text color and background fails to meet the WCAG AA minimum of 4.5:1, impacting accessibility for visually impaired users.',
                fixCode: '.btn-action { color: #fff; background-color: #1a56db; }',
                referenceUrl: 'https://w3.org/WAI/WCAG21/Understanding/contrast-minimum.html'
              }
            },
            {
              issueId: 'iss_secret',
              projectId: 'demo_proj',
              category: 'security',
              title: 'Exposed credentials / API secret key',
              severity: 'critical',
              aiSuggestion: {
                explanation: 'A potential AWS or database key was found committed in client-side script code. Extracting hardcoded keys from JavaScript is trivial.',
                fixCode: 'const s3 = new AWS.S3({ accessKeyId: process.env.AWS_KEY });',
                referenceUrl: 'https://owasp.org/www-community/Source_Code_Analysis'
              }
            },
            {
              issueId: 'iss_performance',
              projectId: 'demo_proj',
              category: 'performance',
              title: 'Excessive DOM size detected',
              severity: 'medium',
              aiSuggestion: {
                explanation: 'The DOM tree has 2,450 elements, exceeding recommended counts. Large DOMs slow down styling recalculations and layouts.',
                fixCode: '// Redesign list views using virtualized scroll tables.',
                referenceUrl: 'https://web.dev/dom-size/'
              }
            }
          ];

          const picked = sampleIssues[Math.floor(Math.random() * sampleIssues.length)];
          triggerDemoEvent('issue:analyzed', picked);
        }
      }, 10000); // Trigger every 10 seconds

      return () => {
        clearInterval(interval);
      };
    }

    // Connect to actual WebSocket gateway
    const socketInstance = io(apiBaseUrl, {
      auth: { token },
      transports: ['websocket', 'polling']
    });

    socketInstance.on('connect', () => {
      console.log(`[Socket] Connected to backend gateway: ${socketInstance.id}`);
      setIsConnected(true);
    });

    socketInstance.on('disconnect', () => {
      console.log('[Socket] Disconnected from gateway.');
      setIsConnected(false);
    });

    // Wire global event dispatcher to capture everything
    socketInstance.onAny((event, ...args) => {
      const callbacks = listenersRef.current[event];
      if (callbacks) {
        callbacks.forEach(cb => cb(args[0]));
      }
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
      setSocket(null);
      setIsConnected(false);
    };
  }, [token, isDemoMode]);

  // Local helper to fire callbacks in demo mode
  const triggerDemoEvent = (event: string, data: any) => {
    const callbacks = listenersRef.current[event];
    if (callbacks) {
      callbacks.forEach(cb => cb(data));
    }
  };

  const registerListener = (event: string, callback: (data: any) => void) => {
    if (!listenersRef.current[event]) {
      listenersRef.current[event] = new Set();
    }
    listenersRef.current[event].add(callback);

    // Return unregister cleanup hook
    return () => {
      const callbacks = listenersRef.current[event];
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          delete listenersRef.current[event];
        }
      }
    };
  };

  const emitEvent = (event: string, data: any) => {
    if (isDemoMode) {
      console.log(`[Socket Demo] Emitting event: ${event}`, data);
      
      // Simulate successful join triggers
      if (event === 'join-project') {
        setTimeout(() => {
          triggerDemoEvent('joined', { projectId: data });
        }, 100);
      }
      return;
    }

    if (socket) {
      socket.emit(event, data);
    } else {
      console.warn('[Socket] Attempted to emit event before connection is online.');
    }
  };

  return (
    <SocketContext.Provider value={{ socket, isConnected, emitEvent, registerListener }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
