// ─── Data Shield Mini-Game ───
// Plays during loading. Block red beams (bad data), let green (good data) pass.

(function () {
  const canvas = document.getElementById('gameCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  let running = false;
  let animId = null;
  let score = 0;
  let beams = [];
  let particles = [];
  let shieldY = H / 2;
  const shieldH = 60;
  const shieldW = 8;
  const shieldX = W * 0.72;
  const keys = {};

  // Castle (store) on the left
  const castle = { x: 10, y: H / 2 - 40, w: 50, h: 80 };

  function spawnBeam() {
    const isRed = Math.random() < 0.45;
    beams.push({
      x: castle.x + castle.w + 10,
      y: castle.y + 10 + Math.random() * (castle.h - 20),
      speed: 1.5 + Math.random() * 2.5,
      w: 28 + Math.random() * 20,
      h: 4,
      red: isRed,
      alpha: 1,
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

  function update() {
    // Shield movement
    const moveSpeed = 4;
    if (keys['ArrowUp'] || keys['w'] || keys['W']) shieldY -= moveSpeed;
    if (keys['ArrowDown'] || keys['s'] || keys['S']) shieldY += moveSpeed;
    shieldY = Math.max(shieldH / 2, Math.min(H - shieldH / 2, shieldY));

    // Spawn beams
    if (Math.random() < 0.04) spawnBeam();

    // Update beams
    for (let i = beams.length - 1; i >= 0; i--) {
      const b = beams[i];
      b.x += b.speed;

      // Check shield collision
      const shieldTop = shieldY - shieldH / 2;
      const shieldBot = shieldY + shieldH / 2;
      if (b.x + b.w >= shieldX && b.x <= shieldX + shieldW &&
          b.y + b.h >= shieldTop && b.y <= shieldBot) {
        if (b.red) {
          score++;
          spawnParticles(shieldX, b.y, '#ef4444');
        } else {
          score = Math.max(0, score - 1);
          spawnParticles(shieldX, b.y, '#22c55e');
        }
        beams.splice(i, 1);
        continue;
      }

      // Off screen
      if (b.x > W + 10) {
        if (b.red) score = Math.max(0, score - 1);
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
    // Store icon (bag)
    ctx.fillStyle = '#6366f1';
    ctx.font = '22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('\uD83D\uDECD\uFE0F', castle.x + castle.w / 2, castle.y + castle.h / 2 + 8);

    // Partner zone label
    ctx.fillStyle = 'rgba(136, 136, 160, 0.3)';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Partners', W - 30, 16);

    // Beams
    beams.forEach(b => {
      const color = b.red ? '#ef4444' : '#22c55e';
      const glow = b.red ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)';
      ctx.shadowColor = glow;
      ctx.shadowBlur = 8;
      ctx.fillStyle = color;
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
  }

  function loop() {
    if (!running) return;
    update();
    draw();
    animId = requestAnimationFrame(loop);
  }

  // Keyboard
  document.addEventListener('keydown', e => {
    keys[e.key] = true;
    if (['ArrowUp', 'ArrowDown'].includes(e.key)) e.preventDefault();
  });
  document.addEventListener('keyup', e => { keys[e.key] = false; });

  // Public API — called by app.js
  window.startGame = function () {
    score = 0;
    beams = [];
    particles = [];
    shieldY = H / 2;
    running = true;
    loop();
  };

  window.stopGame = function () {
    running = false;
    if (animId) cancelAnimationFrame(animId);
  };
})();
