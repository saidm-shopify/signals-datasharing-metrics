// ─── Data Shield Mini-Game ───
// Plays during loading. Block red beams (bad data), let green (good data) pass.

(function () {
  const canvas = document.getElementById('gameCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  // roundRect polyfill for older browsers
  if (!ctx.roundRect) {
    ctx.roundRect = function (x, y, w, h, r) {
      r = Math.min(r, w / 2, h / 2);
      this.moveTo(x + r, y);
      this.arcTo(x + w, y, x + w, y + h, r);
      this.arcTo(x + w, y + h, x, y + h, r);
      this.arcTo(x, y + h, x, y, r);
      this.arcTo(x, y, x + w, y, r);
      this.closePath();
    };
  }

  let running = false;
  let animId = null;
  let score = 0;
  let beams = [];
  let particles = [];
  let floatingTexts = [];
  let shieldY = H / 2;
  const shieldH = 60;
  const shieldW = 8;
  const shieldX = W * 0.72;
  const keys = {};
  const margin = 20;

  // Castle (store) on the left
  const castle = { x: 10, y: H / 2 - 40, w: 50, h: 80 };

  // Partner logos in the right zone
  const partnerLogos = [
    { name: 'TikTok', src: 'https://cdn.brandfetch.io/tiktok.com/w/128/h/128/icon' },
    { name: 'Snapchat', src: 'https://cdn.brandfetch.io/snapchat.com/w/128/h/128/icon' },
    { name: 'X', src: 'https://cdn.brandfetch.io/x.com/w/128/h/128/icon' },
    { name: 'Pinterest', src: 'https://cdn.brandfetch.io/pinterest.com/w/128/h/128/icon' },
    { name: 'Bing', src: 'https://cdn.brandfetch.io/bing.com/w/128/h/128/icon' },
  ];
  const logoImages = [];
  let badgePositions = [];

  // Preload logo images
  partnerLogos.forEach(p => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = p.src;
    logoImages.push({ img, name: p.name });
  });

  // Partner badges in the right zone
  const partnerBadges = [
    { label: 'TT', color: '#ef4444' },   // TikTok
    { label: 'Sn', color: '#f97316' },   // Snapchat
    { label: 'X', color: '#8888a0' },    // X (Twitter)
    { label: 'Pi', color: '#ef4444' },   // Pinterest
    { label: 'Bi', color: '#3b82f6' },   // Microsoft Bing
  ];
  // Pre-compute random positions (regenerated on startGame)
  let badgePositions = [];

  function spawnBeam() {
    beams.push({
      x: castle.x + castle.w + 10,
      y: margin + Math.random() * (H - margin * 2),
      speed: 1.5 + Math.random() * 2.5,
      w: 28 + Math.random() * 20,
      h: 4,
    });
  }

  function spawnParticles(x, y, color) {
    for (let i = 0; i < 6; i++) {
      particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.5) * 4,
        life: 1,
        color,
        r: 2 + Math.random() * 2,
      });
    }
  }

  function spawnFloatingText(x, y, text, color) {
    floatingTexts.push({ x, y, text, color, life: 1 });
  }

  function update() {
    // Shield movement
    const moveSpeed = 4.5;
    if (keys['ArrowUp'] || keys['w'] || keys['W']) shieldY -= moveSpeed;
    if (keys['ArrowDown'] || keys['s'] || keys['S']) shieldY += moveSpeed;
    shieldY = Math.max(shieldH / 2, Math.min(H - shieldH / 2, shieldY));

    // Spawn beams (~3.8 per second at 60fps)
    if (Math.random() < 0.063) spawnBeam();

    // Update beams
    for (let i = beams.length - 1; i >= 0; i--) {
      const b = beams[i];
      b.x += b.speed;

      // Check shield collision
      const shieldTop = shieldY - shieldH / 2;
      const shieldBot = shieldY + shieldH / 2;
      if (b.x + b.w >= shieldX && b.x <= shieldX + shieldW &&
          b.y + b.h >= shieldTop && b.y <= shieldBot) {
        score++;
        spawnParticles(shieldX, b.y, '#ef4444');
        spawnFloatingText(shieldX + 16, b.y, '+1', '#22c55e');
        beams.splice(i, 1);
        continue;
      }

      // Off screen — leaked through
      if (b.x > W + 10) {
        score = Math.max(0, score - 1);
        spawnFloatingText(W - 40, b.y, '-1', '#ef4444');
        beams.splice(i, 1);
      }
    }

    // Update particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.03;
      if (p.life <= 0) particles.splice(i, 1);
    }

    // Update floating texts
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
      const t = floatingTexts[i];
      t.y -= 1;
      t.life -= 0.025;
      if (t.life <= 0) floatingTexts.splice(i, 1);
    }

    document.getElementById('gameScore').textContent = `Score: ${score}`;
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    // Background grid
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.05)';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 30) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += 30) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // Castle (Shopify store)
    ctx.fillStyle = '#1c1c28';
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(castle.x, castle.y, castle.w, castle.h, 6);
    ctx.fill();
    ctx.stroke();
    // Store label
    ctx.fillStyle = '#6366f1';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Shop', castle.x + castle.w / 2, castle.y + castle.h / 2 + 4);

    // Partner zone (right edge)
    const pzoneW = 50;
    const pzoneX = W - pzoneW;
    ctx.fillStyle = 'rgba(99, 102, 241, 0.06)';
    ctx.fillRect(pzoneX, 0, pzoneW, H);
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pzoneX, 0);
    ctx.lineTo(pzoneX, H);
    ctx.stroke();
    // Partner logos
    const logoSize = 20;
    logoImages.forEach((l, i) => {
      const pos = badgePositions[i];
      if (!pos) return;
      ctx.globalAlpha = 0.6;
      if (l.img.complete && l.img.naturalWidth > 0) {
        ctx.drawImage(l.img, pos.x, pos.y, logoSize, logoSize);
      } else {
        // Fallback: first letter circle
        ctx.fillStyle = 'rgba(99, 102, 241, 0.3)';
        ctx.beginPath();
        ctx.arc(pos.x + logoSize / 2, pos.y + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(l.name[0], pos.x + logoSize / 2, pos.y + logoSize / 2 + 4);
      }
      ctx.globalAlpha = 1;
    });

    // Beams (all red)
    beams.forEach(b => {
      ctx.shadowColor = 'rgba(239,68,68,0.3)';
      ctx.shadowBlur = 8;
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.roundRect(b.x, b.y, b.w, b.h, 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    // Shield
    const shieldTop = shieldY - shieldH / 2;
    const grad = ctx.createLinearGradient(shieldX, shieldTop, shieldX, shieldTop + shieldH);
    grad.addColorStop(0, 'rgba(99, 102, 241, 0.2)');
    grad.addColorStop(0.5, 'rgba(99, 102, 241, 0.9)');
    grad.addColorStop(1, 'rgba(99, 102, 241, 0.2)');
    ctx.fillStyle = grad;
    ctx.shadowColor = 'rgba(99, 102, 241, 0.5)';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.roundRect(shieldX, shieldTop, shieldW, shieldH, 4);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Shield edge glow
    ctx.strokeStyle = '#818cf8';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(shieldX, shieldTop, shieldW, shieldH, 4);
    ctx.stroke();

    // Particles
    particles.forEach(p => {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Floating score texts
    floatingTexts.forEach(t => {
      ctx.globalAlpha = t.life;
      ctx.fillStyle = t.color;
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(t.text, t.x, t.y);
    });
    ctx.globalAlpha = 1;
  }

  function loop() {
    if (!running) return;
    update();
    draw();
    animId = requestAnimationFrame(loop);
  }

  // Keyboard — only preventDefault when game is running
  document.addEventListener('keydown', e => {
    keys[e.key] = true;
    if (running && ['ArrowUp', 'ArrowDown'].includes(e.key)) e.preventDefault();
  });
  document.addEventListener('keyup', e => { keys[e.key] = false; });

  // Public API — called by app.js
  function generateBadgePositions() {
    const pzoneW = 50;
    const pzoneX = W - pzoneW;
    const logoSize = 20;
    const padding = 8;
    badgePositions = logoImages.map((_, i) => ({
      x: pzoneX + padding + Math.random() * (pzoneW - logoSize - padding * 2),
      y: 30 + (i * (H - 60)) / logoImages.length + Math.random() * 30,
    }));
  }

  window.startGame = function () {
    // Stop any existing loop first
    if (animId) cancelAnimationFrame(animId);
    score = 0;
    beams = [];
    particles = [];
    floatingTexts = [];
    shieldY = H / 2;
    Object.keys(keys).forEach(k => { keys[k] = false; });
    generateBadgePositions();
    running = true;
    loop();
  };

  window.stopGame = function () {
    running = false;
    if (animId) cancelAnimationFrame(animId);
    animId = null;
    Object.keys(keys).forEach(k => { keys[k] = false; });
  };
})();
