import { createClient } from '@/lib/supabase/server';

export async function GET() {
    try {
        // Instancia el cliente para confirmar que el módulo de servidor
        // (lib/supabase/server.ts) construye correctamente sin errores.
        await createClient();

        // getSession() no basta como healthcheck: sin una sesión guardada
        // (no hay cookie) resuelve localmente sin red, así que nunca detecta
        // una URL/key inválida. Se prueba la conectividad real contra el
        // endpoint de salud de Auth.
        const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/health`, {
            headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY! },
        });

        if (!response.ok) {
            return Response.json({ ok: false, error: `Supabase respondió ${response.status}` }, { status: 500 });
        }

        return Response.json({ ok: true });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return Response.json({ ok: false, error: message }, { status: 500 });
    }
}
