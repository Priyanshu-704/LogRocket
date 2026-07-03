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
    let response: any;
    try {
      response = await fetch(`${apiBaseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
    } catch (networkErr: any) {
      console.warn('[Auth] Backend unreachable. Activating local demo mode fallback.', networkErr);
      
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

    try {
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
      alert(data.message || 'Login failed.');
      setIsLoading(false);
      return false;
    } catch (err: any) {
      alert('Error parsing server response.');
      setIsLoading(false);
      return false;
    }
  };

  const register = async (name: string, email: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    let response: any;
    try {
      response = await fetch(`${apiBaseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      });
    } catch (networkErr: any) {
      console.warn('[Auth] Backend offline. Triggering demo registration.', networkErr);
      
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

    try {
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
      alert(data.message || 'Registration failed.');
      setIsLoading(false);
      return false;
    } catch (err: any) {
      alert('Error parsing server response.');
      setIsLoading(false);
      return false;
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
