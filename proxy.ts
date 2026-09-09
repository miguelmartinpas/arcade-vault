import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Proteger /juegos/[id]/jugar
    if (pathname.match(/^\/juegos\/[^\/]+\/jugar$/)) {
        let response = NextResponse.next({ request });

        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
            {
                cookies: {
                    getAll() {
                        return request.cookies.getAll();
                    },
                    setAll(cookiesToSet) {
                        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
                        response = NextResponse.next({ request });
                        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
                    },
                },
            },
        );

        const {
            data: { user },
            error,
        } = await supabase.auth.getUser();

        // Fail-closed: si hay error o no hay usuario, redirigir
        if (error || !user) {
            const redirectUrl = new URL('/auth', request.url);
            redirectUrl.searchParams.set('redirect', pathname);
            return NextResponse.redirect(redirectUrl);
        }

        return response;
    }

    return NextResponse.next();
}

// Configurar qué rutas debe proteger el proxy
export const config = {
    matcher: ['/juegos/:path*/jugar'],
};
