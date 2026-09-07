'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';
import { signOutAction } from '@/lib/actions/auth';
import type { User } from '@supabase/supabase-js';

export interface SessionUser {
    id: string; // auth.users.id
    email: string;
    playerName: string; // obtenido de players.name via user_id
}

interface SessionContextValue {
    user: SessionUser | null;
    loading: boolean;
    logout: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<SessionUser | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const supabase = createClient();

        // Función para cargar el usuario con su playerName
        async function loadUser(authUser: User | null) {
            if (!authUser) {
                setUser(null);
                setLoading(false);
                return;
            }

            // Obtener el playerName desde la tabla players
            const { data: player, error } = await supabase
                .from('players')
                .select('name')
                .eq('user_id', authUser.id)
                .maybeSingle();

            if (error) {
                console.error('Error al cargar perfil de jugador:', error);
                setUser(null);
                setLoading(false);
                return;
            }

            if (!player) {
                console.warn('Usuario autenticado sin perfil de jugador');
                setUser(null);
                setLoading(false);
                return;
            }

            setUser({
                id: authUser.id,
                email: authUser.email || '',
                playerName: player.name,
            });
            setLoading(false);
        }

        // Cargar sesión inicial
        supabase.auth.getSession().then(({ data: { session } }) => {
            loadUser(session?.user ?? null);
        });

        // Suscribirse a cambios de autenticación
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            loadUser(session?.user ?? null);
        });

        // Cleanup: desuscribirse cuando el componente se desmonte
        return () => {
            subscription.unsubscribe();
        };
    }, []);

    const logout = async () => {
        // Actualizar el estado inmediatamente para feedback visual instantáneo
        setUser(null);
        // Llamar a la Server Action que cerrará la sesión en el servidor
        await signOutAction();
        // onAuthStateChange confirmará el cambio y mantendrá el estado sincronizado
    };

    return <SessionContext.Provider value={{ user, loading, logout }}>{children}</SessionContext.Provider>;
}

export function useSession() {
    const ctx = useContext(SessionContext);
    if (!ctx) throw new Error('useSession must be used within a SessionProvider');
    return ctx;
}
