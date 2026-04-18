(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const GROUND = H - 80;
  const overlay = document.getElementById('overlay');
  const startBtn = document.getElementById('startBtn');
  const banner = document.getElementById('banner');
  const p1hpEl = document.getElementById('p1hp');
  const p2hpEl = document.getElementById('p2hp');
  const p1winsEl = document.getElementById('p1wins');
  const p2winsEl = document.getElementById('p2wins');
  const timerEl = document.getElementById('timer');
  let difficulty = 1.0;
  document.querySelectorAll('.diff-btn').forEach(b => {
    b.onclick = () => {
      document.querySelectorAll('.diff-btn').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      difficulty = parseFloat(b.dataset.d);
    };
  });
  const keys = {};
  window.addEventListener('keydown', e => {
    keys[e.key.toLowerCase()] = true;
    if (['a','d','w','s','j','k','l'].includes(e.key.toLowerCase())) e.preventDefault();
  });
  window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
  document.querySelectorAll('#mctrl button[data-k]').forEach(btn => {
    const k = btn.dataset.k;
    const down = e => { e.preventDefault(); keys[k] = true; };
    const up = e => { e.preventDefault(); keys[k] = false; };
    btn.addEventListener('touchstart', down, { passive: false });
    btn.addEventListener('touchend', up);
    btn.addEventListener('touchcancel', up);
    btn.addEventListener('mousedown', down);
    btn.addEventListener('mouseup', up);
    btn.addEventListener('mouseleave', up);
  });
  function makeFighter(opts) {
    return { name: opts.name, x: opts.x, y: GROUND, vx: 0, vy: 0, w: 70, h: 130, facing: opts.facing, hp: 100, maxHp: 100, energy: 0, state: 'idle', attackTimer: 0, attackType: null, hitCooldown: 0, hitstun: 0, blocking: false, color: opts.color, accent: opts.accent, isCpu: !!opts.isCpu, lastAttack: 0, comboStep: 0, comboTimer: 0 };
  }
  let p1, p2;
  let round = 1, p1Wins = 0, p2Wins = 0;
  let roundTime = 99;
  let lastTime = 0;
  let roundActive = false;
  let effects = [];
  let particles = [];
  let shakeTime = 0;
  let freezeFrames = 0;
  function resetFighters() {
    p1 = makeFighter({ name: 'KAI', x: W * 0.3, facing: 1, color: '#36D6B5', accent: '#7cf0d9', isCpu: false });
    p2 = makeFighter({ name: 'VEX', x: W * 0.7, facing: -1, color: '#ff2d9c', accent: '#ff7ac2', isCpu: true });
  }
  function startMatch() { p1Wins = 0; p2Wins = 0; round = 1; updateWinDots(); startRound(); }
  function startRound() {
    resetFighters();
    roundTime = 99;
    roundActive = false;
    effects = []; particles = [];
    showBanner('ROUND ' + round);
    setTimeout(() => { showBanner('FIGHT!'); roundActive = true; }, 1500);
  }
  function showBanner(text) {
    banner.textContent = text;
    banner.classList.remove('show');
    void banner.offsetWidth;
    banner.classList.add('show');
  }
  function updateWinDots() {
    const render = n => ('● '.repeat(n) + '○ '.repeat(2 - n)).trim();
    p1winsEl.textContent = render(p1Wins);
    p2winsEl.textContent = render(p2Wins);
  }
  function processInput(dt) {
    if (!roundActive) return;
    if (p1.state !== 'ko' && p1.hitstun <= 0) {
      const onGround = p1.y >= GROUND;
      p1.blocking = !!keys['s'] && onGround && p1.state !== 'attack';
      if (!p1.blocking && p1.state !== 'attack') {
        if (keys['a']) { p1.vx = -280; p1.state = onGround ? 'walk' : 'jump'; }
        else if (keys['d']) { p1.vx = 280; p1.state = onGround ? 'walk' : 'jump'; }
        else { p1.vx = 0; if (onGround) p1.state = 'idle'; }
        if (keys['w'] && onGround) { p1.vy = -720; p1.state = 'jump'; }
      } else if (p1.blocking) { p1.vx = 0; p1.state = 'block'; }
      if (p1.state !== 'attack') p1.facing = p2.x > p1.x ? 1 : -1;
      if (p1.state !== 'attack' && p1.attackTimer <= 0 && !p1.blocking) {
        if (keys['j']) startAttack(p1, 'punch');
        else if (keys['k']) startAttack(p1, 'kick');
        else if (keys['l'] && p1.energy >= 100) startAttack(p1, 'special');
      }
    }
    if (p2.state !== 'ko' && p2.hitstun <= 0 && p2.isCpu) runCpuAI(p2, p1, dt);
  }
  function runCpuAI(cpu, foe, dt) {
    cpu.lastAttack -= dt;
    const onGround = cpu.y >= GROUND;
    const dist = Math.abs(cpu.x - foe.x);
    const foeAttacking = foe.state === 'attack' && foe.attackTimer > 0;
    cpu.facing = foe.x > cpu.x ? 1 : -1;
    if (cpu.state === 'attack') return;
    if (foeAttacking && dist < 140 && Math.random() < 0.6 * difficulty) {
      cpu.blocking = true; cpu.vx = 0; cpu.state = 'block'; return;
    } else cpu.blocking = false;
    const idealDist = 110;
    if (dist > idealDist + 20) { cpu.vx = cpu.facing * (200 + 80 * difficulty); cpu.state = onGround ? 'walk' : 'jump'; }
    else if (dist < idealDist - 30) { cpu.vx = -cpu.facing * 180; cpu.state = onGround ? 'walk' : 'jump'; }
    else { cpu.vx = 0; cpu.state = onGround ? 'idle' : 'jump'; }
    if (onGround && Math.random() < 0.008 * difficulty && dist < 250) { cpu.vy = -720; cpu.state = 'jump'; }
    if (dist < 130 && cpu.lastAttack <= 0 && onGround) {
      const roll = Math.random();
      if (cpu.energy >= 100 && roll < 0.15 * difficulty) startAttack(cpu, 'special');
      else if (roll < 0.4 * difficulty) startAttack(cpu, Math.random() < 0.5 ? 'punch' : 'kick');
      cpu.lastAttack = 0.4 + Math.random() * (0.8 / difficulty);
    }
  }
  function startAttack(f, type) {
    f.state = 'attack'; f.attackType = type; f.vx = 0;
    f.comboStep = (f.comboStep + 1) % 3;
    if (type === 'punch') f.attackTimer = 0.32;
    else if (type === 'kick') f.attackTimer = 0.44;
    else if (type === 'special') { f.attackTimer = 0.7; f.energy = 0; }
  }
  function stepPhysics(dt) {
    [p1, p2].forEach(f => {
      if (f.y < GROUND) f.vy += 1800 * dt;
      f.x += f.vx * dt; f.y += f.vy * dt;
      if (f.y > GROUND) { f.y = GROUND; f.vy = 0; if (f.state === 'jump') f.state = 'idle'; }
      f.x = Math.max(60, Math.min(W - 60, f.x));
      if (f.hitCooldown > 0) f.hitCooldown -= dt;
      if (f.hitstun > 0) { f.hitstun -= dt; f.state = 'hit'; }
      if (f.attackTimer > 0) { f.attackTimer -= dt; if (f.attackTimer <= 0) { f.state = 'idle'; f.attackType = null; } }
    });
  }
  function checkHits() {
    [[p1, p2], [p2, p1]].forEach(([a, b]) => {
      if (a.state !== 'attack' || !a.attackType) return;
      const total = a.attackType === 'punch' ? 0.32 : a.attackType === 'kick' ? 0.44 : 0.7;
      const progress = 1 - (a.attackTimer / total);
      if (progress < 0.25 || progress > 0.7) return;
      if (a.hitCooldown > 0) return;
      const reach = a.attackType === 'punch' ? 75 : a.attackType === 'kick' ? 95 : 140;
      const hitX = a.x + a.facing * (a.w/2 + reach/2);
      const hitY = a.y - a.h/2;
      const hitW = reach;
      const hitH = a.attackType === 'kick' ? 60 : a.attackType === 'special' ? 100 : 50;
      const bx = b.x, by = b.y - b.h/2;
      if (Math.abs(hitX - bx) < (hitW + b.w)/2 && Math.abs(hitY - by) < (hitH + b.h)/2) {
        const blocked = b.blocking && Math.sign(b.x - a.x) === b.facing;
        let dmg = a.attackType === 'punch' ? 7 : a.attackType === 'kick' ? 11 : 22;
        if (a.y < GROUND - 20 && a.attackType === 'kick') dmg += 4;
        if (blocked) dmg = Math.floor(dmg * 0.2);
        b.hp = Math.max(0, b.hp - dmg);
        a.hitCooldown = 0.35;
        b.hitstun = blocked ? 0.12 : (a.attackType === 'special' ? 0.5 : 0.25);
        const knockback = (blocked ? 60 : (a.attackType === 'special' ? 380 : 180));
        b.vx = a.facing * knockback;
        if (a.attackType === 'special' && !blocked) b.vy = -400;
        if (!blocked) a.energy = Math.min(100, a.energy + (a.attackType === 'special' ? 0 : 15));
        b.energy = Math.min(100, b.energy + 5);
        spawnHitEffect(hitX, hitY, blocked, a.attackType);
        shakeTime = a.attackType === 'special' ? 0.35 : 0.1;
        freezeFrames = a.attackType === 'special' ? 6 : 2;
      }
    });
  }
  function spawnHitEffect(x, y, blocked, type) {
    effects.push({ x, y, t: 0, life: 0.25, blocked, type });
    const count = type === 'special' ? 18 : 8;
    const color = blocked ? '#ffe34e' : (type === 'special' ? '#ff2d9c' : '#fff');
    for (let i = 0; i < count; i++) {
      particles.push({ x, y, vx: (Math.random() - 0.5) * 500, vy: (Math.random() - 0.5) * 500, life: 0.4 + Math.random() * 0.3, t: 0, color, size: 2 + Math.random() * 3 });
    }
  }
  function stepEffects(dt) {
    effects = effects.filter(e => { e.t += dt; return e.t < e.life; });
    particles = particles.filter(p => { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 800 * dt; return p.t < p.life; });
    if (shakeTime > 0) shakeTime -= dt;
  }
  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#2a0a4a'); g.addColorStop(0.5, '#5a1555'); g.addColorStop(1, '#1a0530');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const sunG = ctx.createRadialGradient(W/2, H*0.35, 20, W/2, H*0.35, 180);
    sunG.addColorStop(0, 'rgba(255, 227, 78, 0.9)');
    sunG.addColorStop(0.5, 'rgba(255, 45, 156, 0.5)');
    sunG.addColorStop(1, 'rgba(255, 45, 156, 0)');
    ctx.fillStyle = sunG; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#ffe34e';
    for (let i = 0; i < 6; i++) {
      const y = H * 0.28 + i * 12;
      ctx.globalAlpha = 0.7 - i * 0.1;
      ctx.fillRect(W/2 - 80 - i*5, y, 160 + i*10, 4);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#1a0530';
    ctx.beginPath();
    ctx.moveTo(0, H*0.7); ctx.lineTo(W*0.15, H*0.45); ctx.lineTo(W*0.3, H*0.6);
    ctx.lineTo(W*0.5, H*0.4); ctx.lineTo(W*0.7, H*0.55); ctx.lineTo(W*0.85, H*0.42);
    ctx.lineTo(W, H*0.65); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(54,214,181,0.6)'; ctx.lineWidth = 1.5;
    const vanishY = H * 0.7;
    for (let i = -20; i < 20; i++) {
      ctx.beginPath(); ctx.moveTo(W/2 + i * (W/4), vanishY); ctx.lineTo(W/2 + i * 200, H); ctx.stroke();
    }
    for (let i = 0; i < 10; i++) {
      const y = vanishY + Math.pow(i/10, 2) * (H - vanishY);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(0, GROUND + 10, W, H - GROUND);
  }
  function drawFighter(f) {
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.scale(f.facing, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath(); ctx.ellipse(0, 2, 40, 8, 0, 0, Math.PI*2); ctx.fill();
    const pose = f.state; const type = f.attackType;
    const body = f.color; const trim = f.accent;
    const flashing = f.hitstun > 0 && Math.floor(f.hitstun * 20) % 2 === 0;
    const bodyColor = flashing ? '#fff' : body;
    ctx.fillStyle = bodyColor;
    if (pose === 'walk') {
      const legSwing = Math.sin(performance.now() / 80) * 8;
      drawLeg(-12, -15, -12 + legSwing, 0);
      drawLeg(12, -15, 12 - legSwing, 0);
    } else if (pose === 'jump') {
      drawLeg(-10, -15, -20, -20); drawLeg(12, -15, 22, -20);
    } else if (pose === 'attack' && type === 'kick') {
      drawLeg(-8, -20, -8, 0);
      ctx.save();
      ctx.fillStyle = bodyColor;
      ctx.beginPath();
      ctx.moveTo(4, -40); ctx.lineTo(60, -60); ctx.lineTo(70, -50); ctx.lineTo(14, -30);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = trim; ctx.fillRect(60, -62, 20, 10);
      ctx.restore();
    } else if (pose === 'block') {
      drawLeg(-15, -15, -15, 0); drawLeg(10, -15, 15, 0);
    } else if (pose === 'hit') {
      drawLeg(-15, -15, -22, 0); drawLeg(15, -15, 22, 0);
    } else {
      drawLeg(-10, -15, -10, 0); drawLeg(10, -15, 10, 0);
    }
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.moveTo(-22, -80); ctx.lineTo(22, -80); ctx.lineTo(18, -20); ctx.lineTo(-18, -20);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = trim; ctx.fillRect(-20, -30, 40, 5);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(-18, -78, 36, 3);
    ctx.fillStyle = bodyColor;
    if (pose === 'attack' && type === 'punch') {
      ctx.beginPath();
      ctx.moveTo(10, -75); ctx.lineTo(80, -68); ctx.lineTo(80, -58); ctx.lineTo(10, -62);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = trim;
      ctx.beginPath(); ctx.arc(85, -63, 10, 0, Math.PI*2); ctx.fill();
      drawArm(-18, -75, -22, -40);
    } else if (pose === 'attack' && type === 'special') {
      ctx.beginPath();
      ctx.moveTo(5, -75); ctx.lineTo(60, -80); ctx.lineTo(60, -65); ctx.lineTo(5, -60);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-5, -75); ctx.lineTo(55, -75); ctx.lineTo(55, -60); ctx.lineTo(-5, -60);
      ctx.closePath(); ctx.fill();
      const grad = ctx.createRadialGradient(90, -70, 2, 90, -70, 40);
      grad.addColorStop(0, '#fff'); grad.addColorStop(0.4, trim); grad.addColorStop(1, 'rgba(255,45,156,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(90 + Math.sin(performance.now()/50)*3, -70, 35, 0, Math.PI*2);
      ctx.fill();
    } else if (pose === 'block') {
      ctx.beginPath();
      ctx.moveTo(-18, -75); ctx.lineTo(18, -85); ctx.lineTo(22, -75); ctx.lineTo(-14, -65);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-18, -65); ctx.lineTo(18, -70); ctx.lineTo(22, -60); ctx.lineTo(-14, -55);
      ctx.closePath(); ctx.fill();
    } else if (pose === 'hit') {
      drawArm(-18, -75, -30, -40); drawArm(18, -75, 30, -40);
    } else {
      drawArm(-18, -75, -20, -40); drawArm(18, -75, 25, -45);
    }
    ctx.fillStyle = '#f4c89c';
    ctx.beginPath(); ctx.arc(0, -95, 18, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = trim;
    ctx.beginPath();
    ctx.moveTo(-18, -95); ctx.lineTo(-20, -110); ctx.lineTo(0, -118);
    ctx.lineTo(20, -108); ctx.lineTo(18, -95);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#000';
    ctx.fillRect(-14, -98, 20, 4);
    ctx.fillStyle = body;
    ctx.fillRect(-10, -97, 4, 2);
    ctx.fillRect(0, -97, 4, 2);
    ctx.restore();
    ctx.save();
    ctx.translate(f.x, f.y + 30);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(-30, 0, 60, 5);
    ctx.fillStyle = f.color;
    ctx.fillRect(-30, 0, 60 * (f.energy/100), 5);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1;
    ctx.strokeRect(-30, 0, 60, 5);
    ctx.restore();
  }
  function drawLeg(hx, hy, fx, fy) {
    ctx.beginPath();
    ctx.moveTo(hx - 6, hy); ctx.lineTo(hx + 6, hy); ctx.lineTo(fx + 6, fy); ctx.lineTo(fx - 6, fy);
    ctx.closePath(); ctx.fill();
    ctx.save();
    const prev = ctx.fillStyle;
    ctx.fillStyle = '#222';
    ctx.fillRect(fx - 10, fy - 4, 20, 6);
    ctx.fillStyle = prev;
    ctx.restore();
  }
  function drawArm(sx, sy, hx, hy) {
    ctx.beginPath();
    ctx.moveTo(sx - 5, sy); ctx.lineTo(sx + 5, sy); ctx.lineTo(hx + 5, hy); ctx.lineTo(hx - 5, hy);
    ctx.closePath(); ctx.fill();
  }
  function drawEffects() {
    effects.forEach(e => {
      const p = e.t / e.life;
      const size = (e.type === 'special' ? 80 : 40) * (0.5 + p * 1.2);
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(p * Math.PI);
      ctx.globalAlpha = 1 - p;
      ctx.fillStyle = e.blocked ? '#ffe34e' : (e.type === 'special' ? '#ff2d9c' : '#fff');
      ctx.beginPath();
      const spikes = 8;
      for (let i = 0; i < spikes * 2; i++) {
        const r = i % 2 === 0 ? size : size * 0.45;
        const a = (i / (spikes*2)) * Math.PI * 2;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath(); ctx.fill();
      if (!e.blocked) {
        ctx.fillStyle = '#ffe34e';
        ctx.globalAlpha = (1 - p) * 0.8;
        ctx.beginPath();
        for (let i = 0; i < spikes * 2; i++) {
          const r = i % 2 === 0 ? size * 0.6 : size * 0.25;
          const a = (i / (spikes*2)) * Math.PI * 2;
          ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    });
    particles.forEach(pt => {
      const p = pt.t / pt.life;
      ctx.fillStyle = pt.color;
      ctx.globalAlpha = 1 - p;
      ctx.fillRect(pt.x - pt.size/2, pt.y - pt.size/2, pt.size, pt.size);
      ctx.globalAlpha = 1;
    });
  }
  function render() {
    ctx.save();
    if (shakeTime > 0) ctx.translate((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12);
    drawBackground();
    const order = p1.y > p2.y ? [p2, p1] : [p1, p2];
    order.forEach(drawFighter);
    drawEffects();
    const vg = ctx.createRadialGradient(W/2, H/2, W*0.3, W/2, H/2, W*0.7);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 0.08; ctx.fillStyle = '#000';
    for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
    ctx.globalAlpha = 1;
    ctx.restore();
  }
  function checkRoundEnd() {
    if (!roundActive) return;
    let winner = null;
    if (p1.hp <= 0 && p2.hp <= 0) winner = 'draw';
    else if (p1.hp <= 0) winner = 'p2';
    else if (p2.hp <= 0) winner = 'p1';
    else if (roundTime <= 0) {
      if (p1.hp > p2.hp) winner = 'p1';
      else if (p2.hp > p1.hp) winner = 'p2';
      else winner = 'draw';
    }
    if (winner) {
      roundActive = false;
      if (winner === 'p1') p1Wins++;
      else if (winner === 'p2') p2Wins++;
      updateWinDots();
      const bannerText = winner === 'p1' ? 'K.O.! KAI WINS' : winner === 'p2' ? 'DEFEATED!' : 'DRAW!';
      showBanner(bannerText);
      setTimeout(() => {
        if (p1Wins === 2 || p2Wins === 2 || round >= 3) {
          const final = p1Wins > p2Wins ? 'YOU WIN THE MATCH' : p2Wins > p1Wins ? 'YOU LOSE' : 'DRAW MATCH';
          overlay.querySelector('h2').textContent = final;
          overlay.querySelector('h2').className = 'big';
          overlay.querySelector('p').textContent = 'Final score  ' + p1Wins + ' - ' + p2Wins;
          startBtn.textContent = 'REMATCH';
          overlay.classList.remove('hidden');
        } else { round++; startRound(); }
      }, 2500);
    }
  }
  let timerAccum = 0;
  function loop(t) {
    const dt = Math.min(0.05, (t - lastTime) / 1000 || 0);
    lastTime = t;
    if (freezeFrames > 0) { freezeFrames--; render(); requestAnimationFrame(loop); return; }
    processInput(dt);
    stepPhysics(dt);
    checkHits();
    stepEffects(dt);
    if (roundActive) {
      timerAccum += dt;
      if (timerAccum >= 1) {
        timerAccum = 0;
        roundTime--;
        timerEl.textContent = String(roundTime).padStart(2, '0');
        timerEl.classList.toggle('low', roundTime <= 10);
      }
    }
    p1hpEl.style.width = (p1.hp / p1.maxHp * 100) + '%';
    p2hpEl.style.width = (p2.hp / p2.maxHp * 100) + '%';
    checkRoundEnd();
    render();
    requestAnimationFrame(loop);
  }
  startBtn.onclick = () => { overlay.classList.add('hidden'); startMatch(); };
  resetFighters();
  render();
  requestAnimationFrame(loop);
})();