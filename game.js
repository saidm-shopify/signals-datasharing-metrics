// ─── Data Sharing Optimizer ───
// Plays during loading. Intercept red data packets before they leak to partners.

(function () {
  const canvas = document.getElementById('gameCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  // Read dimensions from HTML attributes (works even when display:none)
  const W = parseInt(canvas.getAttribute('width')) || 800;
  const H = parseInt(canvas.getAttribute('height')) || 300;

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

  // Partner icons as inline SVGs (no external requests)
  const partnerSvgs = [
    { name: 'X', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%2360a5fa"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>' },
    { name: 'TikTok', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%2322d3ee"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.87a8.28 8.28 0 004.77 1.52V6.93a4.84 4.84 0 01-1-.24z"/></svg>' },
    { name: 'Pinterest', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23ef4444"><path d="M12 0a12 12 0 00-4.37 23.17c-.1-.94-.2-2.4.04-3.44l1.43-6.09s-.36-.73-.36-1.81c0-1.7.98-2.96 2.21-2.96 1.04 0 1.54.78 1.54 1.72 0 1.05-.67 2.62-1.01 4.07-.29 1.21.61 2.2 1.8 2.2 2.16 0 3.82-2.28 3.82-5.57 0-2.91-2.09-4.95-5.08-4.95-3.46 0-5.49 2.6-5.49 5.28 0 1.05.4 2.17.91 2.78.1.12.11.23.08.35l-.34 1.36c-.05.22-.18.27-.41.16-1.53-.71-2.48-2.96-2.48-4.76 0-3.87 2.81-7.43 8.12-7.43 4.26 0 7.58 3.04 7.58 7.1 0 4.24-2.67 7.65-6.39 7.65-1.25 0-2.42-.65-2.82-1.41l-.77 2.93c-.28 1.07-1.04 2.41-1.54 3.23A12 12 0 1012 0z"/></svg>' },
    { name: 'Snap', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23facc15"><path d="M12.21 1.5c2.75.03 4.97 1.29 6.18 3.53.62 1.15.8 2.41.8 3.7-.02 1.1-.14 2.2-.26 3.29-.02.14 0 .22.14.28.5.23 1.01.45 1.48.74.4.24.58.62.48 1.01-.1.41-.44.64-.87.67-.3.02-.6-.02-.89-.1-.3-.07-.58-.18-.87-.27-.12-.04-.23-.03-.33.05-.62.49-1.31.86-2.11 1.03-.63.13-1.24.3-1.79.65-.72.46-1.48.84-2.37.9-.04 0-.08.02-.12.02h-.34c-.9-.06-1.66-.44-2.38-.9-.55-.35-1.16-.52-1.79-.65-.8-.17-1.49-.54-2.11-1.03-.1-.08-.21-.09-.33-.05-.29.09-.57.2-.87.27-.29.08-.59.12-.89.1-.43-.03-.77-.26-.87-.67-.1-.39.08-.77.48-1.01.47-.29.98-.51 1.48-.74.14-.06.16-.14.14-.28-.12-1.09-.24-2.19-.26-3.29 0-1.29.18-2.55.8-3.7C7.02 2.79 9.24 1.53 11.99 1.5h.22z"/></svg>' },
    { name: 'Bing', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M5 3v16.5l4.06 2.3 8.44-3.06V14.5l-4.7-1.7L5 3zm4.06 5.05l3.07 6.55 3.37 1.22-3.37 1.25-3.07-1.72V8.05z" fill="%2338bdf8"/></svg>' },
  ];
  const logoImages = [];
  let badgePositions = [];

  // Convert SVGs to data URI images (sync, no CORS, no external requests)
  partnerSvgs.forEach(p => {
    const img = new Image();
    img.src = 'data:image/svg+xml,' + encodeURIComponent(p.svg);
    logoImages.push({ img, name: p.name });
  });

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
    const logoSize = 22;
    logoImages.forEach((l, i) => {
      const pos = badgePositions[i];
      if (!pos) return;
      ctx.globalAlpha = 0.7;
      if (l.img.complete) {
        ctx.drawImage(l.img, pos.x, pos.y, logoSize, logoSize);
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
    // Ensure canvas resolution matches attributes
    canvas.width = W;
    canvas.height = H;
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
