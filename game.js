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

// --- ניהול כפתורי תחתית ---
const mainMenuBtn = document.querySelector('.bottom-menu, [onclick*="showStartScreen"]');
const settingsBtn = document.querySelector('[onclick*="openSettings"]');

function setBottomButtonsVisible(visible) {
    const bottomNav = document.querySelector('.bottom-nav') || document.getElementById('bottom-nav');
    if (bottomNav) {
        bottomNav.style.display = visible ? 'flex' : 'none';
    }
}

// --- i18n ---
const translations = {
    'he': {
        'score': 'ניקוד', 'shield': 'מגן', 'shieldNone': 'אין', 'shieldActive': 'פעיל',
        'highScore': 'שיא', 'gameTitle': '🚀 Space Explorer',
        'shipSelectionLead': 'בחר חללית מתקדמת והתחל לשחק:',
        'startBtn': '🚀 התחל משחק', 'gameOverTitle': '💥 החללית הושמדה!',
        'yourScore': 'הניקוד שלך', 'mainMenuBtn': '🔄 לתפריט הראשי',
        'unlocked': 'פתוח', 'lockedAt': 'משוריין ב-{{{points}}} נק\'',
        'ship1Name': 'סייר אלפא', 'ship2Name': 'פנטום X', 'ship3Name': 'טיטאן ניאון'
    },
    'en': {
        'score': 'Score', 'shield': 'Shield', 'shieldNone': 'None', 'shieldActive': 'Active',
        'highScore': 'High Score', 'gameTitle': '🚀 Space Explorer',
        'shipSelectionLead': 'Select an advanced ship to play:',
        'startBtn': '🚀 Start Game', 'gameOverTitle': '💥 Ship Destroyed!',
        'yourScore': 'Your Score', 'mainMenuBtn': '🔄 Main Menu',
        'unlocked': 'Unlocked', 'lockedAt': 'Unlocks at {{{points}}} pts',
        'ship1Name': 'Alpha Scout', 'ship2Name': 'Phantom X', 'ship3Name': 'Neon Titan'
    }
};

let currentLang = 'en'; 
function t(key, data = {}) {
    let translation = translations[currentLang][key] || key;
    for (const dataKey in data) translation = translation.replace(`{{{${dataKey}}}}`, data[dataKey]);
    return translation;
}

let score = 0;
let highScore = localStorage.getItem('space_high_score') || 0;
let isGameOver = true;
let isPaused = false;
let shipX = 50;

let selectedShipType = 'ship1';
let currentWeaponType = 'single'; // 'single', 'double', 'triple'
let hasShield = false;
let weaponPowerEndTime = 0;

let lasers = [];
let enemyLasers = [];
let asteroids = [];
let enemies = [];
let powerUps = [];

let gameLoopId;
let spawnTimer, enemyTimer, powerUpTimer, shootTimer, enemyShootTimer;

// Audio
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let masterVolume = 0.25;

function playSound(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    let dur = 0.1;
    gain.gain.setValueAtTime(masterVolume, audioCtx.currentTime);

    if (type === 'laser') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(850, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(120, audioCtx.currentTime + 0.08);
        dur = 0.09;
    } else if (type === 'enemyLaser') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(400, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(80, audioCtx.currentTime + 0.1);
        dur = 0.1;
    } else if (type === 'explosion') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(140, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(15, audioCtx.currentTime + 0.15);
        dur = 0.18;
    } else if (type === 'powerup') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(450, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1100, audioCtx.currentTime + 0.12);
        dur = 0.15;
    }
    osc.start(); osc.stop(audioCtx.currentTime + dur);
}

highScoreElement.innerText = highScore;

const shipData = [
    { id: 'ship1', nameKey: 'ship1Name', req: 0, previewClass: 'p-ship1', defaultWeapon: 'single' },
    { id: 'ship2', nameKey: 'ship2Name', req: 200, previewClass: 'p-ship2', defaultWeapon: 'double' },
    { id: 'ship3', nameKey: 'ship3Name', req: 500, previewClass: 'p-ship3', defaultWeapon: 'triple' }
];

function buildShipCards() {
    shipSelectorContainer.innerHTML = '';
    shipData.forEach(ship => {
        const isLocked = highScore < ship.req;
        const card = document.createElement('div');
        card.id = `card-${ship.id}`;
        card.className = `ship-card ${isLocked ? 'locked' : ''} ${ship.id === selectedShipType ? 'selected' : ''}`;
        if (!isLocked) card.onclick = () => selectShip(ship.id);

        const preview = document.createElement('div');
        preview.className = `ship-preview ${ship.previewClass}`;
        const name = document.createElement('span');
        name.innerText = t(ship.nameKey);
        const description = document.createElement('small');
        description.innerText = isLocked ? t('lockedAt', { points: ship.req }) : t('unlocked');

        card.appendChild(preview); card.appendChild(name); card.appendChild(description);
        shipSelectorContainer.appendChild(card);
    });
}

buildShipCards();

viewport.addEventListener('touchmove', (e) => {
    if (isGameOver || isPaused) return;
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
    setBottomButtonsVisible(true);
    buildShipCards();
}

function selectShip(type) {
    const ship = shipData.find(s => s.id === type);
    if (highScore < ship.req) return;
    selectedShipType = type;
    currentWeaponType = ship.defaultWeapon;
    document.querySelectorAll('.ship-card').forEach(c => c.classList.remove('selected'));
    document.getElementById(`card-${type}`).classList.add('selected');
    playerShip.className = `spaceship type-${type}`;
}

function startGame() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    isGameOver = false; isPaused = false; score = 0; weaponPowerEndTime = 0;
    hasShield = (selectedShipType === 'ship3');
    updateShieldUI();

    scoreElement.innerText = score;
    startScreen.classList.add('hidden');
    gameOverOverlay.classList.add('hidden');
    setBottomButtonsVisible(false);

    clearAllEntities();

    shipX = 50; playerShip.style.left = '50%';

    clearIntervals();
    const fireInterval = (selectedShipType === 'ship2') ? 140 : 210;

    shootTimer = setInterval(shootLaser, fireInterval);
    spawnTimer = setInterval(createAsteroid, 950);
    enemyTimer = setInterval(createEnemy, 3500);
    enemyShootTimer = setInterval(enemiesShoot, 1800); // האויבים יורים כל 1.8 שניות
    powerUpTimer = setInterval(createPowerUp, 7000);

    gameLoop();
}

function clearAllEntities() {
    lasers.forEach(l => l.el.remove());
    enemyLasers.forEach(el => el.el.remove());
    asteroids.forEach(a => a.el.remove());
    enemies.forEach(e => e.el.remove());
    powerUps.forEach(p => p.el.remove());
    lasers = []; enemyLasers = []; asteroids = []; enemies = []; powerUps = [];
}

function clearIntervals() {
    clearInterval(spawnTimer); clearInterval(enemyTimer);
    clearInterval(powerUpTimer); clearInterval(shootTimer);
    clearInterval(enemyShootTimer);
    cancelAnimationFrame(gameLoopId);
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

// --- יריית השחקן (לפי סוג נשק) ---
function shootLaser() {
    if (isGameOver || isPaused) return;
    playSound('laser');
    
    const shipRect = playerShip.getBoundingClientRect();
    const vpRect = viewport.getBoundingClientRect();
    const topY = shipRect.top - vpRect.top;
    const centerX = shipRect.left + shipRect.width / 2 - vpRect.left;

    let activeWeapon = currentWeaponType;
    if (Date.now() < weaponPowerEndTime) activeWeapon = 'triple'; // שדרוג זמני בבאף

    if (activeWeapon === 'single') {
        createLaserElement(centerX - 2.5, topY, 0);
    } else if (activeWeapon === 'double') {
        createLaserElement(shipRect.left + 4 - vpRect.left, topY, 0);
        createLaserElement(shipRect.right - 9 - vpRect.left, topY, 0);
    } else if (activeWeapon === 'triple') {
        createLaserElement(centerX - 2.5, topY, 0);
        createLaserElement(centerX - 10, topY, -2); // ירייה זוויתית שמאלה
        createLaserElement(centerX + 5, topY, 2);  // ירייה זוויתית ימינה
    }
}

function createLaserElement(x, y, vx = 0) {
    const laserEl = document.createElement('div');
    laserEl.classList.add('laser');
    laserEl.style.left = x + 'px';
    laserEl.style.top = y + 'px';
    viewport.appendChild(laserEl);
    lasers.push({ el: laserEl, x: x, y: y, vx: vx });
}

// --- יריית אויבים ---
function enemiesShoot() {
    if (isGameOver || isPaused) return;
    enemies.forEach(e => {
        playSound('enemyLaser');
        const laserEl = document.createElement('div');
        laserEl.classList.add('enemy-laser');
        laserEl.style.left = (e.x + 19) + 'px';
        laserEl.style.top = (e.y + 40) + 'px';
        viewport.appendChild(laserEl);
        enemyLasers.push({ el: laserEl, x: e.x + 19, y: e.y + 40, speed: 6 });
    });
}

function createAsteroid() {
    if (isGameOver || isPaused) return;
    const asteroidEl = document.createElement('div');
    asteroidEl.classList.add('asteroid');
    const size = Math.random() * 25 + 25;
    const x = Math.random() * (viewport.offsetWidth - size);
    asteroidEl.style.width = size + 'px'; asteroidEl.style.height = size + 'px';
    asteroidEl.style.left = x + 'px'; asteroidEl.style.top = -size + 'px';
    viewport.appendChild(asteroidEl);
    asteroids.push({ el: asteroidEl, x: x, y: -size, size: size, speed: Math.random() * 2 + 2 });
}

function createEnemy() {
    if (isGameOver || isPaused) return;
    const enemyEl = document.createElement('div');
    enemyEl.classList.add('enemy-ship');
    const x = Math.random() * (viewport.offsetWidth - 42);
    enemyEl.style.left = x + 'px'; enemyEl.style.top = '-42px';
    viewport.appendChild(enemyEl);
    enemies.push({ el: enemyEl, x: x, y: -42, speed: 2, dirX: Math.random() > 0.5 ? 1.2 : -1.2 });
}

function createPowerUp() {
    if (isGameOver || isPaused) return;
    const powerEl = document.createElement('div');
    powerEl.classList.add('power-up');
    const type = Math.random() > 0.5 ? 'shield' : 'double';
    powerEl.innerText = (type === 'shield') ? '🛡️' : '⚡';
    const x = Math.random() * (viewport.offsetWidth - 32);
    powerEl.style.left = x + 'px'; powerEl.style.top = '-32px';
    viewport.appendChild(powerEl);
    powerUps.push({ el: powerEl, x: x, y: -32, type: type });
}

function gameLoop() {
    if (isGameOver || isPaused) return;

    // 1. לייזרים של השחקן
    for (let i = lasers.length - 1; i >= 0; i--) {
        let l = lasers[i];
        l.y -= 14;
        l.x += (l.vx || 0);
        l.el.style.top = l.y + 'px';
        l.el.style.left = l.x + 'px';
        if (l.y < -20) { l.el.remove(); lasers.splice(i, 1); }
    }

    // 2. לייזרים של אויבים (תקיפה בחזרה)
    for (let i = enemyLasers.length - 1; i >= 0; i--) {
        let el = enemyLasers[i];
        el.y += el.speed;
        el.el.style.top = el.y + 'px';

        if (checkCollision(playerShip, el.x, el.y, 4, 14)) {
            el.el.remove();
            enemyLasers.splice(i, 1);
            handlePlayerHit();
            break;
        }

        if (el.y > viewport.offsetHeight) {
            el.el.remove();
            enemyLasers.splice(i, 1);
        }
    }

    // 3. אסטרואידים
    for (let aIndex = asteroids.length - 1; aIndex >= 0; aIndex--) {
        let a = asteroids[aIndex];
        a.y += a.speed;
        a.el.style.top = a.y + 'px';

        for (let lIndex = lasers.length - 1; lIndex >= 0; lIndex--) {
            let l = lasers[lIndex];
            if (l.x > a.x && l.x < a.x + a.size && l.y > a.y && l.y < a.y + a.size) {
                playSound('explosion');
                createExplosion(a.x + a.size / 2, a.y + a.size / 2, ['#ff0', '#ff5500']);
                a.el.remove(); asteroids.splice(aIndex, 1);
                l.el.remove(); lasers.splice(lIndex, 1);
                score += 10; scoreElement.innerText = score;
                break;
            }
        }

        if (checkCollision(playerShip, a.x, a.y, a.size, a.size)) {
            a.el.remove(); asteroids.splice(aIndex, 1);
            handlePlayerHit(); break;
        }

        if (a.y > viewport.offsetHeight) { a.el.remove(); asteroids.splice(aIndex, 1); }
    }

    // 4. אויבים
    for (let eIndex = enemies.length - 1; eIndex >= 0; eIndex--) {
        let e = enemies[eIndex];
        e.y += e.speed; e.x += e.dirX;
        if (e.x <= 0 || e.x >= viewport.offsetWidth - 42) e.dirX *= -1;
        e.el.style.top = e.y + 'px'; e.el.style.left = e.x + 'px';

        for (let lIndex = lasers.length - 1; lIndex >= 0; lIndex--) {
            let l = lasers[lIndex];
            if (l.x > e.x && l.x < e.x + 42 && l.y > e.y && l.y < e.y + 42) {
                playSound('explosion');
                createExplosion(e.x + 21, e.y + 21, ['#ff0055', '#00d2ff']);
                e.el.remove(); enemies.splice(eIndex, 1);
                l.el.remove(); lasers.splice(lIndex, 1);
                score += 30; scoreElement.innerText = score;
                break;
            }
        }

        if (checkCollision(playerShip, e.x, e.y, 42, 42)) {
            e.el.remove(); enemies.splice(eIndex, 1);
            handlePlayerHit(); break;
        }

        if (e.y > viewport.offsetHeight) { e.el.remove(); enemies.splice(eIndex, 1); }
    }

    // 5. חיזוקים (Power-ups)
    for (let pIndex = powerUps.length - 1; pIndex >= 0; pIndex--) {
        let p = powerUps[pIndex];
        p.y += 2; p.el.style.top = p.y + 'px';

        if (checkCollision(playerShip, p.x, p.y, 32, 32)) {
            playSound('powerup');
            if (p.type === 'shield') { hasShield = true; updateShieldUI(); }
            else { weaponPowerEndTime = Date.now() + 12000; }
            p.el.remove(); powerUps.splice(pIndex, 1);
        } else if (p.y > viewport.offsetHeight) { p.el.remove(); powerUps.splice(pIndex, 1); }
    }

    gameLoopId = requestAnimationFrame(gameLoop);
}

function checkCollision(ship, objX, objY, objW, objH) {
    const sRect = ship.getBoundingClientRect();
    const vRect = viewport.getBoundingClientRect();
    const sX = sRect.left - vRect.left;
    const sY = sRect.top - vRect.top;
    return (sX < objX + objW && sX + sRect.width > objX && sY < objY + objH && sY + sRect.height > objY);
}

function handlePlayerHit() {
    playSound('explosion');
    if (hasShield) {
        hasShield = false; updateShieldUI();
    } else {
        gameOver();
    }
}

function createExplosion(x, y, colors) {
    for (let i = 0; i < 12; i++) {
        const p = document.createElement('div');
        p.classList.add('particle');
        p.style.left = x + 'px'; p.style.top = y + 'px';
        p.style.color = colors[Math.floor(Math.random() * colors.length)];
        p.style.backgroundColor = 'currentColor';
        viewport.appendChild(p);
        setTimeout(() => p.remove(), 400);
    }
}

function gameOver() {
    isGameOver = true;
    clearIntervals();
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('space_high_score', highScore);
        highScoreElement.innerText = highScore;
    }
    finalScoreElement.innerText = score;
    gameOverOverlay.classList.remove('hidden');
    setBottomButtonsVisible(true);
}