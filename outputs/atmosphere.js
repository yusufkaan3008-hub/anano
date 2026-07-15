/* NEON RIFT Atmosphere Pack — standalone, fault-tolerant audio and biome renderer */
(() => {
  'use strict';
  const canvas = document.querySelector('#c');
  if (!canvas || typeof window.draw !== 'function') return;
  const ctx = canvas.getContext('2d');
  const nativeFill = ctx.fillRect.bind(ctx);
  let paintingMap = false;

  function mapName() { return window.game?.biome || 'void'; }
  function mapScene() {
    const type = mapName(), W = window.W, H = window.H, g = window.game;
    if (!W || !H || !g) return;
    ctx.save();
    if (type === 'mars') {
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#16030a'); sky.addColorStop(.45, '#8f3028'); sky.addColorStop(1, '#e47042');
      ctx.fillStyle = sky; nativeFill(0, 0, W, H);
      ctx.fillStyle = '#2a0c15'; ctx.beginPath(); ctx.moveTo(0, H * .58);
      for (let i = 0; i < 10; i++) ctx.lineTo(i * W / 9, H * (.42 + Math.abs(Math.sin(i * 1.91)) * .2));
      ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.fill();
      ctx.fillStyle = 'rgba(255,205,130,.22)';
      for (let i = 0; i < 11; i++) { const x = (i * 149 + 60) % W, y = H * (.62 + (i % 4) * .09), r = 30 + (i % 3) * 24; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = '#180811'; nativeFill(W * .14, H * .43, 6, H * .2); nativeFill(W * .105, H * .54, W * .08, 4);
    } else if (type === 'earth') {
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#001b50'); sky.addColorStop(.48, '#1499ca'); sky.addColorStop(1, '#063a48');
      ctx.fillStyle = sky; nativeFill(0, 0, W, H);
      ctx.fillStyle = '#0a5674'; nativeFill(0, H * .54, W, H * .46);
      ctx.fillStyle = '#16884e';
      for (let i = 0; i < 8; i++) { ctx.beginPath(); ctx.ellipse((i * 173 + 50) % W, H * (.69 + (i % 3) * .1), 75, 37, i, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = 'rgba(255,255,255,.28)';
      for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.ellipse((i * 131 + 20) % W, 55 + (i % 3) * 62, 65, 12, 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = '#11273e'; for (let i = 0; i < 14; i++) nativeFill(W * .6 + i * 13, H * .43 - (i % 4) * 9, 9, H * .17 + (i % 5) * 13);
    } else {
      const space = ctx.createRadialGradient(W * .45, H * .42, 4, W * .45, H * .42, Math.max(W, H));
      space.addColorStop(0, '#273d83'); space.addColorStop(.35, '#12163f'); space.addColorStop(1, '#010107');
      ctx.fillStyle = space; nativeFill(0, 0, W, H);
      const planet = ctx.createRadialGradient(W * .78, H * .22, 5, W * .78, H * .22, W * .3);
      planet.addColorStop(0, '#f044df'); planet.addColorStop(.35, '#6542dc'); planet.addColorStop(1, 'rgba(30,20,95,0)');
      ctx.fillStyle = planet; nativeFill(0, 0, W, H);
      for (let i = 0; i < 85; i++) { ctx.fillStyle = i % 3 ? '#81f7ff' : '#ff63eb'; nativeFill((i * 89) % W, (i * 47) % H, i % 5 ? 2 : 3, 2); }
      ctx.strokeStyle = 'rgba(0,245,255,.22)'; for (let i = -H; i < W; i += 55) { ctx.beginPath(); ctx.moveTo(i, H); ctx.lineTo(i + H, 0); ctx.stroke(); }
      ctx.strokeStyle = 'rgba(255,53,211,.7)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(W * .22, H * .58, Math.min(W, H) * .16, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }

  ctx.fillRect = function (x, y, w, h) {
    if (paintingMap && x === 0 && y === 0 && w === window.W && h === window.H) { mapScene(); return; }
    return nativeFill(x, y, w, h);
  };
  const oldDraw = window.draw;
  window.draw = function () { paintingMap = true; oldDraw(); paintingMap = false; };

  // Browser-safe music: starts from a real click, then sequences forever without audio files.
  let audio = null, gain = null, timer = null, step = 0, enabled = true, lastTheme = '';
  const melodies = {
    mars:  { root: 43, bpm: 104, lead: [0,null,7,null,3,null,10,null,0,null,7,null,5,null,3,null], wave: 'sawtooth' },
    earth: { root: 45, bpm: 114, lead: [0,7,12,7,3,7,10,7,0,7,12,15,10,7,3,7], wave: 'triangle' },
    void:  { root: 40, bpm: 128, lead: [0,null,12,7,0,15,7,null,3,null,10,5,3,12,7,null], wave: 'square' },
    'MARS COLOSSUS': { root: 34, bpm: 150, lead: [0,0,7,0,10,7,3,0,0,0,7,10,12,10,7,3], wave: 'sawtooth' },
    'GAIA DETONATOR': { root: 43, bpm: 154, lead: [0,3,7,10,12,10,7,3,0,3,7,15,12,10,7,3], wave: 'sawtooth' },
    'NULL ARCHON': { root: 37, bpm: 160, lead: [0,12,0,7,15,7,3,10,0,12,7,15,3,10,7,0], wave: 'square' }
  };
  const hz = n => 440 * Math.pow(2, (n - 69) / 12);
  function voice(note, duration, wave, volume) {
    if (note == null || !audio || !gain) return;
    const osc = audio.createOscillator(), amp = audio.createGain(), now = audio.currentTime;
    osc.type = wave; osc.frequency.value = hz(note); amp.gain.setValueAtTime(.0001, now); amp.gain.exponentialRampToValueAtTime(volume, now + .015); amp.gain.exponentialRampToValueAtTime(.0001, now + duration);
    osc.connect(amp); amp.connect(gain); osc.start(now); osc.stop(now + duration + .03);
  }
  function beat() {
    if (!enabled || !audio || !window.game?.alive) return;
    const boss = window.game.enemies?.find(e => e.boss), theme = boss?.mapBoss || mapName(), t = melodies[theme] || melodies.void;
    if (theme !== lastTheme) { lastTheme = theme; step = 0; }
    const i = step++ % 16, duration = 60 / t.bpm * .42;
    voice(t.root - 12 + (i % 8 < 4 ? 0 : 5), duration, 'sine', .11);
    voice(t.lead[i] == null ? null : t.root + t.lead[i] + 12, duration * .8, t.wave, .07);
    if (i % 4 === 0) voice(t.root - 24, .11, 'sine', .18);
  }
  function startAudio() {
    if (!enabled || !window.game?.alive) return;
    if (!audio) { audio = new (window.AudioContext || window.webkitAudioContext)(); gain = audio.createGain(); gain.gain.value = .25; gain.connect(audio.destination); }
    audio.resume(); if (!timer) timer = setInterval(beat, 60);
  }
  const musicBtn = document.querySelector('button[style*="Orbitron"]') || document.createElement('button');
  if (!musicBtn.parentNode) { musicBtn.style.cssText = 'position:fixed;right:18px;top:18px;z-index:99;padding:10px;border:1px solid #00f5ff;background:#10152d;color:white;font:700 10px Orbitron'; document.body.appendChild(musicBtn); }
  musicBtn.textContent = '♫ MÜZİĞİ BAŞLAT';
  musicBtn.onclick = () => { if (!audio) { enabled = true; musicBtn.textContent = '♫ MÜZİK: AÇIK'; startAudio(); return; } enabled = !enabled; musicBtn.textContent = enabled ? '♫ MÜZİK: AÇIK' : '♫ MÜZİK: KAPALI'; if (enabled) startAudio(); if (gain) gain.gain.setTargetAtTime(enabled ? .25 : .0001, audio.currentTime, .05); };
  document.addEventListener('click', () => setTimeout(startAudio, 0), true);
})();
