'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Game } from '@/lib/supabase/queries';
import { useSession } from '@/components/session-provider';
import { saveScoreAction } from '@/lib/actions/save-score';
import { GAME_ENGINES } from '@/lib/games/registry';
import type { GameEngineHandle } from '@/lib/games/types';

export function GamePlayer({ game }: { game: Game }) {
    const router = useRouter();
    const { user } = useSession();
    const [score, setScore] = useState(0);
    const [lives, setLives] = useState(3);
    const [engineLevel, setEngineLevel] = useState(1);
    const [paused, setPaused] = useState(false);
    const [over, setOver] = useState(false);
    const [saved, setSaved] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    const engineFactory = GAME_ENGINES[game.id];
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const engineHandleRef = useRef<GameEngineHandle | null>(null);
    const level = engineFactory ? engineLevel : Math.floor(score / 2500) + 1;

    // Motor real: se monta una sola vez sobre el canvas y notifica score/lives/level/gameover.
    useEffect(() => {
        if (!engineFactory || !canvasRef.current) return;

        const handle = engineFactory(canvasRef.current, {
            onScoreChange: setScore,
            onLivesChange: setLives,
            onLevelChange: setEngineLevel,
            onGameOver: (finalScore) => {
                setScore(finalScore);
                setOver(true);
            },
        });
        engineHandleRef.current = handle;

        return () => {
            handle.destroy();
            engineHandleRef.current = null;
        };
    }, [engineFactory]);

    // Placeholder mock (juegos sin motor real todavía): puntaje aleatorio mientras se juega.
    useEffect(() => {
        if (engineFactory || over || paused) return;
        const t = setInterval(() => setScore((s) => s + Math.floor(10 + Math.random() * 90)), 220);
        return () => clearInterval(t);
    }, [engineFactory, over, paused]);

    const togglePause = () => {
        const next = !paused;
        setPaused(next);
        if (engineFactory) {
            if (next) engineHandleRef.current?.pause();
            else engineHandleRef.current?.resume();
        }
    };

    const endGame = () => {
        if (engineFactory) engineHandleRef.current?.pause();
        setOver(true);
    };

    const restart = () => {
        setSaved(false);
        setSaving(false);
        setSaveError(null);
        setOver(false);
        setPaused(false);
        if (engineFactory) {
            engineHandleRef.current?.restart();
        } else {
            setScore(0);
            setLives(3);
        }
    };

    const handleSaveScore = async () => {
        setSaving(true);
        setSaveError(null);

        const result = await saveScoreAction({
            gameId: game.id,
            score,
        });

        setSaving(false);

        if (result.ok) {
            setSaved(true);
        } else {
            setSaveError(result.error);
        }
    };

    return (
        <div className="av-player fade-in">
            <div className="player-hud">
                <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                    <div className="hud-stat">
                        <div className="l">Jugador</div>
                        <div className="v" style={{ color: 'var(--ink)' }}>
                            {user ? user.playerName : 'INVITADO'}
                        </div>
                    </div>
                    <div className="hud-stat">
                        <div className="l">Puntuación</div>
                        <div className="v">{score.toLocaleString('es-ES')}</div>
                    </div>
                    <div className="hud-stat lives">
                        <div className="l">Vidas</div>
                        <div className="v">{'♥ '.repeat(lives).trim() || '—'}</div>
                    </div>
                    <div className="hud-stat level">
                        <div className="l">Nivel</div>
                        <div className="v">{String(level).padStart(2, '0')}</div>
                    </div>
                </div>
                <div className="hud-actions">
                    <button className="btn yellow" onClick={togglePause}>
                        {paused ? 'REANUDAR' : 'PAUSA'}
                    </button>
                    <button className="btn magenta" onClick={endGame}>
                        FIN
                    </button>
                    <button className="btn ghost" onClick={() => router.push(`/juegos/${game.id}`)}>
                        SALIR
                    </button>
                </div>
            </div>

            <div className="crt">
                <div className="crt-screen">
                    {engineFactory ? (
                        <canvas ref={canvasRef} className="game-canvas" />
                    ) : (
                        <div className="game-arena">
                            <div className="grid-floor"></div>
                            <div className="enemy e1"></div>
                            <div className="enemy e2"></div>
                            <div className="enemy e3"></div>
                            <div className="player-ship"></div>
                        </div>
                    )}
                    {paused && (
                        <div className="crt-content" style={{ background: 'rgba(0,0,0,0.6)', zIndex: 5 }}>
                            <div>
                                <div className="pixel neon-yellow" style={{ fontSize: 22 }}>
                                    EN PAUSA
                                </div>
                                <div
                                    className="mono"
                                    style={{
                                        fontSize: 11,
                                        color: 'var(--ink-dim)',
                                        marginTop: 10,
                                        letterSpacing: '0.16em',
                                    }}
                                >
                                    PULSA REANUDAR PARA CONTINUAR
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                <div className="crt-bottom">
                    <span className="led">SEÑAL OK</span>
                    <span>{game.title} · CRT-83 · 60 HZ</span>
                    <span>CARGA · 1MB</span>
                </div>
            </div>

            {over && (
                <div className="modal-bd">
                    <div className="modal">
                        <h2>FIN DEL JUEGO</h2>
                        <div className="final-label">PUNTUACIÓN FINAL</div>
                        <div className="final">{score.toLocaleString('es-ES')}</div>

                        {/* Si no hay sesión, mostrar mensaje de registro */}
                        {!user ? (
                            <div style={{ textAlign: 'center', padding: '20px 0' }}>
                                <div
                                    style={{
                                        fontSize: 14,
                                        color: 'var(--cyan)',
                                        marginBottom: 16,
                                    }}
                                >
                                    Regístrate para guardar tu puntaje
                                </div>
                                <button
                                    className="btn yellow"
                                    onClick={() => router.push(`/auth?redirect=/juegos/${game.id}/jugar`)}
                                >
                                    REGISTRARSE / INICIAR SESIÓN
                                </button>
                            </div>
                        ) : !saved ? (
                            <>
                                <button
                                    className="btn yellow"
                                    onClick={handleSaveScore}
                                    disabled={saving}
                                    style={{ width: '100%', marginTop: 20 }}
                                >
                                    {saving ? 'GUARDANDO...' : 'GUARDAR PUNTAJE'}
                                </button>
                                {saveError && <div className="toast-error">▸ {saveError}</div>}
                            </>
                        ) : (
                            <div className="toast-saved">▸ PUNTUACIÓN GUARDADA_</div>
                        )}

                        <div className="actions">
                            <button className="btn" onClick={restart}>
                                JUGAR DE NUEVO
                            </button>
                            <button className="btn magenta" onClick={() => router.push('/')}>
                                VOLVER AL VAULT
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
