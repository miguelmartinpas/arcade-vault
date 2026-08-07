import type { GameEngineFactory } from '@/lib/games/types';

const W = 800;
const H = 600;

const wrap = (v: number, max: number) => ((v % max) + max) % max;
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const rand = (min: number, max: number) => min + Math.random() * (max - min);
const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1));

const POWERUP_DROP_CHANCE = 0.15;
const POWERUP_DURATION = 5;
const POWERUP_TTL = 12;
const TRIPLE_SPREAD = 0.18;

const RADII = [0, 16, 30, 50]; // por tamaño 1, 2, 3
const SPEEDS = [0, 85, 55, 32];
const POINTS = [0, 100, 50, 20];

const GAME_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'Space']);

type GameState = 'playing' | 'dead' | 'gameover';

class Bullet {
    x: number;
    y: number;
    vx: number;
    vy: number;
    ttl: number;
    radius: number;
    dead: boolean;

    constructor(x: number, y: number, angle: number) {
        this.x = x;
        this.y = y;
        const SPEED = 520;
        this.vx = Math.cos(angle) * SPEED;
        this.vy = Math.sin(angle) * SPEED;
        this.ttl = 1.1;
        this.radius = 2;
        this.dead = false;
    }

    update(dt: number) {
        this.x = wrap(this.x + this.vx * dt, W);
        this.y = wrap(this.y + this.vy * dt, H);
        this.ttl -= dt;
        if (this.ttl <= 0) this.dead = true;
    }

    draw(ctx: CanvasRenderingContext2D) {
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
    }
}

class Asteroid {
    x: number;
    y: number;
    size: number;
    radius: number;
    dead: boolean;
    vx: number;
    vy: number;
    rotSpeed: number;
    rot: number;
    verts: number[][];

    constructor(x: number, y: number, size = 3) {
        this.x = x;
        this.y = y;
        this.size = size;
        this.radius = RADII[size];
        this.dead = false;

        const angle = rand(0, Math.PI * 2);
        const speed = SPEEDS[size] + rand(-15, 15);
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.rotSpeed = rand(-1.2, 1.2);
        this.rot = rand(0, Math.PI * 2);

        const n = randInt(8, 13);
        this.verts = [];
        for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2;
            const r = this.radius * rand(0.6, 1.0);
            this.verts.push([Math.cos(a) * r, Math.sin(a) * r]);
        }
    }

    update(dt: number) {
        this.x = wrap(this.x + this.vx * dt, W);
        this.y = wrap(this.y + this.vy * dt, H);
        this.rot += this.rotSpeed * dt;
    }

    split(): Asteroid[] {
        if (this.size <= 1) return [];
        return [new Asteroid(this.x, this.y, this.size - 1), new Asteroid(this.x, this.y, this.size - 1)];
    }

    draw(ctx: CanvasRenderingContext2D) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rot);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(this.verts[0][0], this.verts[0][1]);
        for (let i = 1; i < this.verts.length; i++) ctx.lineTo(this.verts[i][0], this.verts[i][1]);
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
    }
}

class PowerUp {
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
    ttl: number;
    dead: boolean;

    constructor(x: number, y: number) {
        this.x = x;
        this.y = y;
        const angle = rand(0, Math.PI * 2);
        const speed = rand(20, 40);
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.radius = 12;
        this.ttl = POWERUP_TTL;
        this.dead = false;
    }

    update(dt: number) {
        this.x = wrap(this.x + this.vx * dt, W);
        this.y = wrap(this.y + this.vy * dt, H);
        this.ttl -= dt;
        if (this.ttl <= 0) this.dead = true;
    }

    draw(ctx: CanvasRenderingContext2D) {
        if (this.ttl < 2 && Math.floor(this.ttl * 8) % 2 === 0) return;
        const pulse = 0.85 + Math.sin(performance.now() / 150) * 0.15;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(Math.PI / 4);
        ctx.strokeStyle = '#0ff';
        ctx.lineWidth = 2;
        const r = this.radius * pulse;
        ctx.strokeRect(-r, -r, r * 2, r * 2);
        ctx.restore();
        ctx.fillStyle = '#0ff';
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('3x', this.x, this.y);
    }
}

class Ship {
    x = 0;
    y = 0;
    angle = 0;
    vx = 0;
    vy = 0;
    radius = 12;
    thrusting = false;
    invincible = 0;
    shootCooldown = 0;
    dead = false;
    tripleShot = 0;

    constructor() {
        this.reset();
    }

    reset() {
        this.x = W / 2;
        this.y = H / 2;
        this.angle = -Math.PI / 2;
        this.vx = 0;
        this.vy = 0;
        this.radius = 12;
        this.thrusting = false;
        this.invincible = 3;
        this.shootCooldown = 0;
        this.dead = false;
    }

    update(dt: number, keys: Record<string, boolean>) {
        if (this.dead) return;
        if (this.invincible > 0) this.invincible -= dt;
        if (this.shootCooldown > 0) this.shootCooldown -= dt;
        if (this.tripleShot > 0) this.tripleShot -= dt;

        const ROT = 3.5; // rad/s
        const THRUST = 260; // px/s²
        const DRAG = 0.987;

        if (keys['ArrowLeft']) this.angle -= ROT * dt;
        if (keys['ArrowRight']) this.angle += ROT * dt;

        this.thrusting = !!keys['ArrowUp'];
        if (this.thrusting) {
            this.vx += Math.cos(this.angle) * THRUST * dt;
            this.vy += Math.sin(this.angle) * THRUST * dt;
        }

        this.vx *= DRAG;
        this.vy *= DRAG;
        this.x = wrap(this.x + this.vx * dt, W);
        this.y = wrap(this.y + this.vy * dt, H);
    }

    tryShoot(): Bullet[] {
        if (this.shootCooldown > 0 || this.dead) return [];
        this.shootCooldown = 0.2;
        const NOSE = 21;
        const ox = this.x + Math.cos(this.angle) * NOSE;
        const oy = this.y + Math.sin(this.angle) * NOSE;
        if (this.tripleShot > 0) {
            return [
                new Bullet(ox, oy, this.angle - TRIPLE_SPREAD),
                new Bullet(ox, oy, this.angle),
                new Bullet(ox, oy, this.angle + TRIPLE_SPREAD),
            ];
        }
        return [new Bullet(ox, oy, this.angle)];
    }

    draw(ctx: CanvasRenderingContext2D) {
        if (this.dead) return;
        if (this.invincible > 0 && Math.floor(this.invincible * 8) % 2 === 0) return;

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.lineJoin = 'round';

        ctx.beginPath();
        ctx.moveTo(20, 0);
        ctx.lineTo(-12, -9);
        ctx.lineTo(-7, 0);
        ctx.lineTo(-12, 9);
        ctx.closePath();
        ctx.stroke();

        if (this.thrusting && Math.random() > 0.35) {
            ctx.beginPath();
            ctx.moveTo(-8, -4);
            ctx.lineTo(-8 - rand(6, 14), 0);
            ctx.lineTo(-8, 4);
            ctx.strokeStyle = 'rgba(255, 130, 0, 0.85)';
            ctx.stroke();
        }

        ctx.restore();
    }
}

class Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    ttl: number;
    dead: boolean;

    constructor(x: number, y: number) {
        this.x = x;
        this.y = y;
        const angle = rand(0, Math.PI * 2);
        const speed = rand(30, 130);
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.life = rand(0.4, 1.1);
        this.ttl = this.life;
        this.dead = false;
    }

    update(dt: number) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.ttl -= dt;
        if (this.ttl <= 0) this.dead = true;
    }

    draw(ctx: CanvasRenderingContext2D) {
        const alpha = this.ttl / this.life;
        ctx.strokeStyle = `rgba(255,255,255,${alpha.toFixed(2)})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x - this.vx * 0.05, this.y - this.vy * 0.05);
        ctx.stroke();
    }
}

export const createAsteroidsEngine: GameEngineFactory = (canvas, callbacks) => {
    const maybeCtx = canvas.getContext('2d');
    if (!maybeCtx) {
        throw new Error('No se pudo obtener el contexto 2D del canvas');
    }
    const ctx: CanvasRenderingContext2D = maybeCtx;

    canvas.width = W;
    canvas.height = H;

    const keys: Record<string, boolean> = {};
    const justPressed: Record<string, boolean> = {};

    const handleKeyDown = (e: KeyboardEvent) => {
        if (GAME_KEYS.has(e.code)) e.preventDefault();
        if (!keys[e.code]) justPressed[e.code] = true;
        keys[e.code] = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
        keys[e.code] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    const pressed = (code: string) => {
        const val = justPressed[code];
        justPressed[code] = false;
        return val;
    };

    let ship!: Ship;
    let bullets: Bullet[] = [];
    let asteroids: Asteroid[] = [];
    let particles: Particle[] = [];
    let powerUps: PowerUp[] = [];
    let score = 0;
    let lives = 3;
    let level = 1;
    let state: GameState = 'playing';
    let deadTimer = 0;
    let powerUpSpawned = false;
    let killsSinceSpawn = 0;

    const setScore = (value: number) => {
        score = value;
        callbacks.onScoreChange(score);
    };
    const addScore = (delta: number) => setScore(score + delta);
    const setLives = (value: number) => {
        lives = value;
        callbacks.onLivesChange(lives);
    };
    const setLevel = (value: number) => {
        level = value;
        callbacks.onLevelChange(level);
    };

    function spawnAsteroids(count: number) {
        const SAFE_DIST = 130;
        for (let i = 0; i < count; i++) {
            let x: number, y: number;
            do {
                x = rand(0, W);
                y = rand(0, H);
            } while (Math.hypot(x - W / 2, y - H / 2) < SAFE_DIST);
            asteroids.push(new Asteroid(x, y, 3));
        }
    }

    function initGame() {
        ship = new Ship();
        bullets = [];
        asteroids = [];
        particles = [];
        powerUps = [];
        powerUpSpawned = false;
        killsSinceSpawn = 0;
        state = 'playing';
        setScore(0);
        setLives(3);
        setLevel(1);
        spawnAsteroids(4);
    }

    function nextLevel() {
        setLevel(level + 1);
        bullets = [];
        particles = [];
        powerUps = [];
        powerUpSpawned = false;
        killsSinceSpawn = 0;
        ship.reset();
        spawnAsteroids(3 + level);
    }

    function explode(x: number, y: number, count = 8) {
        for (let i = 0; i < count; i++) particles.push(new Particle(x, y));
    }

    function killShip() {
        explode(ship.x, ship.y, 14);
        ship.dead = true;
        setLives(lives - 1);
        if (lives <= 0) {
            state = 'gameover';
            callbacks.onGameOver(score);
        } else {
            state = 'dead';
            deadTimer = 2;
        }
    }

    function update(dt: number) {
        if (state === 'gameover') {
            // El motor deja de aceptar input; el reinicio ahora lo dispara `restart()`.
            particles.forEach((p) => p.update(dt));
            particles = particles.filter((p) => !p.dead);
            return;
        }

        if (state === 'dead') {
            deadTimer -= dt;
            particles.forEach((p) => p.update(dt));
            particles = particles.filter((p) => !p.dead);
            asteroids.forEach((a) => a.update(dt));
            if (deadTimer <= 0) {
                state = 'playing';
                ship.reset();
            }
            return;
        }

        if (pressed('Space')) {
            bullets.push(...ship.tryShoot());
        }

        ship.update(dt, keys);
        bullets.forEach((b) => b.update(dt));
        asteroids.forEach((a) => a.update(dt));
        particles.forEach((p) => p.update(dt));
        powerUps.forEach((p) => p.update(dt));

        bullets = bullets.filter((b) => !b.dead);
        particles = particles.filter((p) => !p.dead);
        powerUps = powerUps.filter((p) => !p.dead);

        for (const p of powerUps) {
            if (!p.dead && dist(ship, p) < ship.radius + p.radius) {
                p.dead = true;
                ship.tripleShot = POWERUP_DURATION;
            }
        }

        const newAsteroids: Asteroid[] = [];
        for (const b of bullets) {
            for (const a of asteroids) {
                if (!a.dead && !b.dead && dist(b, a) < a.radius) {
                    b.dead = true;
                    a.dead = true;
                    addScore(POINTS[a.size]);
                    explode(a.x, a.y, a.size * 5);
                    newAsteroids.push(...a.split());
                    if (!powerUpSpawned) {
                        killsSinceSpawn++;
                        const guaranteed = killsSinceSpawn >= 5;
                        if (guaranteed || Math.random() < POWERUP_DROP_CHANCE) {
                            powerUps.push(new PowerUp(a.x, a.y));
                            powerUpSpawned = true;
                        }
                    }
                }
            }
        }
        asteroids = asteroids.filter((a) => !a.dead).concat(newAsteroids);
        bullets = bullets.filter((b) => !b.dead);

        if (ship.invincible <= 0) {
            for (const a of asteroids) {
                if (dist(ship, a) < ship.radius + a.radius * 0.82) {
                    killShip();
                    break;
                }
            }
        }

        if (asteroids.length === 0) nextLevel();
    }

    function drawLifeIcon(x: number, y: number) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(-Math.PI / 2);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.2;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(9, 0);
        ctx.lineTo(-6, -5);
        ctx.lineTo(-3, 0);
        ctx.lineTo(-6, 5);
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
    }

    function drawHUD() {
        ctx.fillStyle = '#fff';
        ctx.font = '15px monospace';

        ctx.textAlign = 'left';
        ctx.fillText(`SCORE  ${score}`, 14, 26);

        ctx.textAlign = 'center';
        ctx.fillText(`NIVEL ${level}`, W / 2, 26);

        for (let i = 0; i < lives; i++) drawLifeIcon(W - 16 - i * 22, 18);

        if (ship.tripleShot > 0) {
            ctx.textAlign = 'left';
            ctx.fillStyle = '#0ff';
            ctx.fillText(`3x  ${ship.tripleShot.toFixed(1)}s`, 14, 46);
        }
    }

    function draw() {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, W, H);

        particles.forEach((p) => p.draw(ctx));
        asteroids.forEach((a) => a.draw(ctx));
        powerUps.forEach((p) => p.draw(ctx));
        bullets.forEach((b) => b.draw(ctx));
        ship.draw(ctx);

        drawHUD();
    }

    let rafId: number | null = null;
    let lastTime: number | null = null;
    let running = false;

    function loop(ts: number) {
        if (!running) return;
        const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
        lastTime = ts;
        update(dt);
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
            window.removeEventListener('keyup', handleKeyUp);
        },
    };
};
