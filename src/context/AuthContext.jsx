import { useState } from "react";
import {
  clearCurrentUser,
  clearGoogleToken,
  getClientProfile as getStoredClientProfile,
  getCurrentUser,
  fetchClientAppointments as fetchStoredClientAppointments,
  fetchClientProfile as fetchStoredClientProfile,
  loginStaffUser,
  loginUser,
  registerClientUser,
  setCurrentUser,
  setGoogleToken,
  startCustomerPasswordReset,
  confirmCustomerPasswordReset,
  updateAccountSettings as updateStoredAccountSettings,
  updateClientProfile as updateStoredClientProfile,
} from "../api/authApi";
import { API_BASE_URL } from "../api/config";
import { AuthContext } from "./authContextValue";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getCurrentUser());

  const login = async (credentials) => {
    const result = await loginUser(credentials);
    if (result.ok) {
      setUser(result.user);
    }
    return result;
  };

  const loginStaff = async (credentials) => {
    const result = await loginStaffUser(credentials);
    if (result.ok) {
      setUser(result.user);
    }
    return result;
  };

  const registerClient = async (profile) => {
    const result = await registerClientUser(profile);
    if (result.ok) {
      setUser(result.user);
    }
    return result;
  };

  const getClientProfile = (username) => getStoredClientProfile(username);
  const fetchClientProfile = () => fetchStoredClientProfile();
  const fetchClientAppointments = () => fetchStoredClientAppointments();

  const updateClientProfile = async (username, updates) => {
    const result = await updateStoredClientProfile(username, updates);

    if (result.ok && user?.username === username) {
      const nextUser = {
        ...user,
        fullName: result.client.fullName || result.client.username,
        email: result.client.email || user.email || "",
        phone: result.client.phone || user.phone || "",
      };
      setUser(nextUser);
      setCurrentUser(nextUser);
    }

    return result;
  };

  const updateAccountSettings = async (updates) => {
    const result = await updateStoredAccountSettings(updates);
    if (result.ok) {
      setUser(result.user);
    }
    return result;
  };

  const googleLogin = async (credential) => {
    const res = await fetch(`${API_BASE_URL}/auth/google`, {
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
    loginStaff,
    logout,
    googleLogin,
    registerClient,
    getClientProfile,
    fetchClientProfile,
    fetchClientAppointments,
    updateClientProfile,
    updateAccountSettings,
    startCustomerPasswordReset,
    confirmCustomerPasswordReset,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
