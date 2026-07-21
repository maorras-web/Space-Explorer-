const viewport = document.getElementById('viewport');
const playerShip = document.getElementById('player-ship');
const shieldAura = document.getElementById('shield-aura');
const shieldValElement = document.getElementById('shield-val');
const hpValElement = document.getElementById('hp-val');
const scoreElement = document.getElementById('score');
const highScoreElement = document.getElementById('high-score');
const finalScoreElement = document.getElementById('final-score');
const startScreen = document.getElementById('start-screen');
const pauseModal = document.getElementById('pause-modal');
const gameOverOverlay = document.getElementById('game-over-overlay');
const shipSelectorContainer = document.getElementById('ship-selector-container');
const adModal = document.getElementById('ad-modal');
const reviveBtn = document.getElementById('revive-btn');

let score = 0;
let highScore = localStorage.getItem('space_high_score') || 0;
let isGameOver = true;
let isPaused = false;
let shipX = 50;

let playerHP = 3;
let selectedShipType = 'ship1';
let currentWeaponType = 'single';
let hasShield = false;
let weaponPowerEndTime = 0;
let hasRevivedThisGame = false; // הגבלה להחייאה פעם אחת במשחק

let lasers = [];
let enemyLasers = [];
let asteroids = [];
let enemies = [];
let powerUps = [];

let gameLoopId;
let spawnTimer, enemyTimer, powerUpTimer, shootTimer, enemyShootTimer;

// Audio System
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSound(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain); 
    gain.connect(audioCtx.destination);
    gain.gain.setValueAtTime(0.2, audioCtx.currentTime);

    if (type === 'laser') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(800, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.08);
    } else if (type === 'explosion') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(20, audioCtx.currentTime + 0.15);
    }
    osc.start(); 
    osc.stop(audioCtx.currentTime + 0.12);
}

highScoreElement.innerText = highScore;

const shipData = [
    { id: 'ship1', name: 'Alpha Scout' },
    { id: 'ship2', name: 'Phantom X' },
    { id: 'ship3', name: 'Neon Titan' }
];

function buildShipCards() {
    shipSelectorContainer.innerHTML = '';
    shipData.forEach(ship => {
        const card = document.createElement('div');
        card.className = `ship-card ${ship.id === selectedShipType ? 'selected' : ''}`;
        card.onclick = () => selectShip(ship.id);
        card.innerHTML = `<div class="ship-preview p-${ship.id}"></div><span>${ship.name}</span>`;
        shipSelectorContainer.appendChild(card);
    });
}
buildShipCards();

function selectShip(type) {
    selectedShipType = type;
    buildShipCards();
    playerShip.className = `spaceship type-${type}`;
}

function selectWeapon(type) {
    currentWeaponType = type;
    document.querySelectorAll('.weapon-btn').forEach(b => b.classList.remove('selected'));
    document.getElementById(`w-${type}`).classList.add('selected');
}

function togglePause() {
    if (isGameOver) return;
    isPaused = !isPaused;
    if (isPaused) {
        pauseModal.classList.remove('hidden');
    } else {
        pauseModal.classList.add('hidden');
        gameLoop();
    }
}

// Touch & Drag Movement
viewport.addEventListener('touchmove', (e) => {
    if (isGameOver || isPaused) return;
    e.preventDefault();
    const rect = viewport.getBoundingClientRect();
    const touchX = e.touches[0].clientX - rect.left;
    shipX = (touchX / rect.width) * 100;
    shipX = Math.max(5, Math.min(95, shipX));
    playerShip.style.left = shipX + '%';
}, { passive: false });

function showStartScreen() {
    isGameOver = true;
    isPaused = false;
    startScreen.classList.remove('hidden');
    pauseModal.classList.add('hidden');
    gameOverOverlay.classList.add('hidden');
    clearIntervals();
}

function updateHPUI() {
    let hearts = '';
    for (let i = 0; i < playerHP; i++) hearts += '❤️';
    hpValElement.innerText = hearts || '💔';
}

function startGame() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    isGameOver = false;
    isPaused = false;
    score = 0;
    playerHP = 3; 
    hasShield = (selectedShipType === 'ship3');
    hasRevivedThisGame = false;
    reviveBtn.style.display = 'block';

    updateShieldUI();
    updateHPUI();
    scoreElement.innerText = score;

    startScreen.classList.add('hidden');
    gameOverOverlay.classList.add('hidden');
    pauseModal.classList.add('hidden');

    clearAllEntities();
    shipX = 50; 
    playerShip.style.left = '50%';

    clearIntervals();
    shootTimer = setInterval(shootLaser, 180);
    spawnTimer = setInterval(createAsteroid, 900);
    enemyTimer = setInterval(createEnemy, 3200);
    enemyShootTimer = setInterval(enemiesShoot, 2000);
    powerUpTimer = setInterval(createPowerUp, 8000);

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
    clearInterval(spawnTimer); 
    clearInterval(enemyTimer);
    clearInterval(powerUpTimer); 
    clearInterval(shootTimer);
    clearInterval(enemyShootTimer);
    cancelAnimationFrame(gameLoopId);
}

function updateShieldUI() {
    shieldAura.className = hasShield ? 'shield-aura active' : 'shield-aura';
    shieldValElement.innerText = hasShield ? 'Active' : 'None';
}

function shootLaser() {
    if (isGameOver || isPaused) return;
    playSound('laser');
    
    const shipRect = playerShip.getBoundingClientRect();
    const vpRect = viewport.getBoundingClientRect();
    const topY = shipRect.top - vpRect.top;
    const centerX = shipRect.left + shipRect.width / 2 - vpRect.left;

    let activeWeapon = currentWeaponType;
    if (Date.now() < weaponPowerEndTime) activeWeapon = 'triple';

    if (activeWeapon === 'single') {
        createLaserElement(centerX - 2.5, topY, 0);
    } else if (activeWeapon === 'double') {
        createLaserElement(shipRect.left + 2 - vpRect.left, topY, 0);
        createLaserElement(shipRect.right - 7 - vpRect.left, topY, 0);
    } else if (activeWeapon === 'triple') {
        createLaserElement(centerX - 2.5, topY, 0);
        createLaserElement(centerX - 10, topY, -2);
        createLaserElement(centerX + 5, topY, 2);
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

function enemiesShoot() {
    if (isGameOver || isPaused) return;
    enemies.forEach(e => {
        const laserEl = document.createElement('div');
        laserEl.classList.add('enemy-laser');
        laserEl.style.left = (e.x + 19) + 'px';
        laserEl.style.top = (e.y + 40) + 'px';
        viewport.appendChild(laserEl);
        enemyLasers.push({ el: laserEl, x: e.x + 19, y: e.y + 40, speed: 5 });
    });
}

function createAsteroid() {
    if (isGameOver || isPaused) return;
    const asteroidEl = document.createElement('div');
    asteroidEl.classList.add('asteroid');
    const size = Math.random() * 25 + 25;
    const x = Math.random() * (viewport.offsetWidth - size);
    asteroidEl.style.width = size + 'px'; 
    asteroidEl.style.height = size + 'px';
    asteroidEl.style.left = x + 'px'; 
    asteroidEl.style.top = -size + 'px';
    viewport.appendChild(asteroidEl);
    asteroids.push({ el: asteroidEl, x: x, y: -size, size: size, speed: Math.random() * 2 + 2 });
}

function createEnemy() {
    if (isGameOver || isPaused) return;
    const enemyEl = document.createElement('div');
    enemyEl.classList.add('enemy-ship');
    const x = Math.random() * (viewport.offsetWidth - 42);
    enemyEl.style.left = x + 'px'; 
    enemyEl.style.top = '-42px';
    viewport.appendChild(enemyEl);
    enemies.push({ el: enemyEl, x: x, y: -42, speed: 2, dirX: Math.random() > 0.5 ? 1 : -1 });
}

function createPowerUp() {
    if (isGameOver || isPaused) return;
    const powerEl = document.createElement('div');
    powerEl.classList.add('power-up');
    const type = Math.random() > 0.5 ? 'shield' : 'double';
    powerEl.innerText = (type === 'shield') ? '🛡️' : '⚡';
    const x = Math.random() * (viewport.offsetWidth - 32);
    powerEl.style.left = x + 'px'; 
    powerEl.style.top = '-32px';
    viewport.appendChild(powerEl);
    powerUps.push({ el: powerEl, x: x, y: -32, type: type });
}

function gameLoop() {
    if (isGameOver || isPaused) return;

    for (let i = lasers.length - 1; i >= 0; i--) {
        let l = lasers[i];
        l.y -= 12; 
        l.x += l.vx;
        l.el.style.top = l.y + 'px'; 
        l.el.style.left = l.x + 'px';
        if (l.y < -20) { l.el.remove(); lasers.splice(i, 1); }
    }

    for (let i = enemyLasers.length - 1; i >= 0; i--) {
        let el = enemyLasers[i];
        el.y += el.speed;
        el.el.style.top = el.y + 'px';

        if (checkCollision(playerShip, el.x, el.y, 5, 16)) {
            el.el.remove(); 
            enemyLasers.splice(i, 1);
            handlePlayerHit(); 
            break;
        }
        if (el.y > viewport.offsetHeight) { el.el.remove(); enemyLasers.splice(i, 1); }
    }

    for (let aIndex = asteroids.length - 1; aIndex >= 0; aIndex--) {
        let a = asteroids[aIndex];
        a.y += a.speed; 
        a.el.style.top = a.y + 'px';

        for (let lIndex = lasers.length - 1; lIndex >= 0; lIndex--) {
            let l = lasers[lIndex];
            if (l.x > a.x && l.x < a.x + a.size && l.y > a.y && l.y < a.y + a.size) {
                playSound('explosion');
                a.el.remove(); asteroids.splice(aIndex, 1);
                l.el.remove(); lasers.splice(lIndex, 1);
                score += 10; scoreElement.innerText = score;
                break;
            }
        }

        if (checkCollision(playerShip, a.x, a.y, a.size, a.size)) {
            a.el.remove(); 
            asteroids.splice(aIndex, 1);
            handlePlayerHit(); 
            break;
        }
        if (a.y > viewport.offsetHeight) { a.el.remove(); asteroids.splice(aIndex, 1); }
    }

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
                e.el.remove(); enemies.splice(eIndex, 1);
                l.el.remove(); lasers.splice(lIndex, 1);
                score += 30; scoreElement.innerText = score;
                break;
            }
        }

        if (checkCollision(playerShip, e.x, e.y, 42, 42)) {
            e.el.remove(); 
            enemies.splice(eIndex, 1);
            handlePlayerHit(); 
            break;
        }
        if (e.y > viewport.offsetHeight) { e.el.remove(); enemies.splice(eIndex, 1); }
    }

    for (let pIndex = powerUps.length - 1; pIndex >= 0; pIndex--) {
        let p = powerUps[pIndex];
        p.y += 2; 
        p.el.style.top = p.y + 'px';
        if (checkCollision(playerShip, p.x, p.y, 32, 32)) {
            if (p.type === 'shield') { hasShield = true; updateShieldUI(); }
            else { weaponPowerEndTime = Date.now() + 10000; }
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
        hasShield = false;
        updateShieldUI();
    } else {
        playerHP--;
        updateHPUI();
        if (playerHP <= 0) {
            gameOver();
        }
    }
}

// Watch Ad to Revive Mechanism
function watchAdToRevive() {
    gameOverOverlay.classList.add('hidden');
    adModal.classList.remove('hidden');
    let timeLeft = 3;
    document.getElementById('ad-timer').innerText = timeLeft;

    const adInterval = setInterval(() => {
        timeLeft--;
        document.getElementById('ad-timer').innerText = timeLeft;
        if (timeLeft <= 0) {
            clearInterval(adInterval);
            adModal.classList.add('hidden');
            
            // Revive Player
            playerHP = 1;
            hasRevivedThisGame = true;
            reviveBtn.style.display = 'none'; // אפשר להחיות רק פעם אחת בסיבוב
            updateHPUI();
            
            isGameOver = false;
            clearAllEntities();
            
            shootTimer = setInterval(shootLaser, 180);
            spawnTimer = setInterval(createAsteroid, 900);
            enemyTimer = setInterval(createEnemy, 3200);
            enemyShootTimer = setInterval(enemiesShoot, 2000);
            powerUpTimer = setInterval(createPowerUp, 8000);
            
            gameLoop();
        }
    }, 1000);
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
}