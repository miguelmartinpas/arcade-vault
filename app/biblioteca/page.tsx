import { getGames, getBestScoreForGame } from '@/lib/supabase/queries';
import { LibraryFilters } from '@/components/library-filters';

export default async function Biblioteca() {
    const games = await getGames();
    const bestScores = await Promise.all(games.map((g) => getBestScoreForGame(g.id)));
    const bestByGame = Object.fromEntries(games.map((g, i) => [g.id, bestScores[i]]));

    return (
        <div className="fade-in">
            <section className="av-hero">
                <h1 className="flicker">ARCADE VAULT</h1>
                <div className="sub">
                    INSERTA UNA MONEDA PARA JUGAR <span className="blink">_</span>
                </div>
            </section>

            <LibraryFilters games={games} bestByGame={bestByGame} />
        </div>
    );
}
