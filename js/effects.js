// ============================================================
//  Visual + audio effects: stars, sparkles, balloons,
//  confetti, fireworks, and WebAudio sound effects.
// ============================================================

const FX = (function () {
  // ---------- background decor ----------
  function spawnStars(n = 90) {
    const c = document.getElementById("bg-stars");
    let html = "";
    for (let i = 0; i < n; i++) {
      const s = (Math.random() * 2.5 + 0.6).toFixed(1);
      html += `<span class="star" style="left:${Math.random()*100}%;top:${Math.random()*100}%;width:${s}px;height:${s}px;--dur:${(Math.random()*3+2).toFixed(1)}s"></span>`;
    }
    c.innerHTML = html;
  }
  function spawnSparkles(n = 18) {
    const c = document.getElementById("bg-sparkles");
    const icons = ["✨","💫","⭐","💗","🌟"];
    let html = "";
    for (let i = 0; i < n; i++) {
      html += `<span class="sparkle" style="left:${Math.random()*100}%;bottom:-20px;font-size:${(Math.random()*10+10)|0}px;animation-duration:${(Math.random()*10+10).toFixed(1)}s;animation-delay:${(Math.random()*10).toFixed(1)}s">${icons[i%icons.length]}</span>`;
    }
    c.innerHTML = html;
  }
  function spawnBalloons(n = 8) {
    const c = document.getElementById("bg-balloons");
    const icons = ["🎈","🎈","🎈","🩷","💜","💙"];
    let html = "";
    for (let i = 0; i < n; i++) {
      html += `<span class="balloon" style="left:${Math.random()*100}%;--dur:${(Math.random()*8+10).toFixed(1)}s;--drift:${(Math.random()*80-40)|0}px;animation-delay:${(Math.random()*8).toFixed(1)}s">${icons[i%icons.length]}</span>`;
    }
    c.innerHTML = html;
  }

  // ---------- confetti / fireworks canvas ----------
  const canvas = document.getElementById("confetti-canvas");
  const ctx = canvas.getContext("2d");
  let particles = [];
  let rafActive = false;

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener("resize", resize);
  resize();

  const COLORS = ["#FFD166","#FF6B9A","#7BDFF2","#A855F7","#FFF7E6","#4ade80"];
  // brighter, saturated palette for the grand finale bursts
  const FW_COLORS = ["#FFD166","#FF6B9A","#7BDFF2","#A855F7","#4ade80","#fb7185","#facc15","#38bdf8","#f0abfc"];

  let rockets = []; // ascending rockets that explode at apex
  let glowMode = false; // true during the fireworks finale -> fade trails + additive glow

  function loop() {
    if (glowMode) {
      // soft fade instead of hard clear -> glowing light trails
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = "lighter"; // additive glow for sparks
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = "source-over";
    }

    // update ascending rockets
    rockets = rockets.filter((r) => !r.done);
    for (const r of rockets) {
      r.x += r.vx; r.y += r.vy; r.vy += 0.06; r.trail--;
      ctx.globalAlpha = 1;
      ctx.fillStyle = r.color;
      ctx.beginPath(); ctx.arc(r.x, r.y, 2.4, 0, Math.PI*2); ctx.fill();
      // small spark trail
      ctx.globalAlpha = 0.5;
      ctx.beginPath(); ctx.arc(r.x, r.y + 6, 1.6, 0, Math.PI*2); ctx.fill();
      if (r.vy >= -0.6 || r.y <= r.targetY) { explode(r.x, r.y, r.color, r.big); r.done = true; }
    }

    particles = particles.filter((p) => p.life > 0);
    for (const p of particles) {
      p.x += p.vx; p.y += p.vy; p.vy += p.g; p.life--;
      p.vx *= 0.985;
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      if (p.shape === "rect") {
        ctx.globalCompositeOperation = "source-over";
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot += 0.12);
        ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size*0.5); ctx.restore();
        if (glowMode) ctx.globalCompositeOperation = "lighter";
      } else {
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill();
        // glow halo
        if (p.glow) {
          ctx.globalAlpha *= 0.35;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size*2.4, 0, Math.PI*2); ctx.fill();
        }
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    if (particles.length > 0 || rockets.length > 0) { requestAnimationFrame(loop); }
    else { rafActive = false; ctx.clearRect(0,0,canvas.width,canvas.height); }
  }
  function ensureLoop() { if (!rafActive) { rafActive = true; requestAnimationFrame(loop); } }

  function confetti(count = 160) {
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * canvas.width, y: -20,
        vx: (Math.random()-0.5)*4, vy: Math.random()*3+2, g: 0.08,
        size: Math.random()*8+5, color: COLORS[(Math.random()*COLORS.length)|0],
        life: 200, maxLife: 200, shape: "rect", rot: Math.random()*6,
      });
    }
    ensureLoop();
  }

  // an explosion burst (used by rockets + the plain firework() call)
  function explode(x, y, color, big) {
    const n = big ? 110 : 64;
    const baseSp = big ? 6 : 4;
    for (let i = 0; i < n; i++) {
      const a = (Math.PI*2*i)/n + Math.random()*0.1;
      const sp = Math.random()*baseSp + 2;
      particles.push({
        x, y, vx: Math.cos(a)*sp, vy: Math.sin(a)*sp, g: 0.045,
        size: Math.random()*2.4+1.8, color,
        life: big ? 100 : 82, maxLife: big ? 100 : 82, shape: "circle", rot: 0, glow: true,
      });
    }
    // a few bright sparkles of a second colour
    const c2 = FW_COLORS[(Math.random()*FW_COLORS.length)|0];
    for (let i = 0; i < (big ? 30 : 16); i++) {
      const a = Math.random()*Math.PI*2; const sp = Math.random()*(baseSp+1)+1;
      particles.push({
        x, y, vx: Math.cos(a)*sp, vy: Math.sin(a)*sp, g: 0.03,
        size: Math.random()*1.6+1, color: c2,
        life: 70, maxLife: 70, shape: "circle", rot: 0, glow: true,
      });
    }
    ensureLoop();
  }

  function firework(x, y) {
    explode(x, y, FW_COLORS[(Math.random()*FW_COLORS.length)|0], false);
  }

  // launch a rocket from the bottom that flies up then explodes
  function launchRocket(big) {
    const x = Math.random()*canvas.width*0.8 + canvas.width*0.1;
    const targetY = canvas.height*(Math.random()*0.28 + 0.12);
    const vy = -(Math.random()*3 + 9);
    rockets.push({
      x, y: canvas.height + 10,
      vx: (Math.random()-0.5)*1.2, vy,
      targetY, big: !!big,
      color: FW_COLORS[(Math.random()*FW_COLORS.length)|0],
      trail: 100, done: false,
    });
    ensureLoop();
  }

  function fireworksShow(duration = 9000) {
    const start = Date.now();
    glowMode = true;
    Sound.play("fireworks");
    // launch rockets in waves
    const iv = setInterval(() => {
      launchRocket(Math.random() < 0.3);
      if (Math.random() < 0.4) launchRocket(false);
      if (Date.now() - start > duration) {
        clearInterval(iv);
        // GRAND FINALE: a burst of big rockets
        for (let i = 0; i < 8; i++) setTimeout(() => launchRocket(true), i*120);
        // leave glow mode shortly after the finale fades
        setTimeout(() => { glowMode = false; }, 2600);
      }
    }, 320);
    confetti(140);
  }

  function ribbonsFall() { confetti(80); }

  return { spawnStars, spawnSparkles, spawnBalloons, confetti, firework, fireworksShow, ribbonsFall, launchRocket };
})();

// ============================================================
//  Sound — lightweight WebAudio synth (no external files)
// ============================================================
const Sound = (function () {
  let enabled = false;
  let actx = null;
  function ctx() { if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)(); return actx; }

  function tone(freq, dur, type = "sine", vol = 0.2, when = 0) {
    if (!enabled) return;
    const a = ctx(); const t = a.currentTime + when;
    const o = a.createOscillator(); const g = a.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(a.destination);
    o.start(t); o.stop(t + dur);
  }
  function noise(dur, vol = 0.3) {
    if (!enabled) return;
    const a = ctx(); const t = a.currentTime;
    const buf = a.createBuffer(1, a.sampleRate * dur, a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random()*2-1) * (1 - i/d.length);
    const src = a.createBufferSource(); src.buffer = buf;
    const g = a.createGain(); g.gain.value = vol;
    src.connect(g); g.connect(a.destination); src.start(t);
  }

  const sounds = {
    sparkle: () => { tone(880,0.15,"triangle",0.15); tone(1320,0.2,"triangle",0.12,0.08); },
    cake: () => { tone(330,0.3,"sine",0.2); tone(220,0.4,"sine",0.18,0.15); },
    blow: () => { noise(0.6, 0.25); },
    confetti: () => { for (let i=0;i<5;i++) tone(600+i*120,0.12,"square",0.08,i*0.05); },
    pop: () => { tone(700,0.08,"sine",0.18); },
    spin: () => { for (let i=0;i<12;i++) tone(400+i*20,0.06,"square",0.05,i*0.07); },
    fireworks: () => { for (let i=0;i<6;i++){ tone(200,0.2,"sawtooth",0.12,i*0.4); noise(0.3,0.15);} },
    win: () => { [523,659,784,1046].forEach((f,i)=>tone(f,0.25,"triangle",0.18,i*0.12)); },
  };

  return {
    toggle() { enabled = !enabled; if (enabled) ctx().resume?.(); return enabled; },
    isOn() { return enabled; },
    play(name) { try { sounds[name] && sounds[name](); } catch(e){} },
  };
})();
