import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const restoreSession = useCallback(async () => {
    try {
      const { data } = await api.get('/auth/me');
      setUser(data);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  const login = useCallback(async (email, password) => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/auth/login', { email, password });
      setUser(data.user);
      return data.user;
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch (e) {
      /* Session is cleared locally even if the server is unavailable. */
    }
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, error, isAdmin: user?.role === 'ADMIN' }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
