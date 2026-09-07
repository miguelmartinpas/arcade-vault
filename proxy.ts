import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
    const response = NextResponse.next({
        request,
    });

    // Crear cliente de Supabase con las cookies de la request/response
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value));
                    cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
                },
            },
        },
    );

    // Verificar si hay sesión autenticada
    const {
        data: { user },
    } = await supabase.auth.getUser();

    // Si no hay usuario autenticado, redirigir a /auth con query param de redirect
    if (!user) {
        const redirectUrl = new URL('/auth', request.url);
        redirectUrl.searchParams.set('redirect', request.nextUrl.pathname);
        return NextResponse.redirect(redirectUrl);
    }

    // Usuario autenticado, permitir acceso
    return response;
}

// Configurar qué rutas debe proteger el middleware
export const config = {
    matcher: '/juegos/:id/jugar',
};
