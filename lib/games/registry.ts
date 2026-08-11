import type { GameEngineFactory } from '@/lib/games/types';
import { createAsteroidsEngine } from '@/lib/games/asteroids/engine';
import { createTetrisEngine } from '@/lib/games/tetris/engine';

export const GAME_ENGINES: Partial<Record<string, GameEngineFactory>> = {
    asteroides: createAsteroidsEngine,
    tetris: createTetrisEngine,
};
