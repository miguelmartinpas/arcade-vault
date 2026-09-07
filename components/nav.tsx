'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useSession } from '@/components/session-provider';

function isActive(pathname: string, target: 'home' | 'biblioteca' | 'salon' | 'about' | 'auth') {
    if (target === 'home') return pathname === '/';
    if (target === 'biblioteca') return pathname === '/biblioteca' || pathname.startsWith('/juegos');
    if (target === 'salon') return pathname === '/salon-de-la-fama';
    if (target === 'about') return pathname === '/acerca-de';
    return pathname === '/auth';
}

export function Nav() {
    const pathname = usePathname();
    const { user, logout } = useSession();
    const [open, setOpen] = useState(false);
    const close = () => setOpen(false);

    return (
        <>
            <nav className="av-nav">
                <Link href="/" className="logo" onClick={close}>
                    <div className="logo-mark"></div>
                    <div className="logo-text neon-cyan">
                        ARCADE <span className="neon-magenta">VAULT</span>
                    </div>
                </Link>
                <div className="links">
                    <Link href="/" className={isActive(pathname, 'home') ? 'active' : ''}>
                        Inicio
                    </Link>
                    <Link href="/biblioteca" className={isActive(pathname, 'biblioteca') ? 'active' : ''}>
                        Biblioteca
                    </Link>
                    <Link href="/salon-de-la-fama" className={isActive(pathname, 'salon') ? 'active' : ''}>
                        Salón de la Fama
                    </Link>
                    <Link href="/acerca-de" className={isActive(pathname, 'about') ? 'active' : ''}>
                        Acerca de
                    </Link>
                </div>
                <div className="spacer"></div>
                <div className="coin-counter">
                    <span className="coin"></span>
                    <span>CRÉDITOS · 03</span>
                </div>
                {user ? (
                    <button className="btn ghost auth-btn" onClick={logout}>
                        SALIR
                    </button>
                ) : (
                    <Link href="/auth" className="btn auth-btn">
                        ENTRAR
                    </Link>
                )}
                <button className="btn ghost hamburger" onClick={() => setOpen(true)} aria-label="Menú">
                    ≡
                </button>
            </nav>

            <div className={'av-mobile-backdrop' + (open ? ' open' : '')} onClick={close}></div>
            <aside className={'av-mobile-panel' + (open ? ' open' : '')}>
                <div className="pixel neon-cyan" style={{ fontSize: 11, marginBottom: 16 }}>
                    MENÚ
                </div>
                <Link href="/" className={isActive(pathname, 'home') ? 'active' : ''} onClick={close}>
                    Inicio
                </Link>
                <Link href="/biblioteca" className={isActive(pathname, 'biblioteca') ? 'active' : ''} onClick={close}>
                    Biblioteca
                </Link>
                <Link href="/salon-de-la-fama" className={isActive(pathname, 'salon') ? 'active' : ''} onClick={close}>
                    Salón de la Fama
                </Link>
                <Link href="/acerca-de" className={isActive(pathname, 'about') ? 'active' : ''} onClick={close}>
                    Acerca de
                </Link>
                {user ? (
                    <button
                        className="btn ghost"
                        style={{ width: '100%', textAlign: 'left' }}
                        onClick={() => {
                            close();
                            logout();
                        }}
                    >
                        Salir ({user.playerName})
                    </button>
                ) : (
                    <Link href="/auth" className={isActive(pathname, 'auth') ? 'active' : ''} onClick={close}>
                        Iniciar Sesión
                    </Link>
                )}
                <div style={{ flex: 1 }}></div>
                <div className="pixel" style={{ fontSize: 9, color: 'var(--ink-faint)', letterSpacing: '0.16em' }}>
                    CRÉDITOS · 03
                </div>
            </aside>
        </>
    );
}
