"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface AuthContextType {
  token: string | null;
  user: User | null;
  isLoading: boolean;
  isDemoMode: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  register: (name: string, email: string, password: string) => Promise<boolean>;
  logout: () => void;
  apiBaseUrl: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

  useEffect(() => {
    // Read local cache
    const cachedToken = localStorage.getItem('analyzer_token');
    const cachedUser = localStorage.getItem('analyzer_user');

    if (cachedToken && cachedUser) {
      setToken(cachedToken);
      setUser(JSON.parse(cachedUser));
      // Check if it was demo mode
      setIsDemoMode(localStorage.getItem('analyzer_demo') === 'true');
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();
      if (response.ok && data.status === 'success') {
        const userPayload = data.data.user;
        const tokenPayload = data.token;

        setToken(tokenPayload);
        setUser(userPayload);
        setIsDemoMode(false);

        localStorage.setItem('analyzer_token', tokenPayload);
        localStorage.setItem('analyzer_user', JSON.stringify(userPayload));
        localStorage.setItem('analyzer_demo', 'false');
        
        setIsLoading(false);
        return true;
      }
      throw new Error(data.message || 'Login failed.');
    } catch (err: any) {
      console.warn('[Auth] Backend unreachable or login failed. Activating local demo mode fallback.', err);
      
      // Standalone Demo Mode Fallback
      const demoUser: User = {
        id: 'demo_user_123',
        name: 'Guest Developer',
        email: email || 'guest@example.com',
        role: 'developer'
      };
      const demoToken = 'mock_jwt_token_demo_123456';

      setToken(demoToken);
      setUser(demoUser);
      setIsDemoMode(true);

      localStorage.setItem('analyzer_token', demoToken);
      localStorage.setItem('analyzer_user', JSON.stringify(demoUser));
      localStorage.setItem('analyzer_demo', 'true');

      setIsLoading(false);
      return true;
    }
  };

  const register = async (name: string, email: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      });

      const data = await response.json();
      if (response.ok && data.status === 'success') {
        const userPayload = data.data.user;
        const tokenPayload = data.token;

        setToken(tokenPayload);
        setUser(userPayload);
        setIsDemoMode(false);

        localStorage.setItem('analyzer_token', tokenPayload);
        localStorage.setItem('analyzer_user', JSON.stringify(userPayload));
        localStorage.setItem('analyzer_demo', 'false');

        setIsLoading(false);
        return true;
      }
      throw new Error(data.message || 'Registration failed.');
    } catch (err) {
      console.warn('[Auth] Backend offline. Triggering demo registration.');
      
      const demoUser: User = {
        id: 'demo_user_123',
        name: name || 'Guest Developer',
        email: email || 'guest@example.com',
        role: 'developer'
      };
      const demoToken = 'mock_jwt_token_demo_123456';

      setToken(demoToken);
      setUser(demoUser);
      setIsDemoMode(true);

      localStorage.setItem('analyzer_token', demoToken);
      localStorage.setItem('analyzer_user', JSON.stringify(demoUser));
      localStorage.setItem('analyzer_demo', 'true');

      setIsLoading(false);
      return true;
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setIsDemoMode(false);
    localStorage.removeItem('analyzer_token');
    localStorage.removeItem('analyzer_user');
    localStorage.removeItem('analyzer_demo');
  };

  return (
    <AuthContext.Provider value={{ token, user, isLoading, isDemoMode, login, register, logout, apiBaseUrl }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
