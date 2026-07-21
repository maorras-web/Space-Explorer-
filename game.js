const container = document.getElementById('game-container');
const viewport = document.getElementById('viewport');
const playerShip = document.getElementById('player-ship');
const shieldAura = document.getElementById('shield-aura');
const shieldValElement = document.getElementById('shield-val');
const scoreElement = document.getElementById('score');
const highScoreElement = document.getElementById('high-score');
const finalScoreElement = document.getElementById('final-score');
const startScreen = document.getElementById('start-screen');
const gameOverOverlay = document.getElementById('game-over-overlay');
const shipSelectorContainer = document.getElementById('ship-selector-container');

// --- Internationalization (i18n) ---
const translations = {
    'he': {
        'score': 'ניקוד',
        'shield': 'מגן',
        'shieldNone': 'אין',
        'shieldActive': 'פעיל',
        'highScore': 'שיא',
        'gameTitle': '🚀 Space Explorer',
        'shipSelectionLead': 'בחר חללית מתקדמת והתחל לשחק:',
        'startBtn': '🚀 התחל משחק',
        'gameOverTitle': '💥 החללית הושמדה!',
        'yourScore': 'הניקוד שלך',
        'mainMenuBtn': '🔄 לתפריט הראשי',
        'unlocked': 'פתוח',
        'lockedAt': 'משריין ב-{{{points}}} נק\'',
        'points': 'נק\'',
        'ship1Name': 'סייר אלפא',
        'ship2Name': 'פנטום X',
        'ship3Name': 'טיטאן ניאון'
    },
    'en': {
        'score': 'Score',
        'shield': 'Shield',
        'shieldNone': 'None',
        'shieldActive': 'Active',
        'highScore': 'High Score',
        'gameTitle': '🚀 Space Explorer',
        'shipSelectionLead': 'Select an advanced ship to play:',
        'startBtn': '🚀 Start Game',
        'gameOverTitle': '💥 Ship Destroyed!',
        'yourScore': 'Your Score',
        'mainMenuBtn': '🔄 Main Menu',
        'unlocked': 'Unlocked',
        'lockedAt': 'Unlocks at {{{points}}} pts',
        'points': 'pts',
        'ship1Name': 'Alpha Scout',
        'ship2Name': 'Phantom X',
        'ship3Name': 'Neon Titan'
    }
};

let currentLang = 'en'; 

function t(key, data = {}) {
    let translation = translations[currentLang][key] || key;
    for (const dataKey in data) {
        translation = translation.replace(`{{{${dataKey}}}}`, data[dataKey]);
    }
    return translation;
}

function applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        el.innerText = t(key);
    });
    updateShieldUI();
}

let score = 0;
let highScore = localStorage.getItem('space_high_score') || 0;
let isGameOver = true;
let shipX = 50;

let selectedShipType = 'ship1';
let hasShield = false;
let doubleShotEndTime = 0; // Fixed: using absolute timestamp for double shot duration

let lasers = [];
let asteroids = [];
let enemies = [];
let powerUps = [];

let gameLoopId;
let spawnTimer, enemyTimer, powerUpTimer, shootTimer;

// --- Web Audio API ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let masterVolume = 0.25;

function playSound(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    let duration = 0.1;
    gainNode.gain.setValueAtTime(masterVolume, audioCtx.currentTime);
    
    if (type === 'laser') {
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(850, audioCtx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(120, audioCtx.currentTime + 0.08);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.09);
        duration = 0.09;
    } else if (type === 'explosion') {
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(140, audioCtx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(15, audioCtx.currentTime + 0.15);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.18);
        duration = 0.18;
    } else if (type === 'powerup') {
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(450, audioCtx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(1100, audioCtx.currentTime + 0.12);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
        duration = 0.15;
    } else if (type === 'gameover') {
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(280, audioCtx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.35);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.38);
        duration = 0.38;
    }
    
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + duration);
}

// Load High Score
highScoreElement.innerText = highScore;

// --- Dynamic Ship Cards ---
const shipData = [
    { id: 'ship1', nameKey: 'ship1Name', req: 0, previewClass: 'p-ship1' },
    { id: 'ship2', nameKey: 'ship2Name', req: 200, previewClass: 'p-ship2' },
    { id: 'ship3', nameKey: 'ship3Name', req: 500, previewClass: 'p-ship3' }
];

function buildShipCards() {
    shipSelectorContainer.innerHTML = '';

    shipData.forEach(ship => {
        const isLocked = highScore < ship.req;
        const card = document.createElement('div');
        card.id = `card-${ship.id}`;
        card.className = `ship-card ${isLocked ? 'locked' : ''} ${ship.id === selectedShipType ? 'selected' : ''}`;
        
        if (!isLocked) {
            card.onclick = () => selectShip(ship.id);
        }

        const preview = document.createElement('div');
        preview.className = `ship-preview ${ship.previewClass}`;
        
        const name = document.createElement('span');
        name.innerText = t(ship.nameKey);
        
        const description = document.createElement('small');
        description.innerText = isLocked ? t('lockedAt', { points: ship.req }) : t('unlocked');

        card.appendChild(preview);
        card.appendChild(name);
        card.appendChild(description);
        
        shipSelectorContainer.appendChild(card);
    });
}

applyTranslations();
buildShipCards();

// --- Touch Controls ---
viewport.addEventListener('touchmove', (e) => {
    if (isGameOver) return;
    e.preventDefault();
    const rect = viewport.getBoundingClientRect();
    const touchX = e.touches[0].clientX - rect.left;
    shipX = (touchX / rect.width) * 100;
    
    if (shipX < 5) shipX = 5;
    if (shipX > 95) shipX = 95;
    
    playerShip.style.left = shipX + '%';
}, { passive: false });

function showStartScreen() {
    isGameOver = true;
    startScreen.classList.remove('hidden');
    gameOverOverlay.classList.add('hidden');
    buildShipCards();
}

function selectShip(type) {
    const ship = shipData.find(s => s.id === type);
    if (highScore < ship.req) return;

    selectedShipType = type;
    
    document.querySelectorAll('.ship-card').forEach(c => c.classList.remove('selected'));
    document.getElementById(`card-${type}`).classList.add('selected');

    playerShip.className = `spaceship type-${type}`;
}

function startGame() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    isGameOver = false;
    score = 0;
    doubleShotEndTime = 0;

    hasShield = (selectedShipType === 'ship3');
    updateShieldUI();

    scoreElement.innerText = score;
    startScreen.classList.add('hidden');
    gameOverOverlay.classList.add('hidden');
    
    lasers.forEach(l => l.el.remove());
    asteroids.forEach(a => a.el.remove());
    enemies.forEach(e => e.el.remove());
    powerUps.forEach(p => p.el.remove());

    lasers = []; asteroids = []; enemies = []; powerUps = [];

    shipX = 50;
    playerShip.style.left = '50%';

    clearInterval(spawnTimer); clearInterval(enemyTimer);
    clearInterval(powerUpTimer); clearInterval(shootTimer);
    cancelAnimationFrame(gameLoopId);

    const fireInterval = (selectedShipType === 'ship2') ? 140 : 210;

    shootTimer = setInterval(shootLaser, fireInterval);
    spawnTimer = setInterval(createAsteroid, 950);
    enemyTimer = setInterval(createEnemy, 3800);
    powerUpTimer = setInterval(createPowerUp, 7000);

    gameLoop();
}

function updateShieldUI() {
    if (hasShield) {
        shieldAura.classList.add('active');
        shieldValElement.innerText = t('shieldActive');
        shieldValElement.style.color = "#00d2ff";
    } else {
        shieldAura.classList.remove('active');
        shieldValElement.innerText = t('shieldNone');
        shieldValElement.style.color = "white";
    }
}

function shootLaser() {
    if (isGameOver) return;
    
    playSound('laser');
    
    const shipRect = playerShip.getBoundingClientRect();
    const vpRect = viewport.getBoundingClientRect();
    const topY = shipRect.top - vpRect.top;

    // Check against current timestamp for double shot powerup duration
    if (Date.now() < doubleShotEndTime) {
        createLaserElement(shipRect.left + 4 - vpRect.left, topY);
        createLaserElement(shipRect.right - 9 - vpRect.left, topY);
    } else {
        const centerX = shipRect.left + shipRect.width / 2 - vpRect.left;
        createLaserElement(centerX - 2.5, topY);
    }
}

function createLaserElement(x, y) {
    const laserEl = document.createElement('div');
    laserEl.classList.add('laser');
    laserEl.style.left = x + 'px';
    laserEl.style.top = y + 'px';
    viewport.appendChild(laserEl);
    lasers.push({ el: laserEl, x: x, y: y });
}

function createAsteroid() {
    if (isGameOver) return;

    const asteroidEl = document.createElement('div');
    asteroidEl.classList.add('asteroid');

    const size = Math.random() * 25 + 25;
    const x = Math.random() * (viewport.offsetWidth - size);

    asteroidEl.style.width = size + 'px';
    asteroidEl.style.height = size + 'px';
    asteroidEl.style.left = x + 'px';
    asteroidEl.style.top = -size + 'px';

    viewport.appendChild(asteroidEl);
    
    const speed = Math.random() * 2 + 2;

    asteroids.push({ el: asteroidEl, x: x, y: -size, size: size, speed: speed });
}

function createEnemy() {
    if (isGameOver) return;
    const enemyEl = document.createElement('div');
    enemyEl.classList.add('enemy-ship');

    const x = Math.random() * (viewport.offsetWidth - 42);
    enemyEl.style.left = x + 'px';
    enemyEl.style.top = '-42px';

    viewport.appendChild(enemyEl);
    enemies.push({ el: enemyEl, x: x, y: -42, speed: 2.5, dirX: Math.random() > 0.5 ? 1.5 : -1.5 });
}

function createPowerUp() {
    if (isGameOver) return;
    const powerEl = document.createElement('div');
    powerEl.classList.add('power-up');

    const type = Math.random() > 0.5 ? 'shield' : 'double';
    if (type === 'shield') {
        powerEl.classList.add('power-shield');
        powerEl.innerText = '🛡️';
    } else {
        powerEl.classList.add('power-double');
        powerEl.innerText = '⚡';
    }

    const x = Math.random() * (viewport.offsetWidth - 32);
    powerEl.style.left = x + 'px';
    powerEl.style.top = '-32px';

    viewport.appendChild(powerEl);
    powerUps.push({ el: powerEl, x: x, y: -32, type: type });
}

function gameLoop() {
    if (isGameOver) return;

    // 1. Lasers
    for (let i = lasers.length - 1; i >= 0; i--) {
        let l = lasers[i];
        l.y -= 14;
        l.el.style.top = l.y + 'px';

        if (l.y < -20) {
            l.el.remove();
            lasers.splice(i, 1);
        }
    }

    // 2. Asteroids
    for (let aIndex = asteroids.length - 1; aIndex >= 0; aIndex--) {
        let a = asteroids[aIndex];
        a.y += a.speed;
        a.el.style.top = a.y + 'px';

        for (let lIndex = lasers.length - 1; lIndex >= 0; lIndex--) {
            let l = lasers[lIndex];
            if (l.x > a.x && l.x < a.x + a.size && l.y > a.y && l.y < a.y + a.size) {
                playSound('explosion');
                triggerScreenShake();
                createExplosion(a.x + a.size / 2, a.y + a.size / 2, ['#ff0', '#ff5500', '#00ffcc']);
                a.el.remove();
                asteroids.splice(aIndex, 1);
                l.el.remove();
                lasers.splice(lIndex, 1);
                score += 10;
                scoreElement.innerText = score;
                break;
            }
        }

        if (checkCollision(playerShip, a.x, a.y, a.size, a.size)) {
            a.el.remove();
            asteroids.splice(aIndex, 1);
            handlePlayerHit();
            break;
        }

        if (a.y > viewport.offsetHeight) {
            a.el.remove();
            asteroids.splice(aIndex, 1);
        }
    }

    // 3. Enemy Ships
    for (let eIndex = enemies.length - 1; eIndex >= 0; eIndex--) {
        let e = enemies[eIndex];
        e.y += e.speed;
        e.x += e.dirX;

        if (e.x <= 0 || e.x >= viewport.offsetWidth - 42) e.dirX *= -1;

        e.el.style.top = e.y + 'px';
        e.el.style.left = e.x + 'px';

        for (let lIndex = lasers.length - 1; lIndex >= 0; lIndex--) {
            let l = lasers[lIndex];
            if (l.x > e.x && l.x < e.x + 42 && l.y > e.y && l.y < e.y + 42) {
                playSound('explosion');
                triggerScreenShake();
                createExplosion(e.x + 21, e.y + 21, ['#ff0055', '#00d2ff', '#ffffff']);
                e.el.remove();
                enemies.splice(eIndex, 1);
                l.el.remove();
                lasers.splice(lIndex, 1);
                score += 30;
                scoreElement.innerText = score;
                break;
            }
        }

        if (checkCollision(playerShip, e.x, e.y, 42, 42)) {
            e.el.remove();
            enemies.splice(eIndex, 1);
            handlePlayerHit();
            break;
        }

        if (e.y > viewport.offsetHeight) {
            e.el.remove();
            enemies.splice(eIndex, 1);
        }
    }

    // 4. Power-ups
    for (let pIndex = powerUps.length - 1; pIndex >= 0; pIndex--) {
        let p = powerUps[pIndex];
        p.y += 2;
        p.el.style.top = p.y + 'px';

        if (checkCollision(playerShip, p.x, p.y, 32, 32)) {
            playSound('powerup');
            if (p.type === 'shield') {
                hasShield = true;
                updateShieldUI();
            } else if (p.type === 'double') {
                doubleShotEndTime = Date.now() + 15000; // Fixed: Sets 15 second duration from current time
            }
            p.el.remove();
            powerUps.splice(pIndex, 1);
        } else if (p.y > viewport.offsetHeight) {
            p.el.remove();
            powerUps.splice(pIndex, 1);
        }
    }

    gameLoopId = requestAnimationFrame(gameLoop);
}

function checkCollision(ship, objX, objY, objW, objH) {
    const sRect = ship.getBoundingClientRect();
    const vRect = viewport.getBoundingClientRect();
    const sX = sRect.left - vRect.left;
    const sY = sRect.top - vRect.top;

    return (
        sX < objX + objW &&
        sX + sRect.width > objX &&
        sY < objY + objH &&
        sY + sRect.height > objY
    );
}

function handlePlayerHit() {
    playSound('explosion');
    triggerScreenShake();
    if (hasShield) {
        hasShield = false;
        updateShieldUI();
        createExplosion(shipX * viewport.offsetWidth / 100, viewport.offsetHeight - 60, ['#00d2ff']);
    } else {
        gameOver();
    }
}

function triggerScreenShake() {
    container.classList.add('shake');
    setTimeout(() => container.classList.remove('shake'), 150);
}

function createExplosion(x, y, colors) {
    for (let i = 0; i < 16; i++) {
        const p = document.createElement('div');
        p.classList.add('particle');
        p.style.left = x + 'px';
        p.style.top = y + 'px';
        p.style.color = colors[Math.floor(Math.random() * colors.length)];
        p.style.backgroundColor = 'currentColor';
        
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * 50 + 10;
        p.style.setProperty('--dx', Math.cos(angle) * dist + 'px');
        p.style.setProperty('--dy', Math.sin(angle) * dist + 'px');

        viewport.appendChild(p);
        setTimeout(() => p.remove(), 500);
    }
}

function gameOver() {
    isGameOver = true;
    playSound('gameover');
    
    clearInterval(spawnTimer);
    clearInterval(enemyTimer);
    clearInterval(powerUpTimer);
    clearInterval(shootTimer);

    if (score > highScore) {
        highScore = score;
        localStorage.setItem('space_high_score', highScore);
        highScoreElement.innerText = highScore;
    }

    finalScoreElement.innerText = score;
    
    const reviveModal = document.getElementById('revive-modal');
    if (reviveModal) {
        reviveModal.style.display = 'block';
    } else {
        gameOverOverlay.classList.remove('hidden');
    }
}

function watchAdAndRevive() {
    const reviveModal = document.getElementById('revive-modal');
    if (reviveModal) reviveModal.style.display = 'none';

    hasShield = true;
    updateShieldUI();
    isGameOver = false;

    const fireInterval = (selectedShipType === 'ship2') ? 140 : 210;
    shootTimer = setInterval(shootLaser, fireInterval);
    spawnTimer = setInterval(createAsteroid, 950);
    enemyTimer = setInterval(createEnemy, 3800);
    powerUpTimer = setInterval(createPowerUp, 7000);

    gameLoop();
}

function skipReviveAndGameOver() {
    const reviveModal = document.getElementById('revive-modal');
    if (reviveModal) reviveModal.style.display = 'none';
    gameOverOverlay.classList.remove('hidden');
}

const vfxSlider = document.getElementById('vfx-slider');
if (vfxSlider) {
    vfxSlider.addEventListener('input', (e) => {
        masterVolume = parseFloat(e.target.value);
    });
}