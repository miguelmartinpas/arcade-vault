export interface Game {
    id: string;
    title: string;
    short: string;
    long: string;
    cat: 'ARCADE' | 'PUZZLE' | 'SHOOTER' | 'VERSUS';
    cover: string;
    color: 'cyan' | 'magenta' | 'green' | 'yellow';
    plays: string;
}

export const CATS = ['TODOS', 'ARCADE', 'PUZZLE', 'SHOOTER', 'VERSUS'] as const;

export interface ActivityEntry {
    player: string;
    game: string;
    score: number;
    timeAgo: string;
    color: 'cyan' | 'magenta' | 'green' | 'yellow';
}

export const RECENT_ACTIVITY: ActivityEntry[] = [
    { player: 'NEONFOX', game: 'Tetris', score: 184220, timeAgo: 'hace 2 min', color: 'magenta' },
    { player: 'PX_KAI', game: 'Glotón', score: 96400, timeAgo: 'hace 5 min', color: 'yellow' },
    { player: 'Z3R0COOL', game: 'Invasores', score: 54190, timeAgo: 'hace 8 min', color: 'green' },
    { player: 'VAULT_07', game: 'Asteroides', score: 41200, timeAgo: 'hace 12 min', color: 'cyan' },
    { player: 'GLITCHA', game: 'Bloque Buster', score: 28450, timeAgo: 'hace 18 min', color: 'cyan' },
    { player: 'ARKADYA', game: 'Serpentina', score: 7820, timeAgo: 'hace 24 min', color: 'green' },
    { player: 'CYBER_LU', game: 'Ranaria', score: 18900, timeAgo: 'hace 31 min', color: 'yellow' },
];
