import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
    try {
        const cookieStore = await cookies();

        return createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
            {
                cookies: {
                    getAll() {
                        return cookieStore.getAll();
                    },
                    setAll(cookiesToSet) {
                        try {
                            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
                        } catch {
                            // Server Components no pueden escribir cookies; se ignora
                            // porque este proyecto todavía no usa middleware de sesión.
                        }
                    },
                },
            },
        );
    } catch {
        // cookies() no está disponible fuera de un request (ej. generateStaticParams
        // en build time); las políticas de select son públicas, así que un cliente
        // sin cookie store sigue pudiendo leer los datos.
        return createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
            {
                cookies: {
                    getAll() {
                        return [];
                    },
                    setAll() {},
                },
            },
        );
    }
}
