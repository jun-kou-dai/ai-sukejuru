import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { startLogin, handleRedirect, isLoggedIn, logout as doLogout, getAccessToken } from '../services/googleAuth';

interface AuthContextType {
  loggedIn: boolean;
  accessToken: string | null;
  login: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  loggedIn: false,
  accessToken: null,
  login: () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    // Check for OAuth redirect on mount
    const redirected = handleRedirect();
    if (redirected) {
      setLoggedIn(true);
    } else {
      setLoggedIn(isLoggedIn());
    }
  }, []);

  const login = useCallback(() => {
    startLogin();
  }, []);

  const logout = useCallback(() => {
    doLogout();
    setLoggedIn(false);
  }, []);

  return (
    <AuthContext.Provider value={{ loggedIn, accessToken: getAccessToken(), login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
