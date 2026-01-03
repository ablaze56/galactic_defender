const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const creditsEl = document.getElementById('credits');
const livesEl = document.getElementById('lives');
const startScreen = document.getElementById('start-screen');
const lobbyScreen = document.getElementById('lobby-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const finalScoreEl = document.getElementById('final-score');
const pilotNameEl = document.getElementById('pilot-name');

const loginScreen = document.getElementById('login-screen');
const loginBtn = document.getElementById('login-btn');
const usernameInput = document.getElementById('username-input');

const startBtn = document.getElementById('start-btn');
const lobbyBtn = document.getElementById('lobby-btn');
const backBtn = document.getElementById('back-btn');
const restartBtn = document.getElementById('restart-btn');
const goToLobbyBtn = document.getElementById('go-to-lobby-btn');

const upgradeFRBtn = document.getElementById('upgrade-firerate');
const upgradeDMGBtn = document.getElementById('upgrade-damage');
const upgradeSideBtn = document.getElementById('upgrade-sidecannons');

// Game State
let score = 0;
let credits = 0;
let lives = 3;
let gameRunning = false;

// Upgrade State
let fireRateLevel = 0;
let damageLevel = 1;
let sideCannonsLevel = 0; // 0: None, 1: Single pair, 2: Double pair?
let upgradeCosts = {
    fireRate: 500,
    damage: 1000,
    sideCannons: 5000
};
let stock = [];
let nextStockRefresh = 0; // Timestamp
let playerStats = {
    critChance: 0,
    magnetRange: 0,
    bonusCredits: 0,
    shieldCapacity: 0,
    projectileSize: 0,
    speedMultiplier: 1
};
let animationId;
let player;
let projectiles = [];
let enemyProjectiles = [];
let enemies = [];
let particles = [];
let powerups = [];
let planets = [];
let keys = {};

// --- STOCK SYSTEM DATA ---
const STOCK_RARITIES = [
    { id: 'black-hole', name: 'Black Hole', count: 5, colorClass: 'rarity-black-hole', baseCost: 100000 },
    { id: 'star', name: 'Star', count: 10, colorClass: 'rarity-star', baseCost: 25000 },
    { id: 'super-rare', name: 'Super Rare', count: 15, colorClass: 'rarity-super-rare', baseCost: 10000 },
    { id: 'rare', name: 'Rare', count: 20, colorClass: 'rarity-rare', baseCost: 5000 },
    { id: 'uncommon', name: 'Uncommon', count: 25, colorClass: 'rarity-uncommon', baseCost: 2000 },
    { id: 'common', name: 'Common', count: 30, colorClass: 'rarity-common', baseCost: 500 }
];

const STOCK_UPGRADE_TYPES = [
    { id: 'crit', name: 'Precision Module', desc: '+5% Crit Chance', stat: 'critChance', val: 0.05 },
    { id: 'magnet', name: 'Resource Magnet', desc: '+100 Magnet Range', stat: 'magnetRange', val: 100 },
    { id: 'credits', name: 'Wealth Protocol', desc: '+10% Credit Gain', stat: 'bonusCredits', val: 0.1 },
    { id: 'speed', name: 'Overdrive Engine', desc: '+10% Speed', stat: 'speedMultiplier', val: 0.1 },
    { id: 'projectile', name: 'Heavy Rounds', desc: '+10% Bullet Size', stat: 'projectileSize', val: 0.1 },
    { id: 'shield', name: 'Reinforced Hull', desc: '+1 Shield Capacity', stat: 'shieldCapacity', val: 1 }
];

function generateStock() {
    stock = [];
    STOCK_RARITIES.forEach(rarity => {
        for (let i = 0; i < rarity.count; i++) {
            const type = STOCK_UPGRADE_TYPES[Math.floor(Math.random() * STOCK_UPGRADE_TYPES.length)];
            const variance = 0.8 + Math.random() * 0.4;
            const cost = Math.floor(rarity.baseCost * variance);
            stock.push({
                id: Math.random().toString(36).substr(2, 9),
                rarity: rarity,
                type: type,
                cost: cost,
                purchased: false
            });
        }
    });
    const rarityOrder = ['black-hole', 'star', 'super-rare', 'rare', 'uncommon', 'common'];
    stock.sort((a, b) => rarityOrder.indexOf(a.rarity.id) - rarityOrder.indexOf(b.rarity.id));
    nextStockRefresh = Date.now() + (10 * 60 * 1000);
    saveData();
    updateStockUI();
}

function updateStockUI() {
    const container = document.getElementById('stock-items');
    if (!container) return;
    container.innerHTML = '';

    const availableItems = stock.filter(item => !item.purchased);
    if (availableItems.length === 0) {
        container.innerHTML = '<div style="padding: 20px; text-align: center; opacity: 0.5;">[ EVERYTHING SOLD OUT ]</div>';
        return;
    }

    availableItems.forEach(item => {
        const itemEl = document.createElement('div');
        itemEl.className = `stock-item ${item.rarity.colorClass}`;
        itemEl.innerHTML = `
            <div class="stock-item-info">
                <h4>${item.type.name}</h4>
                <div class="stock-rarity-text">${item.rarity.name}</div>
                <span>${item.type.desc}</span>
            </div>
            <button class="upgrade-btn stock-buy-btn">
                ${item.cost} CR
            </button>
        `;
        itemEl.querySelector('.stock-buy-btn').onclick = () => buyStockItem(item.id);
        container.appendChild(itemEl);
    });
}

function buyStockItem(itemId) {
    const item = stock.find(i => i.id === itemId);
    if (item && !item.purchased && credits >= item.cost) {
        credits -= item.cost;
        item.purchased = true;
        playerStats[item.type.stat] += item.type.val;
        creditsEl.innerText = credits;
        updateStockUI();
        saveData();
        playSound(600, 'sine', 0.2);
    } else if (item && credits < item.cost) {
        playSound(100, 'sine', 0.2);
    }
}


// Save Data
let pilotName = "";

// Sound Engine
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSound(freq, type, duration, vol = 0.1) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

// Persistence
function saveData() {
    const data = {
        credits,
        fireRateLevel,
        damageLevel,
        sideCannonsLevel,
        upgradeCosts,
        pilotName,
        stock,
        nextStockRefresh,
        playerStats
    };
    localStorage.setItem('galacticDefender_save_' + pilotName, JSON.stringify(data));
}

function loadData(name) {
    const saved = localStorage.getItem('galacticDefender_save_' + name);
    if (saved) {
        const data = JSON.parse(saved);
        credits = data.credits;
        fireRateLevel = data.fireRateLevel;
        damageLevel = data.damageLevel;
        sideCannonsLevel = data.sideCannonsLevel;
        upgradeCosts = data.upgradeCosts;
        pilotName = data.pilotName;
        stock = data.stock || [];
        nextStockRefresh = data.nextStockRefresh || 0;
        playerStats = data.playerStats || {
            critChance: 0,
            magnetRange: 0,
            bonusCredits: 0,
            shieldCapacity: 0,
            projectileSize: 0,
            speedMultiplier: 1
        };
        updateStockUI();
        if (stock.length === 0 || Date.now() > nextStockRefresh) {
            generateStock();
        }
        return true;
    }
    return false;
}

// Powerup State
let activePowerup = null;
let powerupTimer = 0;
let shieldHits = 0;
let slowMoTimer = 0;

// Animation State
let isLaunching = false;
let launchY = 0;
let launchAlpha = 0;
let lastBossScore = 0;

// Constants
let PLAYER_SPEED = 5;
let PROJECTILE_SPEED = 7;
let ENEMY_SPAWN_RATE = 2000;
let ENEMY_BASE_SPEED = 0.6; // Much slower base speed (was 1.2)

// Resize Canvas
function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// Input Handling
window.addEventListener('keydown', (e) => {
    if (!keys[e.code] && gameRunning) {
        const now = Date.now();
        // Double tap Left
        if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
            if (now - player.lastLeftTap < 250) {
                player.dash(-1);
            }
            player.lastLeftTap = now;
        }
        // Double tap Right
        if (e.code === 'ArrowRight' || e.code === 'KeyD') {
            if (now - player.lastRightTap < 250) {
                player.dash(1);
            }
            player.lastRightTap = now;
        }
    }
    keys[e.code] = true;
});
window.addEventListener('keyup', (e) => keys[e.code] = false);

// Mobile Touch Handling
const mobileBtns = {
    'btn-left': 'ArrowLeft',
    'btn-right': 'ArrowRight',
    'btn-up': 'ArrowUp',
    'btn-down': 'ArrowDown',
    'btn-shoot': 'Space'
};

Object.entries(mobileBtns).forEach(([id, code]) => {
    const btn = document.getElementById(id);
    if (!btn) return;

    const handleStart = (e) => {
        e.preventDefault();
        keys[code] = true;
    };
    const handleEnd = (e) => {
        e.preventDefault();
        keys[code] = false;
    };

    btn.addEventListener('touchstart', handleStart);
    btn.addEventListener('touchend', handleEnd);
    btn.addEventListener('mousedown', handleStart);
    btn.addEventListener('mouseup', handleEnd);
    btn.addEventListener('mouseleave', handleEnd);
});

// Classes
class Player {
    constructor() {
        this.width = 60;
        this.height = 60;
        this.x = canvas.width / 2 - this.width / 2;
        this.y = canvas.height - 100;
        this.color = '#00f2ff';
        this.cooldown = 0;
        this.lastLeftTap = 0;
        this.lastRightTap = 0;
        this.dashDistance = 120;
    }

    draw() {
        ctx.save();

        let drawX = this.x;
        let drawY = isLaunching ? launchY : this.y;

        ctx.translate(drawX + this.width / 2, drawY + this.height / 2);

        // Ship Glow
        ctx.shadowBlur = 20;
        ctx.shadowColor = this.color;

        // Main Hull
        ctx.fillStyle = '#cbd5e1'; // Silver/Grey
        ctx.beginPath();
        ctx.moveTo(0, -this.height / 2);
        ctx.lineTo(this.width / 4, -this.height / 4);
        ctx.lineTo(this.width / 2, this.height / 2);
        ctx.lineTo(this.width / 4, this.height / 3);
        ctx.lineTo(-this.width / 4, this.height / 3);
        ctx.lineTo(-this.width / 2, this.height / 2);
        ctx.lineTo(-this.width / 4, -this.height / 4);
        ctx.closePath();
        ctx.fill();

        // Wings/Details
        ctx.fillStyle = this.color; // Accent color
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(this.width / 2, this.height / 2);
        ctx.lineTo(this.width / 4, this.height / 3);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-this.width / 2, this.height / 2);
        ctx.lineTo(-this.width / 4, this.height / 3);
        ctx.closePath();
        ctx.fill();

        // Cockpit (Glassy look)
        ctx.fillStyle = 'rgba(0, 242, 255, 0.6)';
        ctx.beginPath();
        ctx.ellipse(0, -5, 10, 15, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Engines (Flickering effect)
        if (gameRunning || isLaunching) {
            const flameMultiplier = isLaunching ? 3 : 1;
            const flameSize = (5 + Math.random() * 10) * flameMultiplier;
            const gradient = ctx.createLinearGradient(0, this.height / 3, 0, this.height / 3 + flameSize);
            gradient.addColorStop(0, '#ffaa00');
            gradient.addColorStop(1, 'transparent');
            ctx.fillStyle = gradient;
            ctx.fillRect(-10, this.height / 3, 20, flameSize);
        }

        // VISUAL WEAPONS (Side Cannons)
        if (sideCannonsLevel >= 1 || activePowerup === 'SPREAD_SHOT') {
            ctx.fillStyle = '#64748b';
            // Left Cannon
            ctx.fillRect(-this.width / 2 - 5, 10, 8, 20);
            ctx.fillStyle = this.color;
            ctx.fillRect(-this.width / 2 - 3, 5, 4, 10);

            // Right Cannon
            ctx.fillStyle = '#64748b';
            ctx.fillRect(this.width / 2 - 3, 10, 8, 20);
            ctx.fillStyle = this.color;
            ctx.fillRect(this.width / 2 - 1, 5, 4, 10);
        }

        if (sideCannonsLevel >= 2) {
            ctx.fillStyle = '#475569';
            // Outer Left
            ctx.fillRect(-this.width / 2 - 15, 20, 6, 15);
            // Outer Right
            ctx.fillRect(this.width / 2 + 9, 20, 6, 15);
        }

        // VISUAL SHIELD
        if (shieldHits > 0) {
            ctx.shadowBlur = 20;
            ctx.shadowColor = '#00f2ff';
            ctx.strokeStyle = `rgba(0, 242, 255, ${0.3 + (shieldHits * 0.2)})`;
            ctx.lineWidth = 1 + shieldHits;
            ctx.beginPath();
            ctx.arc(0, 0, this.width, 0, Math.PI * 2);
            ctx.stroke();

            // Hex pattern or pulse
            ctx.strokeStyle = 'rgba(255, 255, 255, ' + (Math.sin(Date.now() / 100) * 0.2 + 0.3) + ')';
            ctx.stroke();
        }

        ctx.restore();
    }

    update() {
        const speed = PLAYER_SPEED * (playerStats.speedMultiplier || 1);
        if (keys['KeyA'] || keys['ArrowLeft']) this.x -= speed;
        if (keys['KeyD'] || keys['ArrowRight']) this.x += speed;
        if (keys['KeyW'] || keys['ArrowUp']) this.y -= speed;
        if (keys['KeyS'] || keys['ArrowDown']) this.y += speed;

        // Boundaries
        this.x = Math.max(0, Math.min(canvas.width - this.width, this.x));
        this.y = Math.max(0, Math.min(canvas.height - this.height, this.y));

        if (keys['Space'] && this.cooldown <= 0) {
            this.shoot();
            let baseCooldown = Math.max(5, 15 - (fireRateLevel * 2));
            if (activePowerup === 'RAPID_FIRE') baseCooldown /= 2;
            this.cooldown = baseCooldown;
        }

        if (this.cooldown > 0) this.cooldown--;
    }

    dash(dir) {
        this.x += dir * this.dashDistance;
        // Boundaries after dash
        this.x = Math.max(0, Math.min(canvas.width - this.width, this.x));

        // Visual & Sound effect
        createExplosion(this.x + this.width / 2, this.y + this.height / 2, this.color);
        playSound(400, 'sine', 0.1, 0.2);
    }

    shoot() {
        const dmg = activePowerup === 'DOUBLE_DAMAGE' ? damageLevel * 2 : damageLevel;

        // Bullet color cycles every 5 damage levels
        const colors = ['#00f2ff', '#39ff14', '#ffff00', '#ff00ff', '#ff2d55'];
        let bulletColor = colors[damageLevel % colors.length];

        if (activePowerup === 'DOUBLE_DAMAGE') bulletColor = '#fff';
        if (activePowerup === 'SQUADRON') bulletColor = '#39ff14';

        playSound(200 + (damageLevel * 20), 'square', 0.1);

        // Main center shot
        projectiles.push(new Projectile(this.x + this.width / 2, this.y, bulletColor, dmg));

        // Side Cannons
        if (sideCannonsLevel >= 1 || activePowerup === 'SPREAD_SHOT' || activePowerup === 'SQUADRON') {
            projectiles.push(new Projectile(this.x, this.y + 20, bulletColor, dmg));
            projectiles.push(new Projectile(this.x + this.width, this.y + 20, bulletColor, dmg));
        }

        if (sideCannonsLevel >= 2 || activePowerup === 'SPREAD_SHOT' || activePowerup === 'SQUADRON') {
            projectiles.push(new Projectile(this.x - 10, this.y + 40, bulletColor, dmg));
            projectiles.push(new Projectile(this.x + this.width + 10, this.y + 40, bulletColor, dmg));
        }

        if (activePowerup === 'RAPID_FIRE') {
            // No extra projectiles here, logic is in update() cooldown
        }
    }
}

class EnemyProjectile {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 5;
        this.color = '#ff0000';
        this.speed = 4;
    }

    draw() {
        ctx.save();
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    update() {
        this.y += this.speed;
    }
}

class Projectile {
    constructor(x, y, color = '#00f2ff', damage = damageLevel) {
        this.x = x;
        this.y = y;
        this.radius = 4 + (playerStats.projectileSize * 5 || 0);
        this.color = color;
        this.damage = damage;
        this.isCrit = Math.random() < (playerStats.critChance || 0);
        if (this.isCrit) {
            this.damage *= 2;
            this.radius *= 1.5;
            this.color = '#fff'; // White for crit
        }
    }

    draw() {
        ctx.save();
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    update() {
        this.y -= PROJECTILE_SPEED;
    }
}

class Boss {
    constructor() {
        this.width = canvas.width > 500 ? 120 : 80; // Scale boss for mobile
        this.height = this.width * 0.66;
        this.startX = canvas.width / 2 - this.width / 2;
        this.x = this.startX;
        this.y = -this.height;
        this.health = 20 + Math.floor(score / 1000);
        this.maxHealth = this.health;
        this.color = '#ff00ff'; // Boss color (Magenta)
        this.points = 5000;
        this.speed = 0.3;
        this.isBoss = true;
        this.shootCooldown = 0;
    }

    draw() {
        ctx.save();
        ctx.translate(this.x + this.width / 2, this.y + this.height / 2);

        ctx.shadowBlur = 30;
        ctx.shadowColor = this.color;

        // Boss Body
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.moveTo(-this.width / 2, -this.height / 4);
        ctx.lineTo(this.width / 2, -this.height / 4);
        ctx.lineTo(this.width / 3, this.height / 2);
        ctx.lineTo(-this.width / 3, this.height / 2);
        ctx.closePath();
        ctx.fill();

        // Glowing Armor Pieces
        ctx.fillStyle = this.color;
        ctx.fillRect(-this.width / 2, -5, this.width / 8, 20);
        ctx.fillRect(this.width / 2 - this.width / 8, -5, this.width / 8, 20);

        // Core
        const pulse = Math.sin(Date.now() / 200) * 5;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(0, 0, this.width / 8 + pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#fff';
        ctx.stroke();

        // Health Bar (Always visible for boss)
        ctx.restore();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.fillRect(this.x, this.y - 20, this.width, 10);
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y - 20, (this.health / this.maxHealth) * this.width, 10);
        ctx.strokeStyle = '#fff';
        ctx.strokeRect(this.x, this.y - 20, this.width, 10);
    }

    update() {
        // Stop moving down after reaching 15% of screen height
        const targetY = canvas.height * 0.15;
        if (this.y < targetY) {
            this.y += this.speed * 4; // Faster entry
        } else {
            // Stay at top but hover slightly
            this.y = targetY + Math.sin(Date.now() / 1500) * 20;
        }

        // Float side to side a bit, keeping within screen bounds
        const driftRange = (canvas.width - this.width) / 2.5;
        this.x = this.startX + Math.sin(Date.now() / 2000) * driftRange;

        // Clamp to screen
        this.x = Math.max(10, Math.min(canvas.width - this.width - 10, this.x));

        // Boss Shooting
        if (this.shootCooldown <= 0) {
            this.shoot();
            this.shootCooldown = 100; // Shoot every ~1.5 seconds
        }
        if (this.shootCooldown > 0) this.shootCooldown--;
    }

    shoot() {
        playSound(150, 'square', 0.2, 0.05);
        // Triple shot
        enemyProjectiles.push(new EnemyProjectile(this.x + this.width / 2, this.y + this.height));
        enemyProjectiles.push(new EnemyProjectile(this.x + 20, this.y + this.height - 10));
        enemyProjectiles.push(new EnemyProjectile(this.x + this.width - 20, this.y + this.height - 10));
    }
}

class Enemy {
    constructor() {
        this.width = 50;
        this.height = 50;
        this.x = Math.random() * (canvas.width - this.width);
        this.y = -this.height;
        this.speed = ENEMY_BASE_SPEED + Math.random() * 0.8 + (score / 5000); // Reduced variance and scaling

        // Armored Enemy Chance (increases with score)
        const armoredChance = Math.min(0.5, (score / 10000));
        if (Math.random() < armoredChance) {
            this.health = 3;
            this.maxHealth = 3;
            this.color = '#ffaa00'; // Orange/Gold for armored
            this.points = 500;
        } else {
            this.health = 1;
            this.maxHealth = 1;
            this.color = '#39ff14'; // Neon Green
            this.points = 100;
        }
    }

    draw() {
        ctx.save();
        ctx.translate(this.x + this.width / 2, this.y + this.height / 2);

        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;

        // Health bar
        if (this.health > 1) {
            ctx.strokeStyle = 'rgba(255,255,255,0.5)';
            ctx.strokeRect(-this.width / 2, -this.height / 2 - 15, this.width, 4);
            ctx.fillStyle = this.color;
            ctx.fillRect(-this.width / 2, -this.height / 2 - 15, (this.health / this.maxHealth) * this.width, 4);
        }

        // Alien Body - Classic UFO/Saucer Shape with "Legs"
        ctx.fillStyle = this.color;

        // Base saucer
        ctx.beginPath();
        ctx.ellipse(0, 0, this.width / 2, this.height / 4, 0, 0, Math.PI * 2);
        ctx.fill();

        // Dome
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.beginPath();
        ctx.arc(0, -5, this.width / 4, Math.PI, 0);
        ctx.fill();
        ctx.strokeStyle = this.color;
        ctx.stroke();

        // Alien Head inside
        ctx.fillStyle = '#0f0';
        ctx.beginPath();
        ctx.arc(0, -5, 5, 0, Math.PI * 2);
        ctx.fill();

        // Mechanical Legs/Tentacles
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;
        for (let i = -1; i <= 1; i++) {
            ctx.beginPath();
            ctx.moveTo(i * 10, 5);
            ctx.lineTo(i * 15, 15 + Math.sin(Date.now() / 200 + i) * 5);
            ctx.stroke();
        }

        // Glowing Orbs around saucer
        const orbColor = (Date.now() % 500 < 250) ? '#fff' : this.color;
        ctx.fillStyle = orbColor;
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
            ctx.beginPath();
            ctx.arc(Math.cos(a) * (this.width / 2 - 5), Math.sin(a) * (this.height / 8), 2, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }

    update() {
        this.y += this.speed;
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.radius = Math.random() * 3 + 1;
        this.velocity = {
            x: (Math.random() - 0.5) * 4,
            y: (Math.random() - 0.5) * 4
        };
        this.alpha = 1;
    }

    update() {
        this.x += this.velocity.x;
        this.y += this.velocity.y;
        this.alpha -= 0.03;
    }
}

class Powerup {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 40;
        this.height = 40;
        const types = ['RAPID_FIRE', 'SQUADRON', 'DOUBLE_DAMAGE', 'SHIELD', 'SLOW_MO'];
        this.type = types[Math.floor(Math.random() * types.length)];
        this.color = this.getColor();
        this.speed = 1.5;
    }

    getColor() {
        switch (this.type) {
            case 'RAPID_FIRE': return '#ffff00'; // Yellow
            case 'SQUADRON': return '#00ff00';   // Green
            case 'DOUBLE_DAMAGE': return '#ff00ff'; // Purple
            case 'SHIELD': return '#00f2ff';      // Cyan
            case 'SLOW_MO': return '#ffffff';      // White
        }
    }

    draw() {
        ctx.save();
        ctx.shadowBlur = 20;
        ctx.shadowColor = this.color;

        // Pulse effect
        const scale = 1 + Math.sin(Date.now() / 200) * 0.1;
        ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
        ctx.scale(scale, scale);

        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(0, 0, 15, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#000';
        ctx.font = 'bold 16px Outfit';
        ctx.textAlign = 'center';
        let label = this.type[0];
        if (this.type === 'SLOW_MO') label = 'T'; // Time
        ctx.fillText(label, 0, 6);
        ctx.restore();
    }

    update() {
        this.y += this.speed;

        // Magnet logic
        if (player && playerStats.magnetRange > 0) {
            const dx = (player.x + player.width / 2) - this.x;
            const dy = (player.y + player.height / 2) - this.y;
            const dist = Math.hypot(dx, dy);
            if (dist < playerStats.magnetRange) {
                this.x += (dx / dist) * 4;
                this.y += (dy / dist) * 4;
            }
        }
    }
}

// Background Elements
const stars = [];
for (let i = 0; i < 200; i++) {
    stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 2,
        speed: Math.random() * 0.5 + 0.1
    });
}

// Planets/Nebulae
function createPlanet() {
    return {
        x: Math.random() * canvas.width,
        y: -200,
        size: 50 + Math.random() * 100,
        color: `hsl(${Math.random() * 360}, 50%, 30%)`,
        speed: 0.2
    };
}
planets.push(createPlanet());

function drawBackground() {
    ctx.fillStyle = '#050510';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // SLOW MO EFFECT (Screen tint)
    if (slowMoTimer > 0) {
        ctx.fillStyle = 'rgba(0, 100, 255, 0.1)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Dynamic Planets
    planets.forEach((p, i) => {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        p.y += p.speed;
        if (p.y > canvas.height + p.size) planets[i] = createPlanet();
    });

    ctx.fillStyle = '#fff';
    stars.forEach(star => {
        // Simple fillRect is faster than arc for tiny stars
        ctx.fillRect(star.x, star.y, star.size, star.size);

        star.y += star.speed;
        if (star.y > canvas.height) star.y = 0;
    });
}

// Game Loop
function gameLoop() {
    if (!gameRunning) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBackground();

    player.update();
    player.draw();

    // Update Projectiles
    projectiles.forEach((p, index) => {
        p.update();
        p.draw();

        if (p.y < 0) projectiles.splice(index, 1);
    });

    // Update Enemy Projectiles
    enemyProjectiles.forEach((p, index) => {
        p.update();
        p.draw();

        // Hit Player
        const dx = player.x + player.width / 2 - p.x;
        const dy = player.y + player.height / 2 - p.y;
        if (Math.hypot(dx, dy) < 30) {
            enemyProjectiles.splice(index, 1);
            if (shieldHits > 0) {
                shieldHits--;
                playSound(300, 'sine', 0.3);
            } else {
                createExplosion(player.x + player.width / 2, player.y + player.height / 2, '#00f2ff');
                lives--;
                livesEl.innerText = lives;
                if (lives <= 0) endGame();
            }
        }

        if (p.y > canvas.height) enemyProjectiles.splice(index, 1);
    });

    // Update Enemies
    enemies.forEach((enemy, eIndex) => {
        enemy.update();
        enemy.draw();

        // Player Collision (using squared distance to avoid Math.hypot)
        const dx = player.x + player.width / 2 - (enemy.x + enemy.width / 2);
        const dy = player.y + player.height / 2 - (enemy.y + enemy.height / 2);
        const distSq = dx * dx + dy * dy;
        if (distSq < 1600) { // 40^2 
            if (shieldHits > 0) {
                shieldHits--;
                enemies.splice(eIndex, 1);
                createExplosion(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, enemy.color);
                playSound(300, 'sine', 0.3);
            } else {
                createExplosion(player.x + player.width / 2, player.y + player.height / 2, '#00f2ff');
                lives--;
                livesEl.innerText = lives;
                enemies.splice(eIndex, 1);
                if (lives <= 0) endGame();
            }
        }

        // Projectile Collision
        projectiles.forEach((p, pIndex) => {
            const pdx = p.x - (enemy.x + enemy.width / 2);
            const pdy = p.y - (enemy.y + enemy.height / 2);
            const pDistSq = pdx * pdx + pdy * pdy;
            if (pDistSq < 900) { // 30^2
                enemy.health -= p.damage;
                projectiles.splice(pIndex, 1);

                if (enemy.health <= 0) {
                    playSound(100, 'sawtooth', 0.2);
                    createExplosion(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, enemy.color);

                    if (enemy.isBoss) {
                        // Boss Kaboom!
                        for (let i = 0; i < 5; i++) {
                            setTimeout(() => {
                                createExplosion(enemy.x + Math.random() * enemy.width, enemy.y + Math.random() * enemy.height, '#fff');
                                playSound(80, 'sawtooth', 0.3);
                            }, i * 100);
                        }
                        credits += 1000;
                        // Guaranteed 3 powerups
                        for (let i = 0; i < 3; i++) {
                            const pX = (enemy.x + i * 40) % canvas.width;
                            powerups.push(new Powerup(pX, enemy.y));
                        }

                        // Victory Breathing Room: Stop spawning for 5 seconds
                        clearInterval(spawnInterval);
                        setTimeout(() => {
                            if (gameRunning) startSpawning();
                        }, 5000);
                    }

                    score += enemy.points;
                    let creditGain = Math.floor(enemy.points / 10);
                    if (playerStats.bonusCredits > 0) {
                        creditGain = Math.floor(creditGain * (1 + playerStats.bonusCredits));
                    }
                    credits += creditGain;
                    scoreEl.innerText = score;
                    creditsEl.innerText = credits;
                    saveData(); // Save every time we get credits

                    // Spawn powerup chance (only for normal enemies)
                    if (!enemy.isBoss && Math.random() < 0.1) {
                        powerups.push(new Powerup(enemy.x, enemy.y));
                    }

                    enemies.splice(eIndex, 1);
                } else {
                    // Small impact effect
                    createExplosion(p.x, p.y, '#fff');
                }
            }
        });

        if (enemy.y > canvas.height) {
            enemies.splice(eIndex, 1);
            // Optional: Penalty for missed enemies
        }
    });

    // Particles (Iterate backwards when splicing)
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.update();
        if (p.alpha <= 0) {
            particles.splice(i, 1);
        } else {
            // Simplified draw: no save/restore per particle
            ctx.globalAlpha = p.alpha;
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x, p.y, p.radius * 2, p.radius * 2);
        }
    }
    ctx.globalAlpha = 1;

    // Update Powerups
    powerups.forEach((pu, index) => {
        pu.update();
        pu.draw();

        // Collection
        if (Math.hypot(player.x + player.width / 2 - (pu.x + pu.width / 2),
            player.y + player.height / 2 - (pu.y + pu.height / 2)) < 50) {

            playSound(600, 'sine', 0.2);

            if (pu.type === 'SHIELD') {
                shieldHits = 1 + (playerStats.shieldCapacity || 0);
            } else if (pu.type === 'SLOW_MO') {
                slowMoTimer = 400; // ~7 seconds
                ENEMY_BASE_SPEED = 0.5;
            } else {
                activePowerup = pu.type;
                powerupTimer = 500; // ~8 seconds
            }

            powerups.splice(index, 1);
            createExplosion(pu.x + pu.width / 2, pu.y + pu.height / 2, pu.color);
        }

        if (pu.y > canvas.height) powerups.splice(index, 1);
    });

    if (powerupTimer > 0) {
        powerupTimer--;
        if (powerupTimer <= 0) activePowerup = null;
    }

    if (slowMoTimer > 0) {
        slowMoTimer--;
        if (slowMoTimer <= 0) ENEMY_BASE_SPEED = CURRENT_ENEMY_SPEED;
    }

    animationId = requestAnimationFrame(gameLoop);
}

function createExplosion(x, y, color) {
    const particleCount = 15; // Reduced for performance
    for (let i = 0; i < particleCount; i++) {
        particles.push(new Particle(x, y, color));
    }
}

let spawnInterval;
function startSpawning() {
    clearInterval(spawnInterval);
    spawnInterval = setInterval(() => {
        if (!gameRunning) return;

        // Don't spawn normal enemies if a boss is currently alive
        const bossAlive = enemies.some(e => e.isBoss);
        if (bossAlive) return;

        // Check for Mini-Boss every 5000 points
        if (score > lastBossScore + 5000) {
            enemies.push(new Boss());
            lastBossScore = Math.floor(score / 5000) * 5000;
            playSound(50, 'sawtooth', 2, 0.3); // Deep boss growl
        } else {
            enemies.push(new Enemy());
        }
    }, ENEMY_SPAWN_RATE);
}

function startGame() {
    isLaunching = true;
    launchY = window.innerHeight + 200;
    launchAlpha = 0;
    lastBossScore = 0;

    score = 0;
    lives = 3;
    shieldHits = 0;
    slowMoTimer = 0;
    activePowerup = null;
    ENEMY_BASE_SPEED = 1.2;
    CURRENT_ENEMY_SPEED = 1.2;

    scoreEl.innerText = score;
    livesEl.innerText = lives;
    projectiles = [];
    enemyProjectiles = [];
    enemies = [];
    particles = [];
    powerups = [];
    player = new Player();

    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');

    // Launch Sequence
    playSound(150, 'sawtooth', 2, 0.2);

    function launchAnimation() {
        if (launchY > player.y) {
            launchY -= 5; // Slower, more visible launch
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            drawBackground();

            // Draw Launching ship
            player.draw();

            // Text indicator
            ctx.fillStyle = `rgba(255, 255, 255, ${launchAlpha})`;
            ctx.font = 'bold 40px Outfit';
            ctx.textAlign = 'center';
            ctx.fillText("READY FOR TAKEOFF?", canvas.width / 2, canvas.height / 2);
            if (launchAlpha < 1) launchAlpha += 0.02;

            requestAnimationFrame(launchAnimation);
        } else {
            isLaunching = false;
            gameRunning = true;
            clearInterval(spawnInterval);
            startSpawning();
            gameLoop();
        }
    }

    launchAnimation();
}

function endGame() {
    gameRunning = false;
    cancelAnimationFrame(animationId);
    clearInterval(spawnInterval);

    finalScoreEl.innerText = score;
    gameOverScreen.classList.remove('hidden');
    updateUpgradeButtons();
}

// UI Navigation
lobbyBtn.addEventListener('click', () => {
    startScreen.classList.add('hidden');
    lobbyScreen.classList.remove('hidden');
    updateUpgradeButtons();
    updateStockUI();
});

backBtn.addEventListener('click', () => {
    lobbyScreen.classList.add('hidden');
    startScreen.classList.remove('hidden');
});

function updateUpgradeButtons() {
    upgradeFRBtn.innerText = `Fire Rate (Lvl ${fireRateLevel}) - COST: ${upgradeCosts.fireRate}`;
    upgradeDMGBtn.innerText = `Damage (Lvl ${damageLevel}) - COST: ${upgradeCosts.damage}`;
    upgradeSideBtn.innerText = `Side Cannons (Lvl ${sideCannonsLevel}) - COST: ${upgradeCosts.sideCannons}`;
    creditsEl.innerText = credits;

    upgradeFRBtn.disabled = credits < upgradeCosts.fireRate;
    upgradeDMGBtn.disabled = credits < upgradeCosts.damage;
    upgradeSideBtn.disabled = credits < upgradeCosts.sideCannons;
}

upgradeFRBtn.addEventListener('click', () => {
    if (credits >= upgradeCosts.fireRate) {
        credits -= upgradeCosts.fireRate;
        fireRateLevel++;
        upgradeCosts.fireRate = Math.floor(upgradeCosts.fireRate * 1.5);
        updateUpgradeButtons();
    }
});

upgradeDMGBtn.addEventListener('click', () => {
    if (credits >= upgradeCosts.damage) {
        credits -= upgradeCosts.damage;
        damageLevel++;
        upgradeCosts.damage = Math.floor(upgradeCosts.damage * 1.8);
        updateUpgradeButtons();
    }
});

upgradeSideBtn.addEventListener('click', () => {
    if (credits >= upgradeCosts.sideCannons) {
        credits -= upgradeCosts.sideCannons;
        sideCannonsLevel++;
        upgradeCosts.sideCannons = Math.floor(upgradeCosts.sideCannons * 3); // Very exponential cost
        updateUpgradeButtons();
    }
});

goToLobbyBtn.addEventListener('click', () => {
    gameOverScreen.classList.add('hidden');
    lobbyScreen.classList.remove('hidden');
    updateUpgradeButtons();
    updateStockUI();
});

// Login Logic
loginBtn.addEventListener('click', () => {
    const name = usernameInput.value.trim().toUpperCase();
    if (name) {
        pilotName = name;
        pilotNameEl.innerText = pilotName;
        const existingData = loadData(name);
        if (!existingData || stock.length === 0) {
            generateStock();
        }
        loginScreen.classList.add('hidden');
        startScreen.classList.remove('hidden');
        audioCtx.resume();
        playSound(440, 'sine', 0.5);
    }
});

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);

// --- STOCK SYSTEM IMPLEMENTATION ---
const STOCK_RARITIES = [
    { id: 'black-hole', name: 'Black Hole', count: 5, colorClass: 'rarity-black-hole', baseCost: 100000 },
    { id: 'star', name: 'Star', count: 10, colorClass: 'rarity-star', baseCost: 25000 },
    { id: 'super-rare', name: 'Super Rare', count: 15, colorClass: 'rarity-super-rare', baseCost: 10000 },
    { id: 'rare', name: 'Rare', count: 20, colorClass: 'rarity-rare', baseCost: 5000 },
    { id: 'uncommon', name: 'Uncommon', count: 25, colorClass: 'rarity-uncommon', baseCost: 2000 },
    { id: 'common', name: 'Common', count: 30, colorClass: 'rarity-common', baseCost: 500 }
];

const STOCK_UPGRADE_TYPES = [
    { id: 'crit', name: 'Precision Module', desc: '+5% Crit Chance', stat: 'critChance', val: 0.05 },
    { id: 'magnet', name: 'Resource Magnet', desc: '+100 Magnet Range', stat: 'magnetRange', val: 100 },
    { id: 'credits', name: 'Wealth Protocol', desc: '+10% Credit Gain', stat: 'bonusCredits', val: 0.1 },
    { id: 'speed', name: 'Overdrive Engine', desc: '+10% Speed', stat: 'speedMultiplier', val: 0.1 },
    { id: 'projectile', name: 'Heavy Rounds', desc: '+10% Bullet Size', stat: 'projectileSize', val: 0.1 },
    { id: 'shield', name: 'Reinforced Hull', desc: '+1 Shield Capacity', stat: 'shieldCapacity', val: 1 }
];

function generateStock() {
    stock = [];
    STOCK_RARITIES.forEach(rarity => {
        for (let i = 0; i < rarity.count; i++) {
            const type = STOCK_UPGRADE_TYPES[Math.floor(Math.random() * STOCK_UPGRADE_TYPES.length)];
            // Cost variance
            const variance = 0.8 + Math.random() * 0.4;
            const cost = Math.floor(rarity.baseCost * variance);

            stock.push({
                id: Math.random().toString(36).substr(2, 9),
                rarity: rarity,
                type: type,
                cost: cost,
                purchased: false
            });
        }
    });
    // Sort by rarity (Black Hole first)
    const rarityOrder = ['black-hole', 'star', 'super-rare', 'rare', 'uncommon', 'common'];
    stock.sort((a, b) => rarityOrder.indexOf(a.rarity.id) - rarityOrder.indexOf(b.rarity.id));

    nextStockRefresh = Date.now() + (10 * 60 * 1000); // 10 minutes
    saveData();
    updateStockUI();
}

function updateStockUI() {
    const container = document.getElementById('stock-items');
    if (!container) return;

    container.innerHTML = '';

    stock.forEach(item => {
        if (item.purchased) return;

        const itemEl = document.createElement('div');
        itemEl.className = `stock-item ${item.rarity.colorClass}`;
        itemEl.innerHTML = `
            <div class="stock-item-info">
                <h4>${item.type.name}</h4>
                <div class="stock-rarity-text">${item.rarity.name}</div>
                <span>${item.type.desc}</span>
            </div>
            <button class="upgrade-btn stock-buy-btn" data-id="${item.id}">
                ${item.cost} CR
            </button>
        `;

        const buyBtn = itemEl.querySelector('.stock-buy-btn');
        buyBtn.onclick = () => buyStockItem(item.id);

        container.appendChild(itemEl);
    });
}

function buyStockItem(itemId) {
    const item = stock.find(i => i.id === itemId);
    if (item && !item.purchased && credits >= item.cost) {
        credits -= item.cost;
        item.purchased = true;

        // Apply effect
        playerStats[item.type.stat] += item.type.val;

        // Update UI
        creditsEl.innerText = credits;
        updateStockUI();
        saveData();
        playSound(600, 'sine', 0.2);
    } else if (credits < item.cost) {
        playSound(100, 'sine', 0.2); // Denied
    }
}

function updateStockTimer() {
    const timerEl = document.getElementById('stock-timer');
    if (!timerEl) return;

    const now = Date.now();
    const diff = nextStockRefresh - now;

    if (diff <= 0) {
        generateStock();
    } else {
        const mins = Math.floor(diff / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        timerEl.innerText = `REFRESH IN: ${mins}:${secs.toString().padStart(2, '0')}`;
    }
}

// Start timer loop
setInterval(updateStockTimer, 1000);

// Initialize stock if empty or expired
if (stock.length === 0 || Date.now() > nextStockRefresh) {
    // generateStock() will be called by first updateStockTimer tick or manually if needed
    // But since pilots might not be logged in yet, we'll wait for login.
}

