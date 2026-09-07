'use client';

import { useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signUpAction, signInAction } from '@/lib/actions/auth';

/**
 * Valida que una contraseña cumpla los requisitos mínimos:
 * - Mínimo 6 caracteres
 * - Al menos una mayúscula
 * - Al menos un número
 * - Al menos un símbolo
 *
 * @returns null si la contraseña es válida, o un mensaje de error si no lo es
 */
function validatePassword(password: string): string | null {
    if (password.length < 6) return 'Mínimo 6 caracteres';
    if (!/[A-Z]/.test(password)) return 'Debe contener una mayúscula';
    if (!/[0-9]/.test(password)) return 'Debe contener un número';
    if (!/[^A-Za-z0-9]/.test(password)) return 'Debe contener un símbolo';
    return null;
}

export function AuthFormClient() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const redirectTo = searchParams.get('redirect') || '/biblioteca';

    const [tab, setTab] = useState<'in' | 'up'>('in');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Campos del formulario de registro
    const [signUpEmail, setSignUpEmail] = useState('');
    const [signUpPassword, setSignUpPassword] = useState('');
    const [signUpConfirmPassword, setSignUpConfirmPassword] = useState('');
    const [playerName, setPlayerName] = useState('');

    // Campos del formulario de login
    const [signInEmail, setSignInEmail] = useState('');
    const [signInPassword, setSignInPassword] = useState('');

    // Validación client-side de contraseña (para mostrar inline)
    const passwordError = signUpPassword ? validatePassword(signUpPassword) : null;
    const passwordsMatch = signUpPassword && signUpConfirmPassword && signUpPassword === signUpConfirmPassword;

    const handleSignUp = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccessMessage(null);

        // Validaciones client-side
        if (!signUpEmail || !signUpPassword || !signUpConfirmPassword || !playerName) {
            setError('Todos los campos son obligatorios');
            return;
        }

        const pwdError = validatePassword(signUpPassword);
        if (pwdError) {
            setError(pwdError);
            return;
        }

        if (signUpPassword !== signUpConfirmPassword) {
            setError('Las contraseñas no coinciden');
            return;
        }

        if (playerName.length < 1 || playerName.length > 12) {
            setError('El nombre de jugador debe tener entre 1 y 12 caracteres');
            return;
        }

        setLoading(true);

        // Llamar a la Server Action
        const result = await signUpAction({
            email: signUpEmail,
            password: signUpPassword,
            playerName,
        });

        setLoading(false);

        if (result.ok) {
            setSuccessMessage('¡Cuenta creada! Revisa tu email para verificar tu cuenta.');
            // Limpiar formulario
            setSignUpEmail('');
            setSignUpPassword('');
            setSignUpConfirmPassword('');
            setPlayerName('');
        } else {
            setError(result.error);
        }
    };

    const handleSignIn = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccessMessage(null);

        // Validaciones client-side
        if (!signInEmail || !signInPassword) {
            setError('Email y contraseña son obligatorios');
            return;
        }

        setLoading(true);

        // Llamar a la Server Action
        const result = await signInAction({
            email: signInEmail,
            password: signInPassword,
        });

        setLoading(false);

        if (result.ok) {
            // Redirigir a la página de redirect o a /biblioteca
            router.push(redirectTo);
        } else {
            setError(result.error);
        }
    };

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

                <div className="auth-tabs">
                    <button
                        type="button"
                        className={tab === 'in' ? 'on' : ''}
                        onClick={() => {
                            setTab('in');
                            setError(null);
                            setSuccessMessage(null);
                        }}
                    >
                        INICIAR SESIÓN
                    </button>
                    <button
                        type="button"
                        className={tab === 'up' ? 'on' : ''}
                        onClick={() => {
                            setTab('up');
                            setError(null);
                            setSuccessMessage(null);
                        }}
                    >
                        REGISTRARSE
                    </button>
                </div>

                {/* Bloque de error/éxito arriba del formulario activo */}
                {error && (
                    <div
                        style={{
                            padding: '12px 16px',
                            marginBottom: 16,
                            backgroundColor: 'rgba(255, 64, 129, 0.1)',
                            border: '1px solid rgba(255, 64, 129, 0.3)',
                            borderRadius: 4,
                            color: 'var(--magenta)',
                            fontSize: 13,
                        }}
                    >
                        ⚠️ {error}
                    </div>
                )}

                {successMessage && (
                    <div
                        style={{
                            padding: '12px 16px',
                            marginBottom: 16,
                            backgroundColor: 'rgba(0, 255, 255, 0.1)',
                            border: '1px solid rgba(0, 255, 255, 0.3)',
                            borderRadius: 4,
                            color: 'var(--cyan)',
                            fontSize: 13,
                        }}
                    >
                        ✓ {successMessage}
                    </div>
                )}

                {/* Formulario de Iniciar Sesión */}
                {tab === 'in' && (
                    <form onSubmit={handleSignIn}>
                        <div className="field">
                            <label>Email</label>
                            <input
                                type="email"
                                value={signInEmail}
                                onChange={(e) => setSignInEmail(e.target.value)}
                                placeholder="jugador@vault.gg"
                                disabled={loading}
                                required
                            />
                        </div>
                        <div className="field">
                            <label>Contraseña</label>
                            <input
                                type="password"
                                value={signInPassword}
                                onChange={(e) => setSignInPassword(e.target.value)}
                                placeholder="••••••••"
                                disabled={loading}
                                required
                            />
                        </div>

                        <button
                            className="btn lg"
                            type="submit"
                            style={{ width: '100%', marginTop: 8 }}
                            disabled={loading}
                        >
                            {loading ? 'ENTRANDO...' : 'ENTRAR AL VAULT'}
                        </button>
                    </form>
                )}

                {/* Formulario de Registrarse */}
                {tab === 'up' && (
                    <form onSubmit={handleSignUp}>
                        <div className="field">
                            <label>Email</label>
                            <input
                                type="email"
                                value={signUpEmail}
                                onChange={(e) => setSignUpEmail(e.target.value)}
                                placeholder="jugador@vault.gg"
                                disabled={loading}
                                required
                            />
                        </div>
                        <div className="field">
                            <label>Contraseña</label>
                            <input
                                type="password"
                                value={signUpPassword}
                                onChange={(e) => setSignUpPassword(e.target.value)}
                                placeholder="••••••••"
                                disabled={loading}
                                required
                            />
                            {passwordError && signUpPassword && (
                                <div style={{ fontSize: 11, color: 'var(--magenta)', marginTop: 4 }}>
                                    ⚠️ {passwordError}
                                </div>
                            )}
                        </div>
                        <div className="field">
                            <label>Confirmar Contraseña</label>
                            <input
                                type="password"
                                value={signUpConfirmPassword}
                                onChange={(e) => setSignUpConfirmPassword(e.target.value)}
                                placeholder="••••••••"
                                disabled={loading}
                                required
                            />
                            {signUpConfirmPassword && !passwordsMatch && (
                                <div style={{ fontSize: 11, color: 'var(--magenta)', marginTop: 4 }}>
                                    ⚠️ Las contraseñas no coinciden
                                </div>
                            )}
                        </div>
                        <div className="field">
                            <label>Nombre de Jugador (1-12 caracteres)</label>
                            <input
                                type="text"
                                value={playerName}
                                onChange={(e) => setPlayerName(e.target.value.toUpperCase().slice(0, 12))}
                                placeholder="NEONFOX"
                                disabled={loading}
                                maxLength={12}
                                required
                            />
                            <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 4 }}>
                                {playerName.length}/12 caracteres
                            </div>
                        </div>

                        <button
                            className="btn lg"
                            type="submit"
                            style={{ width: '100%', marginTop: 8 }}
                            disabled={loading || !!passwordError || !passwordsMatch}
                        >
                            {loading ? 'CREANDO CUENTA...' : 'CREAR Y JUGAR'}
                        </button>
                    </form>
                )}

                <div
                    style={{
                        marginTop: 18,
                        textAlign: 'center',
                        fontSize: 11,
                        color: 'var(--ink-faint)',
                        letterSpacing: '0.1em',
                    }}
                >
                    AL ENTRAR ACEPTAS LOS TÉRMINOS DEL SALÓN ARCADE
                </div>
            </div>
        </div>
    );
}
