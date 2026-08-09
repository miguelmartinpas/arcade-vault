import { notFound } from 'next/navigation';
import Link from 'next/link';
import { cookies } from 'next/headers';
import {
    getGames,
    getGameById,
    getGameLeaderboard,
    getBestScoreForGame,
    getPlayerBestForGame,
} from '@/lib/supabase/queries';

export async function generateStaticParams() {
    const games = await getGames();
    return games.map((g) => ({ id: g.id }));
}

export default async function GameDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const game = await getGameById(id);
    if (!game) notFound();

    const [scores, bestGlobal, cookieStore] = await Promise.all([
        getGameLeaderboard(id, 10),
        getBestScoreForGame(id),
        cookies(),
    ]);

    const rawUserCookie = cookieStore.get('av_user')?.value;
    const userName = rawUserCookie ? decodeURIComponent(rawUserCookie) : null;
    const playerBest = userName ? await getPlayerBestForGame(userName, id) : null;

    return (
        <div className="av-detail fade-in">
            <div>
                <div className="detail-cover">
                    <div className={'cover-bg ' + game.cover}></div>
                </div>
                <div style={{ marginTop: 20 }} className="detail-info">
                    <div className="detail-tags">
                        <span>{game.cat}</span>
                        <span>1 JUGADOR</span>
                        <span>TECLADO / TÁCTIL</span>
                        <span>RETRO 1985</span>
                    </div>
                    <h2 className="neon-cyan">{game.title}</h2>
                    <p>{game.long}</p>
                    <div className="stat-strip">
                        <div>
                            <div className="l">Partidas</div>
                            <div className="v">{game.plays}</div>
                        </div>
                        <div>
                            <div className="l">Mejor global</div>
                            <div
                                className="v"
                                style={{ color: 'var(--magenta)', textShadow: '0 0 6px rgba(255,0,110,0.5)' }}
                            >
                                {bestGlobal !== null ? bestGlobal.toLocaleString('es-ES') : '—'}
                            </div>
                        </div>
                        <div>
                            <div className="l">Dificultad</div>
                            <div
                                className="v"
                                style={{ color: 'var(--yellow)', textShadow: '0 0 6px rgba(245,255,0,0.5)' }}
                            >
                                ★ ★ ★ ☆ ☆
                            </div>
                        </div>
                    </div>
                    <div className="detail-actions">
                        <Link className="btn xl pulse" href={`/juegos/${game.id}/jugar`}>
                            ▶ JUGAR AHORA
                        </Link>
                        <Link className="btn ghost lg" href="/">
                            VOLVER AL VAULT
                        </Link>
                    </div>
                </div>
            </div>

            <aside>
                <div className="leaderboard">
                    <h3>MEJORES PUNTUACIONES</h3>
                    {scores.map((r, i) => (
                        <div
                            key={r.rank}
                            className={'lb-row' + (i === 0 ? ' top1' : i === 1 ? ' top2' : i === 2 ? ' top3' : '')}
                        >
                            <div className="rk">#{String(r.rank).padStart(2, '0')}</div>
                            <div className="pl">
                                {r.name}
                                <div style={{ fontSize: 10, color: 'var(--ink-faint)', letterSpacing: '0.1em' }}>
                                    {r.date}
                                </div>
                            </div>
                            <div className="sc">{r.score.toLocaleString('es-ES')}</div>
                        </div>
                    ))}
                    {playerBest && (
                        <div className="lb-row you">
                            <div className="rk">TÚ</div>
                            <div className="pl">
                                {userName}
                                <div style={{ fontSize: 10, color: 'var(--ink-faint)', letterSpacing: '0.1em' }}>
                                    {playerBest.date}
                                </div>
                            </div>
                            <div className="sc">{playerBest.score.toLocaleString('es-ES')}</div>
                        </div>
                    )}
                </div>
            </aside>
        </div>
    );
}
