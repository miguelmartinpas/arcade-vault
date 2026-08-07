import type { GameEngineFactory } from '@/lib/games/types';
import { createAsteroidsEngine } from '@/lib/games/asteroids/engine';

export const GAME_ENGINES: Partial<Record<string, GameEngineFactory>> = {
    asteroides: createAsteroidsEngine,
};
