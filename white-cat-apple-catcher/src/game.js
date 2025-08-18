document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');

  const scoreEl = document.getElementById('score');
  const timerEl = document.getElementById('timer');
  const attemptsEl = document.getElementById('attempts');
  const buffsEl = document.getElementById('buffs');
  const resultEl = document.getElementById('result');
  const continueBtn = document.getElementById('continue-btn');

  const CANVAS_W = canvas.width;
  const CANVAS_H = canvas.height;

  const CAT_W = 84, CAT_H = 84;
  const APPLE_W = 36, APPLE_H = 36;

  const RED_APPLES = 20, GREEN_APPLES = 12, YELLOW_APPLES = 7;
  const GAME_TIME = 30;
  const MAX_ATTEMPTS = 3;
  const ROUND_TARGETS = [100, 200, 300];
  const GRAVITY = 1500;
  const JUMP_SPEED = 500;

  let images = {};
  let cat, apples, applePool, score, timeLeft, attempts, gameActive;
  let activeBuffs = [];
  let appleSpawnCooldown = 2;

  async function loadImage(src) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => {
        const fallback = new Image();
        fallback.src = 'assets/fallback.svg';
        resolve(fallback);
      };
      img.src = src;
    });
  }

  async function loadAssets() {
    const [catImg, redAppleImg, greenAppleImg, yellowAppleImg, treeImg] = await Promise.all([
      loadImage('assets/cat.svg'),
      loadImage('assets/apple.svg'),
      loadImage('assets/green-apple.svg'),
      loadImage('assets/yellow-apple.svg'),
      loadImage('assets/tree.svg')
    ]);
    images = { cat: catImg, redApple: redAppleImg, greenApple: greenAppleImg, yellowApple: yellowAppleImg, tree: treeImg };
  }

  function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  function getCurrentRoundTarget() {
    const idx = Math.max(0, Math.min(ROUND_TARGETS.length - 1, attempts - 1));
    return ROUND_TARGETS[idx] ?? 100;
  }

  function resetGame() {
    cat = { x: CANVAS_W / 2 - CAT_W / 2, y: CANVAS_H - CAT_H - 24, w: CAT_W, h: CAT_H, baseSpeed: 1000, speed: 1000, vy: 0, jumping: false };
    apples = [];
    score = 0;
    timeLeft = GAME_TIME;
    gameActive = true;

    applePool = [];
    for (let i = 0; i < RED_APPLES; i++) applePool.push('red');
    for (let i = 0; i < GREEN_APPLES; i++) applePool.push('green');
    for (let i = 0; i < YELLOW_APPLES; i++) applePool.push('yellow');
    shuffle(applePool);

    activeBuffs = [];
    appleSpawnCooldown = 2;

    resultEl.textContent = '';
    continueBtn.style.display = 'none';
    buffsEl.textContent = '🎁 Баффы:';
  }

  function spawnApple(type) {
    if (!type) return;
    const x = 10 + Math.random() * (CANVAS_W - 20 - APPLE_W);
    apples.push({ x, y: -APPLE_H, w: APPLE_W, h: APPLE_H, vy: 0, type });
  }

  function updateUI() {
    scoreEl.textContent = `🍏 Счёт: ${score}`;
    timerEl.textContent = `🕒 Время: ${Math.ceil(Math.max(0, timeLeft))}`;
    attemptsEl.textContent = `🎮 Раунд: ${attempts}/${MAX_ATTEMPTS}`;

    const parts = activeBuffs.map(b => {
      if (b.type === 'green') return `👟 (${Math.ceil(b.time)}с)`;
      if (b.type === 'yellow') return `⏳ (${Math.ceil(b.time)}с)`;
    }).filter(Boolean);
    buffsEl.textContent = `🎁 Баффы: ${parts.join(' ')}`;
  }

  function draw() {
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    if (images.tree) ctx.drawImage(images.tree, 0, 0, CANVAS_W, CANVAS_H);
    if (images.cat) ctx.drawImage(images.cat, cat.x, cat.y, cat.w, cat.h);
    for (let a of apples) {
      const img = a.type === 'red' ? images.redApple : a.type === 'green' ? images.greenApple : images.yellowApple;
      if (img) ctx.drawImage(img, a.x, a.y, a.w, a.h);
    }
  }

  function applyBuff(type) {
    const existing = activeBuffs.find(b => b.type === type);
    if (existing) existing.time += 5;
    else activeBuffs.push({ type, time: 5 });
  }

  function update(dt) {
    if (!gameActive) return;

    // Обработка баффов
    let timeMultiplier = 1;
    activeBuffs.forEach(b => {
      b.time -= dt;
      if (b.type === 'green') cat.speed = cat.baseSpeed * 2;
      if (b.type === 'yellow') timeMultiplier = 0;
    });
    activeBuffs = activeBuffs.filter(b => b.time > 0);
    if (!activeBuffs.some(b => b.type === 'green')) cat.speed = cat.baseSpeed;

    appleSpawnCooldown -= dt;
    if (appleSpawnCooldown <= 0 && applePool.length > 0) {
      spawnApple(applePool.pop());
      appleSpawnCooldown = 0.7 + Math.random();
    }

    for (let a of apples) {
      a.vy += GRAVITY * dt;
      a.y += a.vy * dt;

      if (a.y + a.h >= cat.y && a.y + a.h <= cat.y + cat.h + 12 && a.x + a.w >= cat.x && a.x <= cat.x + cat.w) {
        if (a.type === 'red') score += 10;
        if (a.type === 'green') { score += 15; applyBuff('green'); }
        if (a.type === 'yellow') { score += 20; applyBuff('yellow'); }
        a.caught = true;
      } else if (a.y > CANVAS_H) {
        if (a.type === 'red') score -= 5;
        a.caught = true;
      }
    }
    apples = apples.filter(a => !a.caught);

    // Прыжок и гравитация
    cat.vy += GRAVITY * dt;
    cat.y += cat.vy * dt;
    if (cat.y > CANVAS_H - CAT_H - 24) { cat.y = CANVAS_H - CAT_H - 24; cat.vy = 0; cat.jumping = false; }

    timeLeft -= dt * timeMultiplier;
    if (timeLeft <= 0) endRound();

    updateUI();
  }

  function endRound() {
    gameActive = false;
    const target = getCurrentRoundTarget();
    resultEl.textContent = score >= target ? 'Котик накормлен! 😸' : ' Не хватило яблоков 😿';
    continueBtn.style.display = attempts < MAX_ATTEMPTS ? 'block' : 'none';
  }

  function gameLoop(timestamp) {
    if (!gameLoop.last) gameLoop.last = timestamp;
    const dt = (timestamp - gameLoop.last) / 1000;
    gameLoop.last = timestamp;
    update(dt);
    draw();
    requestAnimationFrame(gameLoop);
  }

  function moveCat(dir, dt) {
    const targetX = cat.x + dir * cat.speed * dt;
    cat.x += (targetX - cat.x) * 0.2; // плавное движение
    if (cat.x < 0) cat.x = 0;
    if (cat.x + cat.w > CANVAS_W) cat.x = CANVAS_W - cat.w;
  }

  function jumpCat() {
    if (!cat.jumping) { cat.vy = -JUMP_SPEED; cat.jumping = true; }
  }

  let left = false, right = false;
  document.addEventListener('keydown', e => { 
    if (e.key === 'ArrowLeft') left = true;
    if (e.key === 'ArrowRight') right = true;
    if (e.key === 'ArrowUp' || e.key === ' ') jumpCat();
  });
  document.addEventListener('keyup', e => { 
    if (e.key === 'ArrowLeft') left = false;
    if (e.key === 'ArrowRight') right = false;
  });

  function handleInput(dt) {
    if (left) moveCat(-1, dt);
    if (right) moveCat(1, dt);
  }

  let lastTime = performance.now();
  function frame() {
    const now = performance.now();
    const dt = (now - lastTime) / 1000;
    lastTime = now;
    handleInput(dt);
    requestAnimationFrame(frame);
  }

  continueBtn.addEventListener('click', () => {
    attempts++;
    resetGame();
  });

  async function start() {
    await loadAssets();
    attempts = 1;
    resetGame();
    requestAnimationFrame(gameLoop);
    frame();
  }

  start();
});
