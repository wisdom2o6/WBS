import React, { createContext, useContext, useState } from "react";

interface User {
  userId: string;
  username: string;
  email: string;
  fullName: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User, remember?: boolean) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(() => {
    const savedUser =
      localStorage.getItem("userInfo") || sessionStorage.getItem("userInfo");
    const savedToken =
      localStorage.getItem("accessToken") ||
      sessionStorage.getItem("accessToken");
    try {
      return savedUser && savedToken ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState<string | null>(
    localStorage.getItem("accessToken") ||
      sessionStorage.getItem("accessToken"),
  );

  const login = (newToken: string, userData: User, remember = true) => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("userInfo");
    sessionStorage.removeItem("accessToken");
    sessionStorage.removeItem("userInfo");
    const storage = remember ? localStorage : sessionStorage;
    storage.setItem("accessToken", newToken);
    storage.setItem("userInfo", JSON.stringify(userData));
    setToken(newToken);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("userInfo");
    sessionStorage.removeItem("accessToken");
    sessionStorage.removeItem("userInfo");
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
