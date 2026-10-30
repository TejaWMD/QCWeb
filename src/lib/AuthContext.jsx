import React, { createContext, useState, useContext, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { appParams } from '@/lib/app-params';

const AuthContext = createContext();

export const DEV_USER = {
  id: "dev-admin-id",
  email: "admin@factoryops.local",
  full_name: "Admin",
  role: "admin",
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(DEV_USER);
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [isLoadingAuth, setIsLoadingAuth] = useState(false);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(true);
  const [appPublicSettings, setAppPublicSettings] = useState(null); // Contains only { id, public_settings }
  // "View as" demo mode (Admin only): temporarily limits the admin to the
  // selected role's visible modules.
  const [viewAsRole, setViewAsRoleState] = useState(() => {
    try { return localStorage.getItem('view_as_role') || ''; } catch { return ''; }
  });

  const setViewAsRole = (role) => {
    setViewAsRoleState(role || '');
    try {
      if (role) localStorage.setItem('view_as_role', role);
      else localStorage.removeItem('view_as_role');
    } catch { /* storage unavailable */ }
  };

  useEffect(() => {
    checkAppState();
  }, []);

  const checkAppState = async () => {
    try {
      setIsLoadingPublicSettings(true);
      setAuthError(null);
      
      try {
        const publicSettings = await base44.app.getPublicSettings();
        setAppPublicSettings(publicSettings);
        
        // If we got the app public settings successfully, check if user is authenticated
        if (appParams.token) {
          await checkUserAuth();
        } else {
          setIsLoadingAuth(false);
          setIsAuthenticated(true);
          setUser((prev) => prev || DEV_USER);
          setAuthChecked(true);
        }
        setIsLoadingPublicSettings(false);
      } catch (appError) {
        console.warn('App state check notice (using dev user):', appError);
        setIsLoadingPublicSettings(false);
        setIsLoadingAuth(false);
        setUser((prev) => prev || DEV_USER);
        setIsAuthenticated(true);
        setAuthChecked(true);
      }
    } catch (error) {
      console.warn('Unexpected error (using dev user):', error);
      setIsLoadingPublicSettings(false);
      setIsLoadingAuth(false);
      setUser((prev) => prev || DEV_USER);
      setIsAuthenticated(true);
      setAuthChecked(true);
    }
  };

  const checkUserAuth = async () => {
    try {
      // Now check if the user is authenticated
      setIsLoadingAuth(true);
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      setIsAuthenticated(true);
      setIsLoadingAuth(false);
      setAuthChecked(true);
    } catch (error) {
      console.warn('User auth check failed, using dev user:', error);
      setUser(DEV_USER);
      setIsAuthenticated(true);
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  };

  const logout = (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    setViewAsRole('');
    
    if (shouldRedirect) {
      // Use the SDK's logout method which handles token cleanup and redirect
      base44.auth.logout(window.location.href);
    } else {
      // Just remove the token without redirect
      base44.auth.logout();
    }
  };

  const navigateToLogin = () => {
    // Use the SDK's redirectToLogin method
    base44.auth.redirectToLogin(window.location.href);
  };

  // The user augmented with the active "View as" demo role (Admin only);
  // everywhere in the app reads the role through this object.
  const viewUser = user
    ? { ...user, view_as_role: user.role === 'admin' ? (viewAsRole || null) : null }
    : null;

  return (
    <AuthContext.Provider value={{ 
      user: viewUser, 
      viewAsRole: user?.role === 'admin' ? viewAsRole : '',
      setViewAsRole,
      isAuthenticated, 
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      authChecked,
      logout,
      navigateToLogin,
      checkUserAuth,
      checkAppState
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};