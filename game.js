// --- הגדרות בסיסיות של המשחק (Mobile & settings) ---
const spaceViewport = document.querySelector('.space-viewport');
const playerShip = document.getElementById('player-ship');
const survivalTimeElement = document.getElementById('survival-time');
const modal = document.getElementById('settings-modal'); // מעודכן ל-settings
const bgColorPicker = document.getElementById('bg-color-picker'); // NEW Color Picker
const gameContainer = document.getElementById('game-container'); // אזור הרקע

let asteroids = []; // מערך לשמירת האסטרואידים הפעילים
let gameInterval; // אינטרוואל ללולאת המשחק
let createAsteroidInterval; // אינטרוואל לייצור אסטרואידים
let timeInterval; // אינטרוואל למדידת זמן
let isGameOver = false; // דגל למצב המשחק
let startTime; // זמן תחילת המשחק
let survivalTime = 0; // זמן ההישרדות בשניות

// --- NEW לוגיקת צבע הרקע (Persistent) ---

// פונקציה לטעינת הצבע השמור והחלתה
function loadBgColor() {
    // קבלת הצבע השמור מהאחסון המקומי
    const savedColor = localStorage.getItem('spaceExplorerBgColor');
    
    if (savedColor) {
        // החלת הצבע על הרקע
        document.body.style.backgroundColor = savedColor;
        // עדכון פקד הצבע שיראה את הצבע השמור
        bgColorPicker.value = savedColor;
    }
}

// הקשבה לשינוי בפקד הצבע
bgColorPicker.addEventListener('input', () => {
    const selectedColor = bgColorPicker.value;
    // עדכון הרקע מיידית
    document.body.style.backgroundColor = selectedColor;
    // שמירת הבחירה ב-Local Storage
    localStorage.setItem('spaceExplorerBgColor', selectedColor);
});

// הפעלת פונקציית הטעינה
loadBgColor();

// --- לוגיקת תנועת המגע (Drag and Move) ---

let isDragging = false; // דגל האם השחקן גורר את האצבע
let startTouchX = 0; // מיקום המגע ההתחלתי
let shipPositionPercent = 50; // מיקום החללית התחלתי (אחוזים)

// הגדרת המיקום ההתחלתי גם בקוד
playerShip.style.left = shipPositionPercent + '%';

// התחלת המגע
spaceViewport.addEventListener('touchstart', (event) => {
    if (isGameOver) return; // מניעת תנועה אם המשחק נגמר
    isDragging = true;
    startTouchX = event.touches[0].clientX; // שמירת מיקום הנגיעה הראשונה
});

// תנועת האצבע על המסך
spaceViewport.addEventListener('touchmove', (event) => {
    if (!isDragging || isGameOver) return; // עצירה אם לא גוררים או המשחק נגמר
    
    event.preventDefault(); // מניעת גלילת המסך

    const currentTouchX = event.touches[0].clientX; // מיקום האצבע הנוכחי
    const viewportWidth = spaceViewport.offsetWidth; // רוחב אזור המשחק

    // חישוב המרחק שהאצבע עברה (בפיקסלים)
    const moveXPixels = currentTouchX - startTouchX;
    
    // המרת המרחק לפיקסלים לאחוזים מתוך רוחב המסך
    const moveXPercent = (moveXPixels / viewportWidth) * 100;
    
    // עדכון המיקום החדש
    let newPositionPercent = shipPositionPercent + moveXPercent;

    // --- בדיקת גבולות (מניעת יציאה מהמסך) ---
    // מגבלות: בין 10% (שמאל) ל-90% (ימין) מרוחב המסך.
    const shipWidthPercent = (playerShip.offsetWidth / viewportWidth) * 100;
    const padding = 5; // רווח ביטחון מהגבול
    const minPosition = shipWidthPercent / 2 + padding;
    const maxPosition = 100 - shipWidthPercent / 2 - padding;
    
    if (newPositionPercent < minPosition) newPositionPercent = minPosition;
    if (newPositionPercent > maxPosition) newPositionPercent = maxPosition;

    // עדכון המיקום הוויזואלי (בצורה חלקה ב-CSS)
    playerShip.style.left = newPositionPercent + '%';

    // שמירת המיקום הנוכחי כהתחלתי לתנועה הבאה
    shipPositionPercent = newPositionPercent;
    startTouchX = currentTouchX;
});

// סיום המגע
spaceViewport.addEventListener('touchend', () => {
    isDragging = false;
});

// --- לוגיקת האסטרואידים (בגודל ומהירות מותאמים) ---

function createAsteroid() {
    const asteroid = document.createElement('div');
    asteroid.classList.add('asteroid');
    
    // מיקום אקראי
    const randomX = Math.random() * 80 + 10;
    asteroid.style.left = randomX + '%';
    
    // גודל אקראי
    const randomSize = Math.random() * 15 + 20;
    asteroid.style.width = randomSize + 'px';
    asteroid.style.height = randomSize + 'px';

    spaceViewport.appendChild(asteroid);
    
    asteroids.push({
        element: asteroid,
        y: -40, // מיקום מעל המסך
        speed: Math.random() * 2 + 1.5
    });
}

function moveAsteroids() {
    if (isGameOver) return;

    const shipRect = playerShip.getBoundingClientRect();

    for (let i = asteroids.length - 1; i >= 0; i--) {
        let asteroid = asteroids[i];
        asteroid.y += asteroid.speed; // הזזה למטה
        asteroid.element.style.top = asteroid.y + 'px';

        const asteroidRect = asteroid.element.getBoundingClientRect();

        // בדיקת התנגשות
        if (
            shipRect.left < asteroidRect.right &&
            shipRect.right > asteroidRect.left &&
            shipRect.top < asteroidRect.bottom &&
            shipRect.bottom > asteroidRect.top
        ) {
            // התנגשות!
            gameOver();
            return;
        }

        if (asteroid.y > spaceViewport.offsetHeight) {
            asteroid.element.remove();
            asteroids.splice(i, 1);
        }
    }
}

// --- פונקציות סיום והתחלת משחק ---

function gameOver() {
    isGameOver = true;
    
    // עצירת האינטרוואלים
    clearInterval(gameInterval);
    clearInterval(createAsteroidInterval);
    clearInterval(timeInterval); 
    
    // --- NEW VFX: הפיצוץ ---
    createExplosion(playerShip);
    
    // עדכון טקסט המכ"ם לאזעקה
    document.querySelector('.radar-scan span').innerText = "אזעקת התנגשות!";
    document.querySelector('.radar-scan').style.borderColor = "#ff4757"; // אדום
    document.querySelector('.radar-scan').style.color = "#ff4757";

    // שינוי כפתור ההתחלה ל"🔄"
    document.querySelector('.action-start').innerHTML = "🔄 שוב";
}

function startGame() {
    // איפוס מצב המשחק
    isGameOver = false;
    asteroids.forEach(a => a.element.remove()); // ניקוי אסטרואידים
    asteroids = [];
    shipPositionPercent = 50; // איפוס מיקום החללית
    playerShip.style.left = '50%';
    survivalTime = 0; // איפוס הזמן
    survivalTimeElement.innerText = "0";

    // שינוי כפתור ההתחלה
    document.querySelector('.action-start').innerHTML = "🚀 התחל";

    // הפעלה
    startTime = Date.now();
    timeInterval = setInterval(updateTime, 1000); 
    createAsteroidInterval = setInterval(createAsteroid, 1000); // ייצור אסטרואידים
    gameInterval = setInterval(gameLoop, 20); // לולאת תנועה
    
    // עדכון טקסט המכ"ם
    document.querySelector('.radar-scan span').innerText = "זהירות! מטר!";
    document.querySelector('.radar-scan').style.borderColor = "#00ff00"; // ירוק
    document.querySelector('.radar-scan').style.color = "#00ff00";
}

function updateTime() {
    survivalTime = Math.floor((Date.now() - startTime) / 1000);
    survivalTimeElement.innerText = survivalTime;
}

function gameLoop() {
    moveAsteroids();
}

// --- NEW VFX: לוגיקת הפיצוץ ---

function createExplosion(targetElement) {
    const targetRect = targetElement.getBoundingClientRect();
    const viewportRect = spaceViewport.getBoundingClientRect();
    
    const x = targetRect.left + targetRect.width / 2 - viewportRect.left;
    const y = targetRect.top + targetRect.height / 2 - viewportRect.top;

    // יצירת חלקיקים
    for (let i = 0; i < 15; i++) {
        const particle = document.createElement('div');
        particle.classList.add('explosion-particle');
        particle.style.left = x + 'px';
        particle.style.top = y + 'px';
        
        // כיוון פיזור
        const angle = Math.random() * Math.PI * 2;
        const force = Math.random() * 60 + 15;
        const dx = Math.cos(angle) * force;
        const dy = Math.sin(angle) * force;
        particle.style.setProperty('--dx', dx + 'px');
        particle.style.setProperty('--dy', dy + 'px');
        
        // צבעי פיצוץ
        const colors = ['#ff3300', '#ff9900', '#ffee00'];
        particle.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];

        spaceViewport.appendChild(particle);
        
        // מחיקה
        setTimeout(() => particle.remove(), 1000);
    }
}

// --- לוגיקת לוח הבקרה (מותאם להגדרות) ---

// כפתור "הגדרות"
function toggleSettings() {
    modal.classList.add('show');
}

function closeSettings() {
    modal.classList.remove('show');
}

// סגירת Modal בלחיצה מחוץ לחלון
window.onclick = function(event) {
    if (event.target == modal) {
        modal.classList.remove('show');
    }
}

// כפתור "שמור התקדמות" (עובד כרגיל)
function saveHighScore() {
    const currentHighScore = localStorage.getItem('spaceExplorerHighScore');
    
    if (!currentHighScore || survivalTime > parseInt(currentHighScore)) {
        localStorage.setItem('spaceExplorerHighScore', survivalTime);
        alert('שיא חדש נשמר: ' + survivalTime + ' שניות!');
    } else {
        alert('השיא הקודם שלך הוא ' + currentHighScore + ' שניות. נסה שוב!');
    }
}

// NEW FUNCTION: כפתור לפרסומת לחיים נוספים (הכנה)
function rewardAdForLife() {
    alert('צפית בפרסומת! קבל חיים נוספים וחזור להתחלה (בגרסה הבאה נוסיף את הפרסומת האמיתית).');
    closeSettings();
    startGame();
}

// הפעלת המשחק בפעם הראשונה
window.onload = function() {
    const highScore = localStorage.getItem('spaceExplorerHighScore');
    if (highScore) {
        document.querySelector('.radar-scan span').innerText = "שיא קודם: " + highScore + " שניות.";
    }
    startGame();
};