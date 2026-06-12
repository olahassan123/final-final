import { useState } from "react";
import {
  clearCurrentUser,
  clearGoogleToken,
  getClientProfile as getStoredClientProfile,
  getCurrentUser,
  loginUser,
  registerClientUser,
  setCurrentUser,
  setGoogleToken,
  updateClientProfile as updateStoredClientProfile,
} from "../api/authApi";
import { AuthContext } from "./authContextValue";

const API_BASE = "http://127.0.0.1:8000";

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

  const googleLogin = async (credential) => {
    const res = await fetch(`${API_BASE}/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential }),
    });
    if (!res.ok) throw new Error("Google authentication failed");
    const data = await res.json();
    setGoogleToken(data.token);
    const sessionUser = {
      username: data.user.email,
      role: data.user.role,
      fullName: data.user.name,
      picture: data.user.picture,
      googleId: data.user.id,
      isGoogle: true,
    };
    setCurrentUser(sessionUser);
    setUser(sessionUser);
    return { ok: true, user: sessionUser };
  };

  const logout = () => {
    setUser(null);
    clearCurrentUser();
    clearGoogleToken();
  };

  const value = {
    user,
    isAuthenticated: Boolean(user),
    login,
    logout,
    googleLogin,
    registerClient,
    getClientProfile,
    updateClientProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
