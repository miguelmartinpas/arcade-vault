import { notFound } from 'next/navigation';
import { getGames, getGameById } from '@/lib/supabase/queries';
import { GamePlayer } from '@/components/game-player';

export async function generateStaticParams() {
    const games = await getGames();
    return games.map((g) => ({ id: g.id }));
}

export default async function GamePlayerPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const game = await getGameById(id);
    if (!game) notFound();

    return <GamePlayer game={game} />;
}
