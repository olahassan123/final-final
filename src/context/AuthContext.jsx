import { useState } from "react";
import {
  clearCurrentUser,
  getClientProfile as getStoredClientProfile,
  getCurrentUser,
  loginUser,
  registerClientUser,
  setCurrentUser,
  updateClientProfile as updateStoredClientProfile,
} from "../api/authApi";
import { AuthContext } from "./authContextValue";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getCurrentUser());

  const login = (credentials) => {
    const result = loginUser(credentials);
    if (result.ok) {
      setUser(result.user);
    }
    return result;
  };

  const registerClient = (profile) => {
    const result = registerClientUser(profile);
    if (result.ok) {
      setUser(result.user);
    }
    return result;
  };

  const getClientProfile = (username) => getStoredClientProfile(username);

  const updateClientProfile = (username, updates) => {
    const result = updateStoredClientProfile(username, updates);

    if (result.ok && user?.username === username) {
      const nextUser = {
        ...user,
        fullName: result.client.fullName || result.client.username,
      };
      setUser(nextUser);
      setCurrentUser(nextUser);
    }

    return result;
  };

  const logout = () => {
    setUser(null);
    clearCurrentUser();
  };

  const value = {
    user,
    isAuthenticated: Boolean(user),
    login,
    logout,
    registerClient,
    getClientProfile,
    updateClientProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
