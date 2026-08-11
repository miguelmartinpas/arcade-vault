import type { GameEngineFactory } from '@/lib/games/types';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const BOARD_W = COLS * BLOCK; // 300
const BOARD_H = ROWS * BLOCK; // 600

const W = 800;
const H = 600;

const BOARD_X = 60;
const BOARD_Y = 0;

const NEXT_BLOCK = 30;
const NEXT_BOX_SIZE = 4 * NEXT_BLOCK; // 120
const NEXT_X = 520;
const NEXT_Y = 130;

const COLORS: (string | null)[] = [
    null,
    '#4dd0e1', // I - cyan
    '#ffd54f', // O - yellow
    '#ba68c8', // T - purple
    '#81c784', // S - green
    '#e57373', // Z - red
    '#90caf9', // J - pale blue
    '#ffb74d', // L - orange
    '#9e9e9e', // N - tuerca (gris metálico)
];

const PIECES: (number[][] | null)[] = [
    null,
    [
        [0, 0, 0, 0],
        [1, 1, 1, 1],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
    ], // I
    [
        [2, 2],
        [2, 2],
    ], // O
    [
        [0, 3, 0],
        [3, 3, 3],
        [0, 0, 0],
    ], // T
    [
        [0, 4, 4],
        [4, 4, 0],
        [0, 0, 0],
    ], // S
    [
        [5, 5, 0],
        [0, 5, 5],
        [0, 0, 0],
    ], // Z
    [
        [6, 0, 0],
        [6, 6, 6],
        [0, 0, 0],
    ], // J
    [
        [0, 0, 7],
        [7, 7, 7],
        [0, 0, 0],
    ] // L
    // [
    //     [8, 8, 8],
    //     [8, 0, 8],
    //     [8, 8, 8],
    // ], // N (tuerca)
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const GAME_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space']);

interface Piece {
    type: number;
    shape: number[][];
    x: number;
    y: number;
}

export const createTetrisEngine: GameEngineFactory = (canvas, callbacks) => {
    const maybeCtx = canvas.getContext('2d');
    if (!maybeCtx) {
        throw new Error('No se pudo obtener el contexto 2D del canvas');
    }
    const ctx: CanvasRenderingContext2D = maybeCtx;

    canvas.width = W;
    canvas.height = H;

    let board: number[][] = [];
    let current!: Piece;
    let next!: Piece;
    let score = 0;
    let lines = 0;
    let level = 1;
    let dropInterval = 1000;
    let dropAccum = 0;
    let gameOver = false;

    const setScore = (value: number) => {
        score = value;
        callbacks.onScoreChange(score);
    };
    const addScore = (delta: number) => setScore(score + delta);
    const setLevel = (value: number) => {
        level = value;
        callbacks.onLevelChange(level);
    };

    function createBoard(): number[][] {
        return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
    }

    function randomPiece(): Piece {
        const type = Math.floor(Math.random() * 7) + 1;
        const shape = (PIECES[type] as number[][]).map((row) => [...row]);
        return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
    }

    function collide(shape: number[][], ox: number, oy: number): boolean {
        for (let r = 0; r < shape.length; r++) {
            for (let c = 0; c < shape[r].length; c++) {
                if (!shape[r][c]) continue;
                const nx = ox + c;
                const ny = oy + r;
                if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
                if (ny >= 0 && board[ny][nx]) return true;
            }
        }
        return false;
    }

    function rotateCW(shape: number[][]): number[][] {
        const rows = shape.length;
        const cols = shape[0].length;
        const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                result[c][rows - 1 - r] = shape[r][c];
            }
        }
        return result;
    }

    function tryRotate() {
        const rotated = rotateCW(current.shape);
        const kicks = [0, -1, 1, -2, 2];
        for (const kick of kicks) {
            if (!collide(rotated, current.x + kick, current.y)) {
                current.shape = rotated;
                current.x += kick;
                return;
            }
        }
    }

    function merge() {
        for (let r = 0; r < current.shape.length; r++) {
            for (let c = 0; c < current.shape[r].length; c++) {
                if (current.shape[r][c]) {
                    board[current.y + r][current.x + c] = current.shape[r][c];
                }
            }
        }
    }

    function clearLines() {
        let cleared = 0;
        for (let r = ROWS - 1; r >= 0; r--) {
            if (board[r].every((v) => v !== 0)) {
                board.splice(r, 1);
                board.unshift(new Array(COLS).fill(0));
                cleared++;
                r++;
            }
        }
        if (cleared) {
            lines += cleared;
            addScore((LINE_SCORES[cleared] || 0) * level);
            const newLevel = Math.floor(lines / 10) + 1;
            if (newLevel !== level) setLevel(newLevel);
            dropInterval = Math.max(100, 1000 - (level - 1) * 90);
        }
    }

    function ghostY(): number {
        let gy = current.y;
        while (!collide(current.shape, current.x, gy + 1)) gy++;
        return gy;
    }

    function hardDrop() {
        const gy = ghostY();
        addScore((gy - current.y) * 2);
        current.y = gy;
        lockPiece();
    }

    function softDrop() {
        if (!collide(current.shape, current.x, current.y + 1)) {
            current.y++;
            addScore(1);
        } else {
            lockPiece();
        }
    }

    function lockPiece() {
        merge();
        clearLines();
        spawn();
    }

    function spawn() {
        current = next;
        next = randomPiece();
        if (collide(current.shape, current.x, current.y)) {
            endGame();
        }
    }

    function endGame() {
        gameOver = true;
        callbacks.onGameOver(score);
    }

    function drawBlock(
        context: CanvasRenderingContext2D,
        originX: number,
        originY: number,
        gx: number,
        gy: number,
        colorIndex: number,
        size: number,
        alpha?: number,
    ) {
        if (!colorIndex) return;
        context.globalAlpha = alpha ?? 1;
        context.fillStyle = COLORS[colorIndex] as string;
        context.fillRect(originX + gx * size + 1, originY + gy * size + 1, size - 2, size - 2);
        context.fillStyle = 'rgba(255,255,255,0.12)';
        context.fillRect(originX + gx * size + 1, originY + gy * size + 1, size - 2, 4);
        context.globalAlpha = 1;
    }

    function drawBoardGrid() {
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 0.5;
        for (let c = 1; c < COLS; c++) {
            ctx.beginPath();
            ctx.moveTo(BOARD_X + c * BLOCK, BOARD_Y);
            ctx.lineTo(BOARD_X + c * BLOCK, BOARD_Y + BOARD_H);
            ctx.stroke();
        }
        for (let r = 1; r < ROWS; r++) {
            ctx.beginPath();
            ctx.moveTo(BOARD_X, BOARD_Y + r * BLOCK);
            ctx.lineTo(BOARD_X + BOARD_W, BOARD_Y + r * BLOCK);
            ctx.stroke();
        }
    }

    function drawBoard() {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 1;
        ctx.strokeRect(BOARD_X - 1, BOARD_Y + 0.5, BOARD_W + 1, BOARD_H - 1);
        ctx.restore();

        drawBoardGrid();

        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                drawBlock(ctx, BOARD_X, BOARD_Y, c, r, board[r][c], BLOCK);
            }
        }

        const gy = ghostY();
        for (let r = 0; r < current.shape.length; r++) {
            for (let c = 0; c < current.shape[r].length; c++) {
                if (current.shape[r][c])
                    drawBlock(ctx, BOARD_X, BOARD_Y, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);
            }
        }

        for (let r = 0; r < current.shape.length; r++) {
            for (let c = 0; c < current.shape[r].length; c++) {
                drawBlock(ctx, BOARD_X, BOARD_Y, current.x + c, current.y + r, current.shape[r][c], BLOCK);
            }
        }
    }

    function drawNextPreview() {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 1;
        ctx.strokeRect(NEXT_X - 1, NEXT_Y - 1, NEXT_BOX_SIZE + 2, NEXT_BOX_SIZE + 2);
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.font = '13px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('SIGUIENTE', NEXT_X + NEXT_BOX_SIZE / 2, NEXT_Y - 14);
        ctx.restore();

        const shape = next.shape;
        const offX = Math.floor((4 - shape[0].length) / 2);
        const offY = Math.floor((4 - shape.length) / 2);
        for (let r = 0; r < shape.length; r++) {
            for (let c = 0; c < shape[r].length; c++) {
                drawBlock(ctx, NEXT_X, NEXT_Y, offX + c, offY + r, shape[r][c], NEXT_BLOCK);
            }
        }
    }

    function draw() {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, W, H);
        drawBoard();
        drawNextPreview();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
        if (GAME_KEYS.has(e.code)) e.preventDefault();
        if (!running) return;
        switch (e.code) {
            case 'ArrowLeft':
                if (!collide(current.shape, current.x - 1, current.y)) current.x--;
                break;
            case 'ArrowRight':
                if (!collide(current.shape, current.x + 1, current.y)) current.x++;
                break;
            case 'ArrowDown':
                softDrop();
                break;
            case 'ArrowUp':
            case 'KeyX':
                tryRotate();
                break;
            case 'Space':
                hardDrop();
                break;
            default:
                break;
        }
    };

    window.addEventListener('keydown', handleKeyDown);

    let rafId: number | null = null;
    let lastTime: number | null = null;
    let running = false;

    function loop(ts: number) {
        if (!running) return;
        const dt = lastTime === null ? 0 : Math.min(ts - lastTime, 50);
        lastTime = ts;

        dropAccum += dt;
        if (dropAccum >= dropInterval) {
            dropAccum = 0;
            if (!collide(current.shape, current.x, current.y + 1)) {
                current.y++;
            } else {
                lockPiece();
            }
        }

        if (gameOver) {
            running = false;
            return;
        }

        draw();
        rafId = requestAnimationFrame(loop);
    }

    function startLoop() {
        if (running) return;
        running = true;
        lastTime = null;
        rafId = requestAnimationFrame(loop);
    }

    function stopLoop() {
        running = false;
        if (rafId !== null) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
    }

    function initGame() {
        board = createBoard();
        dropInterval = 1000;
        dropAccum = 0;
        gameOver = false;
        next = randomPiece();
        spawn();
        setScore(0);
        setLevel(1);
        lines = 0;
        callbacks.onLivesChange(1);
    }

    initGame();
    startLoop();

    return {
        pause: stopLoop,
        resume: startLoop,
        restart: () => {
            initGame();
            startLoop();
        },
        destroy: () => {
            stopLoop();
            window.removeEventListener('keydown', handleKeyDown);
        },
    };
};
