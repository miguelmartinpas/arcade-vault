import { createClient } from './server';
import type { Game } from '@/lib/data';

export type { Game };

export interface LeaderboardRow {
    rank: number;
    name: string;
    score: number;
    date: string;
}

function formatDate(isoDate: string): string {
    const d = new Date(isoDate);
    const day = String(d.getUTCDate()).padStart(2, '0');
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    return `${day}/${month}/${d.getUTCFullYear()}`;
}

export async function getGames(): Promise<Game[]> {
    const supabase = await createClient();
    const { data, error } = await supabase.from('games').select('*').order('created_at', { ascending: true });
    if (error) throw error;
    return (data ?? []) as Game[];
}

export async function getGameById(id: string): Promise<Game | null> {
    const supabase = await createClient();
    const { data, error } = await supabase.from('games').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return (data ?? null) as Game | null;
}

export async function getGlobalLeaderboard(limit: number): Promise<LeaderboardRow[]> {
    const supabase = await createClient();
    const [{ data: scores, error: scoresError }, { data: players, error: playersError }] = await Promise.all([
        supabase.from('scores').select('player_id, score, created_at'),
        supabase.from('players').select('id, name'),
    ]);
    if (scoresError) throw scoresError;
    if (playersError) throw playersError;

    const nameById = new Map((players ?? []).map((p) => [p.id as string, p.name as string]));
    const bestByName = new Map<string, { score: number; created_at: string }>();

    for (const row of scores ?? []) {
        const name = nameById.get(row.player_id as string);
        if (!name) continue;
        const current = bestByName.get(name);
        if (!current || (row.score as number) > current.score) {
            bestByName.set(name, { score: row.score as number, created_at: row.created_at as string });
        }
    }

    return Array.from(bestByName.entries())
        .sort((a, b) => b[1].score - a[1].score)
        .slice(0, limit)
        .map(([name, { score, created_at }], i) => ({
            rank: i + 1,
            name,
            score,
            date: formatDate(created_at),
        }));
}

export async function getGameLeaderboard(gameId: string, limit: number): Promise<LeaderboardRow[]> {
    const supabase = await createClient();
    const { data: scores, error: scoresError } = await supabase
        .from('scores')
        .select('player_id, score, created_at')
        .eq('game_id', gameId)
        .order('score', { ascending: false })
        .limit(limit);
    if (scoresError) throw scoresError;
    if (!scores || scores.length === 0) return [];

    const playerIds = [...new Set(scores.map((s) => s.player_id as string))];
    const { data: players, error: playersError } = await supabase
        .from('players')
        .select('id, name')
        .in('id', playerIds);
    if (playersError) throw playersError;

    const nameById = new Map((players ?? []).map((p) => [p.id as string, p.name as string]));

    return scores.map((row, i) => ({
        rank: i + 1,
        name: nameById.get(row.player_id as string) ?? '???',
        score: row.score as number,
        date: formatDate(row.created_at as string),
    }));
}

export async function getBestScoreForGame(gameId: string): Promise<number | null> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('scores')
        .select('score')
        .eq('game_id', gameId)
        .order('score', { ascending: false })
        .limit(1)
        .maybeSingle();
    if (error) throw error;
    return (data?.score as number | undefined) ?? null;
}

export async function getPlayerBestForGame(
    userId: string,
    gameId: string,
): Promise<{ score: number; date: string } | null> {
    const supabase = await createClient();
    const { data: player, error: playerError } = await supabase
        .from('players')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();
    if (playerError) throw playerError;
    if (!player) return null;

    const { data: score, error: scoreError } = await supabase
        .from('scores')
        .select('score, created_at')
        .eq('game_id', gameId)
        .eq('player_id', player.id)
        .order('score', { ascending: false })
        .limit(1)
        .maybeSingle();
    if (scoreError) throw scoreError;
    if (!score) return null;

    return { score: score.score as number, date: formatDate(score.created_at as string) };
}
