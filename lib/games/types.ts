export interface GameEngineCallbacks {
    onScoreChange: (score: number) => void;
    onLivesChange: (lives: number) => void;
    onLevelChange: (level: number) => void;
    onGameOver: (finalScore: number) => void;
}

export interface GameEngineHandle {
    pause: () => void;
    resume: () => void;
    restart: () => void;
    destroy: () => void;
}

export type GameEngineFactory = (canvas: HTMLCanvasElement, callbacks: GameEngineCallbacks) => GameEngineHandle;
