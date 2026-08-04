"use client";

import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";

export interface SessionUser {
  name: string;
}

export interface ScoreEntry {
  game: string;
  score: number;
  name: string;
  at: number;
}

interface SessionContextValue {
  user: SessionUser | null;
  login: (name: string) => void;
  logout: () => void;
  saveScore: (entry: Omit<ScoreEntry, "at">) => void;
}

const USER_KEY = "av_user";
const SCORES_KEY = "av_scores";

const listeners = new Set<() => void>();

function emitChange() {
  for (const listener of listeners) listener();
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

function getUserSnapshot() {
  try {
    return localStorage.getItem(USER_KEY);
  } catch {
    return null;
  }
}

function getServerSnapshot() {
  return null;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const rawUser = useSyncExternalStore(subscribe, getUserSnapshot, getServerSnapshot);
  let user: SessionUser | null = null;
  if (rawUser) {
    try {
      user = JSON.parse(rawUser);
    } catch {
      user = null;
    }
  }

  const login = (name: string) => {
    try {
      localStorage.setItem(USER_KEY, JSON.stringify({ name }));
    } catch {}
    emitChange();
  };

  const logout = () => {
    try {
      localStorage.removeItem(USER_KEY);
    } catch {}
    emitChange();
  };

  const saveScore = (entry: Omit<ScoreEntry, "at">) => {
    try {
      const all: ScoreEntry[] = JSON.parse(localStorage.getItem(SCORES_KEY) || "[]");
      all.push({ ...entry, at: Date.now() });
      localStorage.setItem(SCORES_KEY, JSON.stringify(all));
    } catch {}
  };

  return (
    <SessionContext.Provider value={{ user, login, logout, saveScore }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within a SessionProvider");
  return ctx;
}
