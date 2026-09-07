import { Suspense } from 'react';
import { AuthFormClient } from './auth-form-client';

export default function AuthPage() {
    return (
        <Suspense fallback={<AuthLoadingFallback />}>
            <AuthFormClient />
        </Suspense>
    );
}

function AuthLoadingFallback() {
    return (
        <div className="av-auth-wrap fade-in">
            <div className="auth-card">
                <div className="auth-header">
                    <div className="mark"></div>
                    <h2 className="neon-cyan">ARCADE VAULT</h2>
                    <div
                        className="mono"
                        style={{
                            fontSize: 11,
                            color: 'var(--ink-faint)',
                            letterSpacing: '0.16em',
                            marginTop: 6,
                        }}
                    >
                        ACCESO AL SISTEMA · v2.6
                    </div>
                </div>
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--ink-faint)' }}>Cargando...</div>
            </div>
        </div>
    );
}
