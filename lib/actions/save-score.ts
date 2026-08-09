'use server';

import { createClient } from '@/lib/supabase/server';

export interface SaveScoreInput {
    gameId: string;
    name: string;
    score: number;
}

export type SaveScoreResult = { ok: true } | { ok: false; error: string };

const NAME_MAX_LENGTH = 12;
const SCORE_MIN = 0;
const SCORE_MAX = 10_000_000;

export async function saveScoreAction(input: SaveScoreInput): Promise<SaveScoreResult> {
    const name = input.name.trim();
    if (name.length < 1 || name.length > NAME_MAX_LENGTH) {
        return { ok: false, error: `El nombre debe tener entre 1 y ${NAME_MAX_LENGTH} caracteres.` };
    }

    if (!Number.isInteger(input.score) || input.score < SCORE_MIN || input.score > SCORE_MAX) {
        return { ok: false, error: 'El puntaje no es válido.' };
    }

    const supabase = await createClient();

    const { data: game, error: gameError } = await supabase
        .from('games')
        .select('id')
        .eq('id', input.gameId)
        .maybeSingle();
    if (gameError) {
        return { ok: false, error: 'No se pudo validar el juego.' };
    }
    if (!game) {
        return { ok: false, error: 'El juego no existe.' };
    }

    const { error: upsertError } = await supabase
        .from('players')
        .upsert({ name }, { onConflict: 'name', ignoreDuplicates: true });
    if (upsertError) {
        return { ok: false, error: 'No se pudo registrar el jugador.' };
    }

    const { data: player, error: playerError } = await supabase
        .from('players')
        .select('id')
        .eq('name', name)
        .maybeSingle();
    if (playerError || !player) {
        return { ok: false, error: 'No se pudo registrar el jugador.' };
    }

    const { error: scoreError } = await supabase.from('scores').insert({
        game_id: input.gameId,
        player_id: player.id,
        score: input.score,
    });
    if (scoreError) {
        return { ok: false, error: 'No se pudo guardar el puntaje.' };
    }

    return { ok: true };
}
