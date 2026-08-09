'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Game, LeaderboardRow } from '@/lib/supabase/queries';
import { useSession } from '@/components/session-provider';

export interface HallOfFameProps {
    games: Game[];
    globalLeaderboard: LeaderboardRow[];
    gameLeaderboards: Record<string, LeaderboardRow[]>;
    playerBestByGame: Record<string, { score: number; date: string } | null>;
}

const GLOBAL_TAB = 'GLOBAL';

export function HallOfFame({ games, globalLeaderboard, gameLeaderboards, playerBestByGame }: HallOfFameProps) {
    const { user } = useSession();
    const [tab, setTab] = useState<string>(GLOBAL_TAB);

    const isGlobal = tab === GLOBAL_TAB;
    const rows = isGlobal ? globalLeaderboard : (gameLeaderboards[tab] ?? []);
    const game = isGlobal ? null : games.find((g) => g.id === tab);
    const playerBest = isGlobal ? null : playerBestByGame[tab];

    return (
        <div className="av-hall fade-in">
            <div className="hall-head">
                <h1>SALÓN DE LA FAMA</h1>
                <p className="pixel" style={{ fontSize: 10 }}>
                    LOS NOMBRES QUE NUNCA SE BORRAN DE LA PANTALLA
                </p>
            </div>

            <div className="hall-tabs">
                <button className={'chip' + (isGlobal ? ' active' : '')} onClick={() => setTab(GLOBAL_TAB)}>
                    GLOBAL
                </button>
                {games.map((g) => (
                    <button
                        key={g.id}
                        className={'chip' + (tab === g.id ? ' active' : '')}
                        onClick={() => setTab(g.id)}
                    >
                        {g.title}
                    </button>
                ))}
            </div>

            {rows.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 80, color: 'var(--ink-faint)' }}>
                    <div className="pixel" style={{ fontSize: 14, color: 'var(--magenta)', marginBottom: 12 }}>
                        SIN PUNTUACIONES TODAVÍA
                    </div>
                    <div>Sé el primero en aparecer en este ranking.</div>
                </div>
            ) : (
                <>
                    <div className="podium">
                        {rows[1] && (
                            <div className="podium-slot silver">
                                <div className="rank-num">02</div>
                                <div className="name">{rows[1].name}</div>
                                <div className="score">{rows[1].score.toLocaleString('es-ES')}</div>
                                <div className="date">{rows[1].date}</div>
                            </div>
                        )}
                        <div className="podium-slot gold">
                            <div
                                className="pixel"
                                style={{ fontSize: 9, color: 'var(--gold)', letterSpacing: '0.18em' }}
                            >
                                CAMPEÓN
                            </div>
                            <div className="rank-num" style={{ fontSize: 36, marginTop: 4 }}>
                                01
                            </div>
                            <div className="name">{rows[0].name}</div>
                            <div className="score" style={{ fontSize: 20 }}>
                                {rows[0].score.toLocaleString('es-ES')}
                            </div>
                            <div className="date">{rows[0].date}</div>
                        </div>
                        {rows[2] && (
                            <div className="podium-slot bronze">
                                <div className="rank-num">03</div>
                                <div className="name">{rows[2].name}</div>
                                <div className="score">{rows[2].score.toLocaleString('es-ES')}</div>
                                <div className="date">{rows[2].date}</div>
                            </div>
                        )}
                    </div>

                    <div className="hall-table">
                        <div className="th">
                            <div>RANGO</div>
                            <div>JUGADOR</div>
                            <div>PUNTUACIÓN</div>
                            <div>FECHA</div>
                        </div>
                        {rows.map((r, i) => (
                            <div
                                key={r.rank}
                                className={'tr' + (i === 0 ? ' top1' : i === 1 ? ' top2' : i === 2 ? ' top3' : '')}
                                style={{ animationDelay: `${i * 50}ms` }}
                            >
                                <div className="rk">#{String(r.rank).padStart(2, '0')}</div>
                                <div className="pl">{r.name}</div>
                                <div className="sc">{r.score.toLocaleString('es-ES')}</div>
                                <div className="dt">{r.date}</div>
                            </div>
                        ))}
                        {user && game && playerBest && (
                            <>
                                <div className="tr you-label">▸ TU MEJOR MARCA EN {game.title}</div>
                                <div className="tr you" style={{ animationDelay: `${rows.length * 50 + 50}ms` }}>
                                    <div className="rk" style={{ color: 'var(--yellow)' }}>
                                        TÚ
                                    </div>
                                    <div className="pl" style={{ color: 'var(--yellow)' }}>
                                        {user.name}
                                    </div>
                                    <div
                                        className="sc"
                                        style={{ color: 'var(--yellow)', textShadow: '0 0 6px rgba(245,255,0,0.5)' }}
                                    >
                                        {playerBest.score.toLocaleString('es-ES')}
                                    </div>
                                    <div className="dt">{playerBest.date}</div>
                                </div>
                            </>
                        )}
                    </div>
                </>
            )}

            <div style={{ textAlign: 'center', marginTop: 32 }}>
                <Link className="btn lg" href="/">
                    VOLVER A LA BIBLIOTECA
                </Link>
            </div>
        </div>
    );
}
