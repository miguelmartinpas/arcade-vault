'use client';

import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react';
import { saveScoreAction, type SaveScoreResult } from '@/lib/actions/save-score';

export interface SessionUser {
    name: string;
}

export interface ScoreEntry {
    game: string;
    score: number;
    name: string;
}

interface SessionContextValue {
    user: SessionUser | null;
    login: (name: string) => void;
    logout: () => void;
    saveScore: (entry: ScoreEntry) => Promise<SaveScoreResult>;
}

const USER_KEY = 'av_user';
const USER_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function setUserCookie(name: string) {
    try {
        document.cookie = `${USER_KEY}=${encodeURIComponent(name)}; path=/; max-age=${USER_COOKIE_MAX_AGE}`;
    } catch {}
}

function clearUserCookie() {
    try {
        document.cookie = `${USER_KEY}=; path=/; max-age=0`;
    } catch {}
}

const listeners = new Set<() => void>();

function emitChange() {
    for (const listener of listeners) listener();
}

function subscribe(callback: () => void) {
    listeners.add(callback);
    window.addEventListener('storage', callback);
    return () => {
        listeners.delete(callback);
        window.removeEventListener('storage', callback);
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
        setUserCookie(name);
        emitChange();
    };

    const logout = () => {
        try {
            localStorage.removeItem(USER_KEY);
        } catch {}
        clearUserCookie();
        emitChange();
    };

    const saveScore = (entry: ScoreEntry) => {
        return saveScoreAction({ gameId: entry.game, name: entry.name, score: entry.score });
    };

    return <SessionContext.Provider value={{ user, login, logout, saveScore }}>{children}</SessionContext.Provider>;
}

export function useSession() {
    const ctx = useContext(SessionContext);
    if (!ctx) throw new Error('useSession must be used within a SessionProvider');
    return ctx;
}
