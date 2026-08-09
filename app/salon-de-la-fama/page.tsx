import { cookies } from 'next/headers';
import { HallOfFame } from '@/components/hall-of-fame';
import { getGames, getGlobalLeaderboard, getGameLeaderboard, getPlayerBestForGame } from '@/lib/supabase/queries';

const TOP_N = 10;

export default async function HallOfFamePage() {
    const [games, globalLeaderboard, cookieStore] = await Promise.all([
        getGames(),
        getGlobalLeaderboard(TOP_N),
        cookies(),
    ]);

    const rawUserCookie = cookieStore.get('av_user')?.value;
    const userName = rawUserCookie ? decodeURIComponent(rawUserCookie) : null;

    const gameLeaderboardEntries = await Promise.all(
        games.map(async (g) => [g.id, await getGameLeaderboard(g.id, TOP_N)] as const),
    );
    const gameLeaderboards = Object.fromEntries(gameLeaderboardEntries);

    const playerBestEntries = await Promise.all(
        games.map(async (g) => [g.id, userName ? await getPlayerBestForGame(userName, g.id) : null] as const),
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
