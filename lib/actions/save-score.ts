'use server';

import { createClient } from '@/lib/supabase/server';

export interface SaveScoreInput {
    gameId: string;
    score: number;
    // Ya NO recibe 'name' — lo obtiene de la sesión
}

export type SaveScoreResult = { ok: true } | { ok: false; error: string };

const SCORE_MIN = 0;
const SCORE_MAX = 10_000_000;

export async function saveScoreAction(input: SaveScoreInput): Promise<SaveScoreResult> {
    // 1. Validar el puntaje
    if (!Number.isInteger(input.score) || input.score < SCORE_MIN || input.score > SCORE_MAX) {
        return { ok: false, error: 'El puntaje no es válido.' };
    }

    const supabase = await createClient();

    // 2. Obtener user_id de la sesión del servidor
    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
        return { ok: false, error: 'Debes iniciar sesión para guardar tu puntaje.' };
    }

    // 3. Validar que el juego existe
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

    // 4. Buscar player_id en players donde user_id = auth.uid()
    const { data: player, error: playerError } = await supabase
        .from('players')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

    if (playerError) {
        console.error('Error al buscar perfil de jugador:', playerError);
        return { ok: false, error: 'No se pudo obtener tu perfil de jugador.' };
    }

    if (!player) {
        return { ok: false, error: 'Perfil de jugador no encontrado.' };
    }

    // 5. Insertar el puntaje con el player_id obtenido
    const { error: scoreError } = await supabase.from('scores').insert({
        game_id: input.gameId,
        player_id: player.id,
        score: input.score,
    });

    if (scoreError) {
        console.error('Error al guardar puntaje:', scoreError);
        return { ok: false, error: 'No se pudo guardar el puntaje.' };
    }

    return { ok: true };
}
