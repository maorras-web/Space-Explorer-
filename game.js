const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

canvas.width = 800;
canvas.height = 600;

// ==========================================
// 1. הגדרות משחק ומנגנונים
// ==========================================
let settings = {
    vfxVolume: 0.8,
    difficulty: "normal",
    defaultShip: "blue",
    sensitivity: 5
};

const WEAPONS = {
    PLASMA: { name: "פלאזמה", speed: 12, damage: 20, color: "#00f0ff" },
    RED_LIGHTNING: { name: "חשמל אדום", speed: 18, damage: 35, color: "#ff0033" },
    YELLOW_ORB: { name: "כדור אנרגיה", speed: 8, damage: 50, color: "#ffff00" }
};

let player = {
    x: 380,
    y: 500,
    width: 40,
    height: 40,
    health: 100,
    maxHealth: 100,
    currentWeapon: WEAPONS.PLASMA,
    backupSummoned: false
};

let bullets = [];
let asteroids = [];
let enemies = [];
let backupShips = [];
let boss = null;
let postGameChallenge = false;
let isGameRunning = false;

// שמע של פעימה אנרגטית לפיראטים
const energyPulseAudio = new Audio(); // מקום להוספת סאונד פעימה

// ==========================================
// 2. תחילת משחק והגדרות
// ==========================================
function startGame() {
    document.getElementById("main-menu").classList.add("hidden");
    isGameRunning = true;
    resetGame();
    gameLoop();
}

function toggleSettings() {
    const menu = document.getElementById("settings-menu");
    menu.classList.toggle("hidden");
}

function updateSettings() {
    settings.vfxVolume = document.getElementById("vfx-volume").value / 100;
    settings.difficulty = document.getElementById("difficulty").value;
    settings.defaultShip = document.getElementById("default-ship").value;
    settings.sensitivity = parseInt(document.getElementById("sensitivity").value);
}

function resetGame() {
    player.health = 100;
    player.x = 380;
    player.y = 500;
    player.backupSummoned = false;
    bullets = [];
    asteroids = [];
    enemies = [];
    backupShips = [];
    boss = null;
    postGameChallenge = false;
}

// ==========================================
// 3. תנועה וירי
// ==========================================
window.addEventListener("mousemove", (e) => {
    if (!isGameRunning) return;
    const rect = canvas.getBoundingClientRect();
    let targetX = e.clientX - rect.left - player.width / 2;
    player.x += (targetX - player.x) * (settings.sensitivity / 10);
});

window.addEventListener("click", () => {
    if (!isGameRunning) return;

    // אתגר פוסט-בוס: ירי של כל הנשקים המשולבים בבת אחת!
    if (postGameChallenge) {
        bullets.push({ x: player.x + 20, y: player.y, type: "PLASMA", speed: 12 });
        bullets.push({ x: player.x + 10, y: player.y, type: "RED_LIGHTNING", speed: 18 });
        bullets.push({ x: player.x + 30, y: player.y, type: "YELLOW_ORB", speed: 8 });
    } else {
        bullets.push({ x: player.x + 20, y: player.y, type: "PLASMA", speed: 12 });
    }
});

// ==========================================
// 4. ציור אלמנטים (Craters, Health Bar, Weapons)
// ==========================================

// ציור מד חיים משולש ירוק
function drawTriangleHealthBar(x, y, width, height, current, max) {
    const percent = Math.max(0, current / max);
    ctx.save();
    ctx.translate(x, y - 15);

    // מסגרת משולש
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(width / 2, -height);
    ctx.lineTo(width, 0);
    ctx.closePath();
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();

    // מילוי ירוק
    if (percent > 0) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo((width / 2) * percent, -height * percent);
        ctx.lineTo(width * percent, 0);
        ctx.closePath();
        ctx.fillStyle = "#00ff66";
        ctx.fill();
    }
    ctx.restore();
}

// ציור אסטרואידים עם מכתשים (הפחתה ב-40%)
function spawnAsteroid() {
    if (Math.random() < 0.012) { // תדירות מופחתת ב-40%
        asteroids.push({
            x: Math.random() * (canvas.width - 40),
            y: -40,
            radius: 20 + Math.random() * 15,
            speed: 2 + Math.random() * 2
        });
    }
}

function drawAsteroids() {
    asteroids.forEach(ast => {
        ctx.save();
        ctx.translate(ast.x, ast.y);
        
        // גוף אסטרואיד
        ctx.beginPath();
        ctx.arc(0, 0, ast.radius, 0, Math.PI * 2);
        ctx.fillStyle = "#555";
        ctx.fill();

        // מכתשי פגיעה (Craters)
        const craters = [
            { x: -ast.radius * 0.3, y: -ast.radius * 0.2, r: ast.radius * 0.2 },
            { x: ast.radius * 0.2, y: ast.radius * 0.3, r: ast.radius * 0.25 }
        ];
        craters.forEach(c => {
            ctx.beginPath();
            ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
            ctx.fillStyle = "#333";
            ctx.fill();
        });

        ctx.restore();
        ast.y += ast.speed;
    });
}

// חלליות תמיכה בחיים נמוכים
function checkBackupSupport() {
    if (player.health < 30 && !player.backupSummoned) {
        player.backupSummoned = true;
        backupShips.push({ x: player.x - 60, y: player.y + 20 });
        backupShips.push({ x: player.x + 60, y: player.y + 20 });
    }
}

// צפייה בפרסומת והחייאה (Revive)
function watchAdAndRevive() {
    alert("פרסומת מופעלת... (החזרה לחיים)");
    player.health = 100;
    document.getElementById("revive-screen").classList.add("hidden");
    isGameRunning = true;
    gameLoop();
}

function triggerReviveScreen() {
    isGameRunning = false;
    document.getElementById("revive-screen").classList.remove("hidden");
}

// ==========================================
// 5. לולאת המשחק הראשי (Game Loop)
// ==========================================
function gameLoop() {
    if (!isGameRunning) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // ציור שחקן ומד חיים משולש
    ctx.fillStyle = settings.defaultShip === "red" ? "#ff0033" : "#00f0ff";
    ctx.fillRect(player.x, player.y, player.width, player.height);
    drawTriangleHealthBar(player.x, player.y, player.width, 15, player.health, player.maxHealth);

    // בדיקת חלליות עזר
    checkBackupSupport();
    backupShips.forEach(b => {
        ctx.fillStyle = "#00ff66";
        ctx.fillRect(b.x, b.y, 20, 20);
    });

    // ייצור וציור אסטרואידים
    spawnAsteroid();
    drawAsteroids();

    // ציור קליעים
    bullets.forEach((b, index) => {
        ctx.fillStyle = b.type === "RED_LIGHTNING" ? "#ff0033" : (b.type === "YELLOW_ORB" ? "#ffff00" : "#00f0ff");
        ctx.fillRect(b.x, b.y, 6, 12);
        b.y -= b.speed;
        if (b.y < 0) bullets.splice(index, 1);
    });

    // בדיקת פסיקת חיים (הדגמה למסך Revive)
    if (player.health <= 0) {
        triggerReviveScreen();
        return;
    }

    requestAnimationFrame(gameLoop);
}