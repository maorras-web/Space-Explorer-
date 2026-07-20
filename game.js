const viewport = document.getElementById('viewport');
const playerShip = document.getElementById('player-ship');
const shieldAura = document.getElementById('shield-aura');
const shieldValElement = document.getElementById('shield-val');
const scoreElement = document.getElementById('score');
const highScoreElement = document.getElementById('high-score');
const finalScoreElement = document.getElementById('final-score');
const gameOverOverlay = document.getElementById('game-over-overlay');
const settingsModal = document.getElementById('settings-modal');
const bgColorPicker = document.getElementById('bg-color-picker');

let score = 0;
let highScore = localStorage.getItem('space_high_score') || 0;
let isGameOver = true;
let shipX = 50;

let hasShield = false;
let doubleShotTime = 0; // זמן שנשאר לירייה כפולה

let lasers = [];
let asteroids = [];
let enemies = [];
let powerUps = [];

let gameLoopId;
let spawnTimer;
let enemyTimer;
let powerUpTimer;
let shootTimer;

highScoreElement.innerText = highScore;

// --- שליטה במגע ---
viewport.addEventListener('touchmove', (e) => {
    if (isGameOver) return;
    e.preventDefault();
    const rect = viewport.getBoundingClientRect();
    const touchX = e.touches[0].clientX - rect.left;
    shipX = (touchX / rect.width) * 100;
    
    if (shipX < 5) shipX = 5;
    if (shipX > 95) shipX = 95;
    
    playerShip.style.left = shipX + '%';
});

function startGame() {
    isGameOver = false;
    score = 0;
    hasShield = false;
    doubleShotTime = 0;
    updateShieldUI();

    scoreElement.innerText = score;
    gameOverOverlay.classList.add('hidden');
    
    // ניקוי אלמנטים ישנים
    lasers.forEach(l => l.el.remove());
    asteroids.forEach(a => a.el.remove());
    enemies.forEach(e => e.el.remove());
    powerUps.forEach(p => p.el.remove());

    lasers = [];
    asteroids = [];
    enemies = [];
    powerUps = [];

    shipX = 50;
    playerShip.style.left = '50%';

    clearInterval(spawnTimer);
    clearInterval(enemyTimer);
    clearInterval(powerUpTimer);
    clearInterval(shootTimer);
    cancelAnimationFrame(gameLoopId);

    // תזמוני ייצור אלמנטים
    shootTimer = setInterval(shootLaser, 220);
    spawnTimer = setInterval(createAsteroid, 600);
    enemyTimer = setInterval(createEnemy, 4000);
    powerUpTimer = setInterval(createPowerUp, 7000);

    gameLoop();
}

function updateShieldUI() {
    if (hasShield) {
        shieldAura.classList.add('active');
        shieldValElement.innerText = "פעיל";
        shieldValElement.style.color = "#00d2ff";
    } else {
        shieldAura.classList.remove('active');
        shieldValElement.innerText = "אין";
        shieldValElement.style.color = "white";
    }
}

function shootLaser() {
    if (isGameOver) return;

    const shipRect = playerShip.getBoundingClientRect();
    const vpRect = viewport.getBoundingClientRect();
    const topY = shipRect.top - vpRect.top;

    if (doubleShotTime > 0) {
        // ירייה כפולה
        doubleShotTime -= 220;
        createLaserElement(shipRect.left + 5 - vpRect.left, topY);
        createLaserElement(shipRect.right - 9 - vpRect.left, topY);
    } else {
        // ירייה רגילה
        const centerX = shipRect.left + shipRect.width / 2 - vpRect.left;
        createLaserElement(centerX - 2, topY);
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
    const speed = Math.random() * 2 + 2 + (score / 60);

    asteroids.push({ el: asteroidEl, x: x, y: -size, size: size, speed: speed });
}

function createEnemy() {
    if (isGameOver) return;
    const enemyEl = document.createElement('div');
    enemyEl.classList.add('enemy-ship');

    const x = Math.random() * (viewport.offsetWidth - 40);
    enemyEl.style.left = x + 'px';
    enemyEl.style.top = '-40px';

    viewport.appendChild(enemyEl);
    enemies.push({ el: enemyEl, x: x, y: -40, speed: 2.5, dirX: Math.random() > 0.5 ? 1.5 : -1.5 });
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

    const x = Math.random() * (viewport.offsetWidth - 30);
    powerEl.style.left = x + 'px';
    powerEl.style.top = '-30px';

    viewport.appendChild(powerEl);
    powerUps.push({ el: powerEl, x: x, y: -30, type: type });
}

function gameLoop() {
    if (isGameOver) return;

    // 1. לייזרים
    for (let i = lasers.length - 1; i >= 0; i--) {
        let l = lasers[i];
        l.y -= 12;
        l.el.style.top = l.y + 'px';

        if (l.y < -20) {
            l.el.remove();
            lasers.splice(i, 1);
        }
    }

    // 2. אסטרואידים
    for (let aIndex = asteroids.length - 1; aIndex >= 0; aIndex--) {
        let a = asteroids[aIndex];
        a.y += a.speed;
        a.el.style.top = a.y + 'px';

        // בדיקת פגיעה בלייזר
        for (let lIndex = lasers.length - 1; lIndex >= 0; lIndex--) {
            let l = lasers[lIndex];
            if (l.x > a.x && l.x < a.x + a.size && l.y > a.y && l.y < a.y + a.size) {
                createExplosion(a.x + a.size / 2, a.y + a.size / 2, ['#ff0', '#ff5500']);
                a.el.remove();
                asteroids.splice(aIndex, 1);
                l.el.remove();
                lasers.splice(lIndex, 1);
                score += 10;
                scoreElement.innerText = score;
                break;
            }
        }

        // התנגשות בשחקן
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

    // 3. חלליות אויב
    for (let eIndex = enemies.length - 1; eIndex >= 0; eIndex--) {
        let e = enemies[eIndex];
        e.y += e.speed;
        e.x += e.dirX;

        // זגזג בצדדים
        if (e.x <= 0 || e.x >= viewport.offsetWidth - 40) e.dirX *= -1;

        e.el.style.top = e.y + 'px';
        e.el.style.left = e.x + 'px';

        // פגיעת לייזר באויב
        for (let lIndex = lasers.length - 1; lIndex >= 0; lIndex--) {
            let l = lasers[lIndex];
            if (l.x > e.x && l.x < e.x + 40 && l.y > e.y && l.y < e.y + 40) {
                createExplosion(e.x + 20, e.y + 20, ['#ff0055', '#00d2ff']);
                e.el.remove();
                enemies.splice(eIndex, 1);
                l.el.remove();
                lasers.splice(lIndex, 1);
                score += 30; // בונוס ניקוד גבוה לאויב
                scoreElement.innerText = score;
                break;
            }
        }

        if (checkCollision(playerShip, e.x, e.y, 40, 40)) {
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

    // 4. בונוסים (Power-ups)
    for (let pIndex = powerUps.length - 1; pIndex >= 0; pIndex--) {
        let p = powerUps[pIndex];
        p.y += 2;
        p.el.style.top = p.y + 'px';

        if (checkCollision(playerShip, p.x, p.y, 28, 28)) {
            if (p.type === 'shield') {
                hasShield = true;
                updateShieldUI();
            } else if (p.type === 'double') {
                doubleShotTime = 6000; // 6 שניות ירייה כפולה
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
    if (hasShield) {
        hasShield = false;
        updateShieldUI();
        createExplosion(shipX * viewport.offsetWidth / 100, viewport.offsetHeight - 60, ['#00d2ff']);
    } else {
        gameOver();
    }
}

function createExplosion(x, y, colors) {
    for (let i = 0; i < 14; i++) {
        const p = document.createElement('div');
        p.classList.add('particle');
        p.style.left = x + 'px';
        p.style.top = y + 'px';
        p.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * 45 + 10;
        p.style.setProperty('--dx', Math.cos(angle) * dist + 'px');
        p.style.setProperty('--dy', Math.sin(angle) * dist + 'px');

        viewport.appendChild(p);
        setTimeout(() => p.remove(), 500);
    }
}

function gameOver() {
    isGameOver = true;
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
    gameOverOverlay.classList.remove('hidden');
}

function toggleSettings() { settingsModal.classList.toggle('show'); }
function closeSettings() { settingsModal.classList.remove('show'); }

bgColorPicker.addEventListener('input', (e) => {
    document.getElementById('game-container').style.backgroundColor = e.target.value;
});