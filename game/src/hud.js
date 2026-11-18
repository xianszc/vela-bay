// The whole heads-up display: mission panel, police response list,
// wanted stars, money, weapon slots, circular minimap, speedometer,
// radio, dialogue and the title / pause / game-over / victory screens.
// All DOM — the 3D canvas never draws UI. The game pushes numbers in;
// this file only shows them.

import { ARSENAL, CREW } from './config.js';
import { cash } from './util.js';

function node(tag, cls, parent, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  if (parent) parent.appendChild(e);
  return e;
}

const STYLE = `
#hud{position:fixed;inset:0;pointer-events:none;font-family:Arial,Helvetica,sans-serif;color:#fff;z-index:5}
.card{background:rgba(12,10,24,.78);border:1px solid rgba(255,255,255,.14);border-radius:8px;padding:8px 10px;backdrop-filter:blur(2px)}
#jobPanel{position:absolute;top:12px;left:12px;width:340px}
#jobPanel .jTitle{color:#ffc93c;font-weight:900;font-size:15px;letter-spacing:.5px}
#jobPanel .jObj{font-size:14px;margin-top:3px;line-height:1.3}
#jobPanel .jNext{font-size:12px;color:#9fd8ff;margin-top:3px}
.jBar{height:6px;background:#333;border-radius:3px;margin-top:6px;overflow:hidden}
.jBar i{display:block;height:100%;background:#14e0c8}
#copPanel{position:absolute;top:132px;left:12px;width:300px;font-size:12px}
#copPanel .cHead{display:flex;justify-content:space-between;color:#ff8a8a;font-weight:800}
#copPanel .cRow{display:flex;justify-content:space-between;padding:2px 0}
#copPanel .tac{font-weight:800;border-radius:3px;padding:0 5px;font-size:11px}
.tac.PURSUIT{background:#ffb020;color:#111}.tac.RAMMING{background:#ff5e5e;color:#fff}
.tac.ROADBLOCK{background:#ff8c42;color:#111}.tac.SPOTLIGHT{background:#e8e4d8;color:#111}
#topRight{position:absolute;top:12px;right:12px;text-align:right}
#cash{font-size:30px;font-weight:900;color:#7dff6a;text-shadow:0 2px 0 rgba(0,0,0,.5)}
#stars{font-size:26px;letter-spacing:2px;margin:2px 0}
#stars .on{color:#ff3b3b;text-shadow:0 0 8px #ff3b3b}#stars .off{color:rgba(255,255,255,.25)}
#guns{display:flex;gap:6px;justify-content:flex-end;margin-top:6px}
.gslot{width:52px;padding:4px 2px;text-align:center;background:rgba(12,10,24,.78);border:1px solid rgba(255,255,255,.2);border-radius:6px;font-size:11px}
.gslot.sel{border-color:#14e0c8;box-shadow:0 0 8px #14e0c8}
.gslot .k{color:#ffc93c;font-weight:800}.gslot .a{color:#9fd8ff}
#bottomLeft{position:absolute;left:12px;bottom:12px}
#map{border-radius:50%;border:3px solid rgba(255,255,255,.35);background:#1a2a3a;display:block}
#area{font-weight:900;font-size:15px;margin-top:4px;text-shadow:0 1px 3px #000}
#areaSub{font-size:12px;color:#ffd27a;text-shadow:0 1px 3px #000}
#vitals{margin-top:6px;font-size:12px;width:180px}
#vitals .row{display:flex;justify-content:space-between}
.vBar{height:6px;background:#333;border-radius:3px;overflow:hidden;margin:2px 0 5px}
.vBar i{display:block;height:100%}
#bottomRight{position:absolute;right:12px;bottom:12px;text-align:right}
#speedo{font-size:56px;font-weight:900;line-height:.9;text-shadow:0 3px 0 rgba(0,0,0,.45)}
#speedo small{font-size:16px;color:#ffd27a}
#vehLabel{font-size:15px;font-weight:800;color:#14e0c8;text-shadow:0 1px 3px #000}
#condBar{width:220px;height:8px;background:#333;border-radius:4px;overflow:hidden;margin:4px 0 4px auto}
#condBar i{display:block;height:100%;background:#7dff6a}
#nitroBar{width:220px;height:6px;background:#333;border-radius:3px;overflow:hidden;margin:0 0 4px auto}
#nitroBar i{display:block;height:100%;background:#14e0c8}
#station{font-size:13px;color:#ffb020;text-shadow:0 1px 3px #000}
#song{font-size:12px;color:#fff;text-shadow:0 1px 3px #000}
#chat{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);width:520px;display:flex;gap:10px;align-items:flex-start}
#chat .face{width:52px;height:52px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:20px;color:#111;flex:none;border:2px solid #fff}
#chat .cBody{flex:1}
#chat .cName{font-weight:900;font-size:14px}
#chat .cText{font-size:14px;line-height:1.35}
#bigBanner{position:absolute;left:50%;top:34%;transform:translate(-50%,-50%);text-align:center;display:none}
#bigBanner .bBig{font-size:64px;font-weight:900;letter-spacing:2px;color:#ffd27a;text-shadow:0 4px 0 rgba(0,0,0,.5)}
#bigBanner .bSub{font-size:22px;font-weight:800;color:#fff;text-shadow:0 2px 0 rgba(0,0,0,.5)}
#flash{position:absolute;left:50%;top:56%;transform:translateX(-50%);font-size:20px;font-weight:800;color:#7dff6a;text-shadow:0 2px 0 #000;display:none}
#clock{position:absolute;top:12px;left:50%;transform:translateX(-50%);font-size:13px;font-weight:800;color:#ffe9a8;text-shadow:0 1px 3px #000}
.screen{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:auto;z-index:10;background:radial-gradient(ellipse at 50% 30%,rgba(255,140,66,.25),rgba(10,6,24,.82) 70%)}
.screen .sheet{text-align:center;max-width:640px;padding:20px}
.bigTitle{font-size:72px;font-weight:900;line-height:.95;letter-spacing:1px;color:#fff;text-shadow:0 0 24px rgba(255,140,66,.8),0 4px 0 rgba(0,0,0,.5)}
.bigTitle span{color:#14e0c8}
.tagLine{font-size:20px;color:#ffd27a;margin:8px 0 4px;font-weight:700}
.tagSub{font-size:14px;color:#ddd;margin-bottom:16px}
.crewRow{display:flex;gap:12px;justify-content:center;margin:14px 0 20px}
.crewChip{width:110px;background:rgba(12,10,24,.8);border:1px solid rgba(255,255,255,.2);border-radius:8px;padding:8px 4px}
.crewChip .av{width:44px;height:44px;border-radius:50%;margin:0 auto 6px;display:flex;align-items:center;justify-content:center;font-weight:900;color:#111;font-size:18px}
.crewChip .nm{font-weight:800;font-size:12px;color:#fff}.crewChip .rl{font-size:11px;color:#9fd8ff}
.btn{display:block;width:280px;margin:8px auto;padding:12px 0;font-size:18px;font-weight:900;color:#111;background:#14e0c8;border:none;border-radius:8px;cursor:pointer}
.btn.alt{background:#ffc93c}.btn.ghost{background:rgba(255,255,255,.14);color:#fff}
.btn:hover{filter:brightness(1.15)}
.helpBox{text-align:left;font-size:14px;line-height:1.6;background:rgba(12,10,24,.8);border-radius:8px;padding:12px 16px;margin:10px auto;width:420px}
.helpBox b{color:#ffc93c}
.fine{font-size:12px;color:#bbb;margin-top:10px}
`;

export class Overlay {
  constructor() {
    const style = document.createElement('style');
    style.textContent = STYLE;
    document.head.appendChild(style);
    this.root = node('div', '', document.body);
    this.root.id = 'hud';

    this.jobPanel = node('div', 'card', this.root);
    this.jobPanel.id = 'jobPanel';
    this.jTitle = node('div', 'jTitle', this.jobPanel);
    this.jObj = node('div', 'jObj', this.jobPanel);
    this.jNext = node('div', 'jNext', this.jobPanel);
    const bar = node('div', 'jBar', this.jobPanel);
    this.jBarFill = node('i', '', bar);

    this.copPanel = node('div', 'card', this.root);
    this.copPanel.id = 'copPanel';

    const tr = node('div', '', this.root);
    tr.id = 'topRight';
    this.cashEl = node('div', '', tr); this.cashEl.id = 'cash';
    this.starsEl = node('div', '', tr); this.starsEl.id = 'stars';
    this.gunsEl = node('div', '', tr); this.gunsEl.id = 'guns';

    const bl = node('div', '', this.root);
    bl.id = 'bottomLeft';
    this.mapCanvas = node('canvas', '', bl);
    this.mapCanvas.id = 'map';
    this.mapCanvas.width = 170; this.mapCanvas.height = 170;
    this.mapCtx = this.mapCanvas.getContext('2d');
    this.areaEl = node('div', '', bl); this.areaEl.id = 'area';
    this.areaSubEl = node('div', '', bl); this.areaSubEl.id = 'areaSub';
    const vit = node('div', '', bl); vit.id = 'vitals';
    node('div', 'row', vit, '<span>HEALTH</span><span id="hpNum"></span>');
    const hpBar = node('div', 'vBar', vit); this.hpFill = node('i', '', hpBar); this.hpFill.style.background = '#7dff6a';
    node('div', 'row', vit, '<span>ARMOUR</span><span id="arNum"></span>');
    const arBar = node('div', 'vBar', vit); this.arFill = node('i', '', arBar); this.arFill.style.background = '#9fd8ff';
    node('div', 'row', vit, '<span>REP</span><span id="repNum"></span>');
    const repBar = node('div', 'vBar', vit); this.repFill = node('i', '', repBar); this.repFill.style.background = '#ffb020';
    this.hpNum = vit.querySelector('#hpNum');
    this.arNum = vit.querySelector('#arNum');
    this.repNum = vit.querySelector('#repNum');

    const br = node('div', '', this.root);
    br.id = 'bottomRight';
    this.speedEl = node('div', '', br); this.speedEl.id = 'speedo';
    this.vehEl = node('div', '', br); this.vehEl.id = 'vehLabel';
    const cb = node('div', '', br); cb.id = 'condBar'; this.condFill = node('i', '', cb);
    const nb = node('div', '', br); nb.id = 'nitroBar'; this.nitroFill = node('i', '', nb);
    this.stationEl = node('div', '', br); this.stationEl.id = 'station';
    this.songEl = node('div', '', br); this.songEl.id = 'song';

    this.chat = node('div', 'card', this.root);
    this.chat.id = 'chat';
    this.chat.style.display = 'none';

    this.clockEl = node('div', '', this.root); this.clockEl.id = 'clock';
    this.bannerEl = node('div', '', this.root); this.bannerEl.id = 'bigBanner';
    this.bannerBig = node('div', 'bBig', this.bannerEl);
    this.bannerSub = node('div', 'bSub', this.bannerEl);
    this.flashEl = node('div', '', this.root); this.flashEl.id = 'flash';

    this.screen = null;
    this.onAction = null;
    this.bannerTimer = 0;
    this.flashTimer = 0;
    this.chatTimer = 0;
  }

  // ---- in-game panels -------------------------------------------------------
  setJob(index, total, title, stepText, stepNum, stepTotal, nextText) {
    this.jTitle.textContent = `MISSION ${index + 1} / ${total}: ${title}`;
    this.jObj.textContent = stepText;
    this.jNext.textContent = nextText || '';
    this.jBarFill.style.width = `${Math.round((stepNum / Math.max(1, stepTotal)) * 100)}%`;
  }

  setCops(units) {
    const head = `<span>VBPD RESPONSE</span><span>${units.length} UNITS</span>`;
    const rows = units.map((u) => {
      const d = u.dist < 1000 ? `${Math.round(u.dist)} m` : `${(u.dist / 1000).toFixed(1)} km`;
      return `<div class="cRow"><span>${u.name}</span><span>${d}</span><span class="tac ${u.tactic}">${u.tactic}</span></div>`;
    }).join('');
    this.copPanel.innerHTML = `<div class="cHead">${head}</div>` + (rows || '<div class="cRow"><span>No units in pursuit</span></div>');
  }

  setWanted(stars) {
    let s = '';
    for (let i = 0; i < 5; i++) s += `<span class="${i < stars ? 'on' : 'off'}">★</span>`;
    this.starsEl.innerHTML = `WANTED ${s}`;
  }

  setCash(n) { this.cashEl.textContent = cash(n); }

  setGuns(currentSlot, ammo) {
    this.gunsEl.innerHTML = ARSENAL.map((w) => {
      const a = ammo ? ammo[w.slot - 1] : w.ammo;
      const shown = a === Infinity ? '∞' : a;
      return `<div class="gslot ${w.slot === currentSlot ? 'sel' : ''}"><div class="k">${w.slot}</div><div>${w.name}</div><div class="a">${shown}</div></div>`;
    }).join('');
  }

  setSpeed(kmh, vehName, condition, nitro) {
    this.speedEl.innerHTML = `${Math.round(kmh)} <small>KM/H</small>`;
    this.vehEl.textContent = vehName || 'ON FOOT';
    this.condFill.style.width = `${Math.max(0, Math.min(100, condition))}%`;
    this.condFill.style.background = condition > 50 ? '#7dff6a' : condition > 25 ? '#ffb020' : '#ff5e5e';
    this.nitroFill.style.width = `${Math.max(0, Math.min(100, nitro))}%`;
  }

  setVitals(hp, armour, rep) {
    this.hpNum.textContent = Math.round(hp);
    this.hpFill.style.width = `${Math.max(0, hp)}%`;
    this.arNum.textContent = Math.round(armour);
    this.arFill.style.width = `${Math.max(0, armour)}%`;
    const level = Math.floor(rep / 500) + 1;
    this.repNum.textContent = `LV ${level} · ${Math.round(rep)}`;
    this.repFill.style.width = `${Math.min(100, (rep % 500) / 5)}%`;
  }

  setArea(name, sub) {
    this.areaEl.textContent = name;
    this.areaSubEl.textContent = sub || '';
  }

  setStation(station) {
    this.stationEl.textContent = `♪ ${station.name}`;
    this.songEl.textContent = station.song;
  }

  setClock(text) { this.clockEl.textContent = text; }

  showChat(line) {
    const c = CREW[line.speaker] || { name: line.name, color: '#14e0c8', initials: line.initials || '?' };
    this.chat.innerHTML = `<div class="face" style="background:${c.color}">${c.initials}</div><div class="cBody"><div class="cName" style="color:${c.color}">${c.name} · ${c.role || ''}</div><div class="cText">${line.text}</div></div>`;
    this.chat.style.display = 'flex';
    this.chatTimer = 7;
  }

  hideChat() { this.chat.style.display = 'none'; this.chatTimer = 0; }

  bigBanner(big, sub, seconds = 3.2) {
    this.bannerBig.textContent = big;
    this.bannerSub.textContent = sub || '';
    this.bannerEl.style.display = 'block';
    this.bannerTimer = seconds;
  }

  flash(text, seconds = 2) {
    this.flashEl.textContent = text;
    this.flashEl.style.display = 'block';
    this.flashTimer = seconds;
  }

  tick(dt) {
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) this.bannerEl.style.display = 'none';
    }
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) this.flashEl.style.display = 'none';
    }
    if (this.chatTimer > 0) {
      this.chatTimer -= dt;
      if (this.chatTimer <= 0) this.hideChat();
    }
  }

  // ---- minimap ---------------------------------------------------------------
  drawMap(d) {
    const g = this.mapCtx;
    const S = 170, C = S / 2;
    const scale = S / 560; // world -280..280
    g.clearRect(0, 0, S, S);
    g.save();
    g.beginPath(); g.arc(C, C, C - 2, 0, Math.PI * 2); g.clip();
    // Sea and land.
    g.fillStyle = '#1e6f8e'; g.fillRect(0, 0, S, S);
    g.fillStyle = '#3d3a4a'; g.fillRect(0, 0, S, (204 + 280) * scale);
    g.fillStyle = '#e8c98f'; g.fillRect(0, (186 + 280) * scale, S, 18 * scale);
    // Canal + marina water.
    g.fillStyle = '#1e6f8e';
    g.fillRect((140 + 280) * scale, 0, 32 * scale, (204 + 280) * scale);
    g.fillRect((-208 + 280) * scale, (92 + 280) * scale, 62 * scale, 94 * scale);
    // Roads.
    g.strokeStyle = '#23202e'; g.lineWidth = 5;
    for (const x of [-180, -120, -60, 0, 60, 120, 180]) {
      g.beginPath(); g.moveTo((x + 280) * scale, 0); g.lineTo((x + 280) * scale, S); g.stroke();
    }
    for (const z of [-180, -120, -60, 0, 60, 120, 180]) {
      g.beginPath(); g.moveTo(0, (z + 280) * scale); g.lineTo(S, (z + 280) * scale); g.stroke();
    }
    // Causeway.
    g.strokeStyle = '#8a8496'; g.lineWidth = 6;
    g.beginPath(); g.moveTo((-60 + 280) * scale, (186 + 280) * scale); g.lineTo((-60 + 280) * scale, (330 + 280) * scale); g.stroke();
    // Mission marker.
    if (d.marker) {
      const mx = (d.marker.x + 280) * scale, my = (d.marker.z + 280) * scale;
      g.fillStyle = '#14e0c8';
      g.beginPath(); g.moveTo(mx, my - 7); g.lineTo(mx + 6, my); g.lineTo(mx, my + 7); g.lineTo(mx - 6, my); g.closePath(); g.fill();
      g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.stroke();
    }
    // Police dots.
    for (const u of d.police) {
      g.fillStyle = '#ff3b3b';
      g.beginPath(); g.arc((u.x + 280) * scale, (u.z + 280) * scale, 3.5, 0, Math.PI * 2); g.fill();
    }
    // Player arrow.
    const px = (d.playerX + 280) * scale, py = (d.playerZ + 280) * scale;
    g.save();
    g.translate(px, py);
    g.rotate(Math.PI - d.heading);
    g.fillStyle = '#fff';
    g.beginPath(); g.moveTo(0, -7); g.lineTo(5, 6); g.lineTo(-5, 6); g.closePath(); g.fill();
    g.restore();
    g.restore();
    g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 2;
    g.beginPath(); g.arc(C, C, C - 2, 0, Math.PI * 2); g.stroke();
  }

  // ---- overlays ----------------------------------------------------------------
  clearScreen() {
    if (this.screen) { this.screen.remove(); this.screen = null; }
  }

  showTitle(save, onAction) {
    this.clearScreen();
    const o = node('div', 'screen', document.body);
    this.screen = o;
    const sheet = node('div', 'sheet', o);
    node('div', 'bigTitle', sheet, 'VELA BAY<br><span>SUNSET HEIST</span>');
    node('div', 'tagLine', sheet, 'An open-world crime story on the bay');
    node('div', 'tagSub', sheet, 'Steal cars. Steal boats. Outrun the VBPD. Take the Vela GT and vanish across the water.');
    const crew = node('div', 'crewRow', sheet);
    for (const k of ['rex', 'mara', 'theo']) {
      const c = CREW[k];
      const chip = node('div', 'crewChip', crew);
      node('div', 'av', chip, c.initials).style.background = c.color;
      node('div', 'nm', chip, c.name);
      node('div', 'rl', chip, c.role);
    }
    const mkBtn = (label, cls, action) => {
      const b = node('button', `btn ${cls || ''}`, sheet, label);
      b.addEventListener('click', () => onAction(action));
      return b;
    };
    if (save) mkBtn(`CONTINUE — MISSION ${save.mission + 1} · ${cash(save.money)}`, '', 'continue');
    mkBtn('NEW GAME', save ? 'alt' : '', 'new');
    mkBtn('CONTROLS', 'ghost', 'controls');
    node('div', 'fine', sheet, 'WASD drive / walk · Mouse drag camera · F enter or steal · Click shoot · 1–4 weapons · Q radio · Shift sprint · Space handbrake · N nitro · M mute · Esc pause');
    if (save) node('div', 'fine', sheet, `Save found: mission ${save.mission + 1} of 8, rep ${Math.round(save.rep)}.`);
  }

  showControls(onBack) {
    this.clearScreen();
    const o = node('div', 'screen', document.body);
    this.screen = o;
    const sheet = node('div', 'sheet', o);
    node('div', 'bigTitle', sheet, '<span>CONTROLS</span>');
    node('div', 'helpBox', sheet, `
      <b>W A S D</b> — walk / drive &nbsp;·&nbsp; <b>Mouse drag</b> — orbit camera &nbsp;·&nbsp; <b>Wheel</b> — zoom<br>
      <b>F</b> — enter / steal car or boat &nbsp;·&nbsp; <b>Click</b> — shoot &nbsp;·&nbsp; <b>1–4</b> — weapons<br>
      <b>Q</b> — next radio station &nbsp;·&nbsp; <b>Shift</b> — sprint &nbsp;·&nbsp; <b>Space</b> — handbrake drift<br>
      <b>N</b> — nitro &nbsp;·&nbsp; <b>M</b> — mute &nbsp;·&nbsp; <b>Esc</b> — pause<br><br>
      Steal the teal VELA GT from the Grand Casino in the final job. Boats live at the
      marina and the canal — the marine unit chases you on the water. Lose the cops
      (1 star or less) to finish a getaway job.`);
    const b = node('button', 'btn', sheet, 'BACK');
    b.addEventListener('click', onBack);
  }

  showPause(onAction) {
    this.clearScreen();
    const o = node('div', 'screen', document.body);
    this.screen = o;
    const sheet = node('div', 'sheet', o);
    node('div', 'bigTitle', sheet, 'PAUSED');
    const mkBtn = (label, cls, action) => {
      const b = node('button', `btn ${cls || ''}`, sheet, label);
      b.addEventListener('click', () => onAction(action));
      return b;
    };
    mkBtn('RESUME', '', 'resume');
    mkBtn('RESTART MISSION', 'alt', 'restart');
    mkBtn('QUIT TO TITLE', 'ghost', 'quit');
  }

  showGameOver(kind, onAction) {
    this.clearScreen();
    const o = node('div', 'screen', document.body);
    this.screen = o;
    const sheet = node('div', 'sheet', o);
    node('div', 'bigTitle', sheet, kind === 'busted' ? 'BUSTED' : 'WASTED');
    node('div', 'tagLine', sheet, kind === 'busted' ? 'The VBPD took you in. The crew posts your bail — the job goes on.' : 'You went down. The crew drags you out — the job goes on.');
    const mkBtn = (label, cls, action) => {
      const b = node('button', `btn ${cls || ''}`, sheet, label);
      b.addEventListener('click', () => onAction(action));
      return b;
    };
    mkBtn('TRY AGAIN', '', 'retry');
    mkBtn('QUIT TO TITLE', 'ghost', 'quit');
  }

  showVictory(money, onAction) {
    this.clearScreen();
    const o = node('div', 'screen', document.body);
    this.screen = o;
    const sheet = node('div', 'sheet', o);
    node('div', 'bigTitle', sheet, '<span>THE SUNSET HEIST</span><br>IS DONE');
    node('div', 'tagLine', sheet, `The Vela GT is across the bay. The crew is rich. ${cash(money)} in the bag.`);
    node('div', 'tagSub', sheet, 'Thanks for playing Vela Bay — Sunset Heist. Free roam stays open: keep driving, keep stealing, keep outrunning the law.');
    const b = node('button', 'btn', sheet, 'KEEP PLAYING (FREE ROAM)');
    b.addEventListener('click', () => onAction('freeroam'));
    const b2 = node('button', 'btn alt', sheet, 'PLAY AGAIN');
    b2.addEventListener('click', () => onAction('new'));
  }
}
