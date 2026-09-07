import { HallOfFame } from '@/components/hall-of-fame';
import { createClient } from '@/lib/supabase/server';
import { getGames, getGlobalLeaderboard, getGameLeaderboard, getPlayerBestForGame } from '@/lib/supabase/queries';

const TOP_N = 10;

export default async function HallOfFamePage() {
    const [games, globalLeaderboard] = await Promise.all([getGames(), getGlobalLeaderboard(TOP_N)]);

    // Obtener user_id de la sesión del servidor
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    const gameLeaderboardEntries = await Promise.all(
        games.map(async (g) => [g.id, await getGameLeaderboard(g.id, TOP_N)] as const),
    );
    const gameLeaderboards = Object.fromEntries(gameLeaderboardEntries);

    // Si hay sesión, obtener las mejores marcas del jugador autenticado para cada juego
    const playerBestEntries = await Promise.all(
        games.map(async (g) => [g.id, user ? await getPlayerBestForGame(user.id, g.id) : null] as const),
    );
    const playerBestByGame = Object.fromEntries(playerBestEntries);

    return (
        <HallOfFame
            games={games}
            globalLeaderboard={globalLeaderboard}
            gameLeaderboards={gameLeaderboards}
            playerBestByGame={playerBestByGame}
        />
    );
}
