// The whole heads-up display: mission panel, police response list, wanted
// stars, money, weapon slots, circular minimap, speedometer, radio, dialogue
// and the title / pause / game-over / victory screens. All DOM — the 3D
// canvas never draws UI. The game pushes numbers in; this file only shows
// them.

import { WEAPONS, RADIO, CREW } from './config.js';
import { formatMoney } from './util.js';

function el(tag, cls, parent, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  if (parent) parent.appendChild(e);
  return e;
}

const CSS = `
#hud{position:fixed;inset:0;pointer-events:none;font-family:Arial,Helvetica,sans-serif;color:#fff;z-index:5}
.panel{background:rgba(12,10,24,.78);border:1px solid rgba(255,255,255,.14);border-radius:8px;padding:8px 10px;backdrop-filter:blur(2px)}
#missionPanel{position:absolute;top:12px;left:12px;width:340px}
#missionPanel .mTitle{color:#ffc93c;font-weight:900;font-size:15px;letter-spacing:.5px}
#missionPanel .mObj{font-size:14px;margin-top:3px;line-height:1.3}
#missionPanel .mNext{font-size:12px;color:#9fd8ff;margin-top:3px}
.mBar{height:6px;background:#333;border-radius:3px;margin-top:6px;overflow:hidden}
.mBar i{display:block;height:100%;background:#14e0c8}
#policePanel{position:absolute;top:132px;left:12px;width:300px;font-size:12px}
#policePanel .pHead{display:flex;justify-content:space-between;color:#ff8a8a;font-weight:800}
#policePanel .pRow{display:flex;justify-content:space-between;padding:2px 0}
#policePanel .tac{font-weight:800;border-radius:3px;padding:0 5px;font-size:11px}
.tac.PURSUIT{background:#ffb020;color:#111}.tac.RAMMING{background:#ff5e5e;color:#fff}
.tac.ROADBLOCK{background:#ff8c42;color:#111}.tac.SPOTLIGHT{background:#e8e4d8;color:#111}
#topRight{position:absolute;top:12px;right:12px;text-align:right}
#money{font-size:30px;font-weight:900;color:#7dff6a;text-shadow:0 2px 0 rgba(0,0,0,.5)}
#stars{font-size:26px;letter-spacing:2px;margin:2px 0}
#stars .on{color:#ff3b3b;text-shadow:0 0 8px #ff3b3b}#stars .off{color:rgba(255,255,255,.25)}
#weapons{display:flex;gap:6px;justify-content:flex-end;margin-top:6px}
.wslot{width:52px;padding:4px 2px;text-align:center;background:rgba(12,10,24,.78);border:1px solid rgba(255,255,255,.2);border-radius:6px;font-size:11px}
.wslot.sel{border-color:#14e0c8;box-shadow:0 0 8px #14e0c8}
.wslot .k{color:#ffc93c;font-weight:800}.wslot .a{color:#9fd8ff}
#bottomLeft{position:absolute;left:12px;bottom:12px}
#minimap{border-radius:50%;border:3px solid rgba(255,255,255,.35);background:#1a2a3a;display:block}
#district{font-weight:900;font-size:15px;margin-top:4px;text-shadow:0 1px 3px #000}
#districtSub{font-size:12px;color:#ffd27a;text-shadow:0 1px 3px #000}
#vitals{margin-top:6px;font-size:12px;width:180px}
#vitals .row{display:flex;justify-content:space-between}
.vBar{height:6px;background:#333;border-radius:3px;overflow:hidden;margin:2px 0 5px}
.vBar i{display:block;height:100%}
#bottomRight{position:absolute;right:12px;bottom:12px;text-align:right}
#speed{font-size:56px;font-weight:900;line-height:.9;text-shadow:0 3px 0 rgba(0,0,0,.45)}
#speed small{font-size:16px;color:#ffd27a}
#vehName{font-size:15px;font-weight:800;color:#14e0c8;text-shadow:0 1px 3px #000}
#condBar{width:220px;height:8px;background:#333;border-radius:4px;overflow:hidden;margin:4px 0 4px auto}
#condBar i{display:block;height:100%;background:#7dff6a}
#nitroBar{width:220px;height:6px;background:#333;border-radius:3px;overflow:hidden;margin:0 0 4px auto}
#nitroBar i{display:block;height:100%;background:#14e0c8}
#radio{font-size:13px;color:#ffb020;text-shadow:0 1px 3px #000}
#radioSong{font-size:12px;color:#fff;text-shadow:0 1px 3px #000}
#dialogue{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);width:520px;display:flex;gap:10px;align-items:flex-start}
#dialogue .avatar{width:52px;height:52px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:20px;color:#111;flex:none;border:2px solid #fff}
#dialogue .dBody{flex:1}
#dialogue .dName{font-weight:900;font-size:14px}
#dialogue .dText{font-size:14px;line-height:1.35}
#banner{position:absolute;left:50%;top:34%;transform:translate(-50%,-50%);text-align:center;display:none}
#banner .bBig{font-size:64px;font-weight:900;letter-spacing:2px;color:#ffd27a;text-shadow:0 4px 0 rgba(0,0,0,.5)}
#banner .bSub{font-size:22px;font-weight:800;color:#fff;text-shadow:0 2px 0 rgba(0,0,0,.5)}
#toast{position:absolute;left:50%;top:56%;transform:translateX(-50%);font-size:20px;font-weight:800;color:#7dff6a;text-shadow:0 2px 0 #000;display:none}
#clock{position:absolute;top:12px;left:50%;transform:translateX(-50%);font-size:13px;font-weight:800;color:#ffe9a8;text-shadow:0 1px 3px #000}
.overlay{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:auto;z-index:10;background:radial-gradient(ellipse at 50% 30%,rgba(255,140,66,.25),rgba(10,6,24,.82) 70%)}
.overlay .card{text-align:center;max-width:640px;padding:20px}
.gameTitle{font-size:72px;font-weight:900;line-height:.95;letter-spacing:1px;color:#fff;text-shadow:0 0 24px rgba(255,140,66,.8),0 4px 0 rgba(0,0,0,.5)}
.gameTitle span{color:#14e0c8}
.gameSub{font-size:20px;color:#ffd27a;margin:8px 0 4px;font-weight:700}
.gameTag{font-size:14px;color:#ddd;margin-bottom:16px}
.crewRow{display:flex;gap:12px;justify-content:center;margin:14px 0 20px}
.crewChip{width:110px;background:rgba(12,10,24,.8);border:1px solid rgba(255,255,255,.2);border-radius:8px;padding:8px 4px}
.crewChip .av{width:44px;height:44px;border-radius:50%;margin:0 auto 6px;display:flex;align-items:center;justify-content:center;font-weight:900;color:#111;font-size:18px}
.crewChip .nm{font-weight:800;font-size:12px;color:#fff}.crewChip .rl{font-size:11px;color:#9fd8ff}
.menuBtn{display:block;width:280px;margin:8px auto;padding:12px 0;font-size:18px;font-weight:900;color:#111;background:#14e0c8;border:none;border-radius:8px;cursor:pointer}
.menuBtn.alt{background:#ffc93c}.menuBtn.ghost{background:rgba(255,255,255,.14);color:#fff}
.menuBtn:hover{filter:brightness(1.15)}
.helpBox{text-align:left;font-size:14px;line-height:1.6;background:rgba(12,10,24,.8);border-radius:8px;padding:12px 16px;margin:10px auto;width:420px}
.helpBox b{color:#ffc93c}
.small{font-size:12px;color:#bbb;margin-top:10px}
`;

export class HUD {
  constructor() {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    this.root = el('div', '', document.body);
    this.root.id = 'hud';

    this.missionPanel = el('div', 'panel', this.root);
    this.missionPanel.id = 'missionPanel';
    this.mTitle = el('div', 'mTitle', this.missionPanel);
    this.mObj = el('div', 'mObj', this.missionPanel);
    this.mNext = el('div', 'mNext', this.missionPanel);
    const bar = el('div', 'mBar', this.missionPanel);
    this.mBarFill = el('i', '', bar);

    this.policePanel = el('div', 'panel', this.root);
    this.policePanel.id = 'policePanel';

    const tr = el('div', '', this.root);
    tr.id = 'topRight';
    this.moneyEl = el('div', '', tr); this.moneyEl.id = 'money';
    this.starsEl = el('div', '', tr); this.starsEl.id = 'stars';
    this.weaponsEl = el('div', '', tr); this.weaponsEl.id = 'weapons';

    const bl = el('div', '', this.root);
    bl.id = 'bottomLeft';
    this.mapCanvas = el('canvas', '', bl);
    this.mapCanvas.id = 'minimap';
    this.mapCanvas.width = 170; this.mapCanvas.height = 170;
    this.mapCtx = this.mapCanvas.getContext('2d');
    this.districtEl = el('div', '', bl); this.districtEl.id = 'district';
    this.districtSubEl = el('div', '', bl); this.districtSubEl.id = 'districtSub';
    const vit = el('div', '', bl); vit.id = 'vitals';
    el('div', 'row', vit, '<span>HEALTH</span><span id="hpNum"></span>');
    const hpBar = el('div', 'vBar', vit); this.hpFill = el('i', '', hpBar); this.hpFill.style.background = '#7dff6a';
    el('div', 'row', vit, '<span>ARMOUR</span><span id="arNum"></span>');
    const arBar = el('div', 'vBar', vit); this.arFill = el('i', '', arBar); this.arFill.style.background = '#9fd8ff';
    el('div', 'row', vit, '<span>REP</span><span id="repNum"></span>');
    const repBar = el('div', 'vBar', vit); this.repFill = el('i', '', repBar); this.repFill.style.background = '#ffb020';
    this.hpNum = vit.querySelector('#hpNum');
    this.arNum = vit.querySelector('#arNum');
    this.repNum = vit.querySelector('#repNum');

    const br = el('div', '', this.root);
    br.id = 'bottomRight';
    this.speedEl = el('div', '', br); this.speedEl.id = 'speed';
    this.vehEl = el('div', '', br); this.vehEl.id = 'vehName';
    const cb = el('div', '', br); cb.id = 'condBar'; this.condFill = el('i', '', cb);
    const nb = el('div', '', br); nb.id = 'nitroBar'; this.nitroFill = el('i', '', nb);
    this.radioEl = el('div', '', br); this.radioEl.id = 'radio';
    this.radioSongEl = el('div', '', br); this.radioSongEl.id = 'radioSong';

    this.dialogue = el('div', 'panel', this.root);
    this.dialogue.id = 'dialogue';
    this.dialogue.style.display = 'none';

    this.clockEl = el('div', '', this.root); this.clockEl.id = 'clock';
    this.bannerEl = el('div', '', this.root); this.bannerEl.id = 'banner';
    this.bannerBig = el('div', 'bBig', this.bannerEl);
    this.bannerSub = el('div', 'bSub', this.bannerEl);
    this.toastEl = el('div', '', this.root); this.toastEl.id = 'toast';

    this.overlay = null;
    this.onAction = null;
    this.bannerTimer = 0;
    this.toastTimer = 0;
    this.dialogueTimer = 0;
  }

  // ---- in-game panels -------------------------------------------------------
  setMission(index, total, title, stepText, stepNum, stepTotal, nextText) {
    this.mTitle.textContent = `MISSION ${index + 1} / ${total}: ${title}`;
    this.mObj.textContent = stepText;
    this.mNext.textContent = nextText || '';
    this.mBarFill.style.width = `${Math.round((stepNum / Math.max(1, stepTotal)) * 100)}%`;
  }

  setPolice(units) {
    const head = `<span>VBPD RESPONSE</span><span>${units.length} UNITS</span>`;
    const rows = units.map((u) => {
      const d = u.dist < 1000 ? `${Math.round(u.dist)} m` : `${(u.dist / 1000).toFixed(1)} km`;
      return `<div class="pRow"><span>${u.name}</span><span>${d}</span><span class="tac ${u.tactic}">${u.tactic}</span></div>`;
    }).join('');
    this.policePanel.innerHTML = `<div class="pHead">${head}</div>` + (rows || '<div class="pRow"><span>No units in pursuit</span></div>');
  }

  setWanted(stars) {
    let s = '';
    for (let i = 0; i < 5; i++) s += `<span class="${i < stars ? 'on' : 'off'}">★</span>`;
    this.starsEl.innerHTML = `WANTED ${s}`;
  }

  setMoney(n) { this.moneyEl.textContent = formatMoney(n); }

  setWeapons(currentSlot, ammo) {
    this.weaponsEl.innerHTML = WEAPONS.map((w, i) => {
      const a = ammo ? ammo[i] : w.ammo;
      const shown = a === Infinity ? '∞' : a;
      return `<div class="wslot ${w.slot === currentSlot ? 'sel' : ''}"><div class="k">${w.slot}</div><div>${w.name}</div><div class="a">${shown}</div></div>`;
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

  setDistrict(name, sub) {
    this.districtEl.textContent = name;
    this.districtSubEl.textContent = sub || '';
  }

  setRadio(station) {
    this.radioEl.textContent = `♪ ${station.name}`;
    this.radioSongEl.textContent = station.song;
  }

  setClock(text) { this.clockEl.textContent = text; }

  showDialogue(line) {
    const c = CREW[line.speaker] || { name: line.name, color: '#14e0c8', initials: line.initials || '?' };
    this.dialogue.innerHTML = `<div class="avatar" style="background:${c.color}">${c.initials}</div><div class="dBody"><div class="dName" style="color:${c.color}">${c.name} · ${c.role || ''}</div><div class="dText">${line.text}</div></div>`;
    this.dialogue.style.display = 'flex';
    this.dialogueTimer = 7;
  }

  hideDialogue() { this.dialogue.style.display = 'none'; this.dialogueTimer = 0; }

  banner(big, sub, seconds = 3.2) {
    this.bannerBig.textContent = big;
    this.bannerSub.textContent = sub || '';
    this.bannerEl.style.display = 'block';
    this.bannerTimer = seconds;
  }

  toast(text, seconds = 2) {
    this.toastEl.textContent = text;
    this.toastEl.style.display = 'block';
    this.toastTimer = seconds;
  }

  tick(dt) {
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) this.bannerEl.style.display = 'none';
    }
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toastEl.style.display = 'none';
    }
    if (this.dialogueTimer > 0) {
      this.dialogueTimer -= dt;
      if (this.dialogueTimer <= 0) this.hideDialogue();
    }
  }

  // ---- minimap ---------------------------------------------------------------
  drawMinimap(d) {
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
  clearOverlay() {
    if (this.overlay) { this.overlay.remove(); this.overlay = null; }
  }

  showTitle(save, onAction) {
    this.clearOverlay();
    const o = el('div', 'overlay', document.body);
    this.overlay = o;
    const card = el('div', 'card', o);
    el('div', 'gameTitle', card, 'VELA BAY<br><span>SUNSET HEIST</span>');
    el('div', 'gameSub', card, 'An open-world crime story on the bay');
    el('div', 'gameTag', card, 'Steal cars. Steal boats. Outrun the VBPD. Take the Vela GT and vanish across the water.');
    const crew = el('div', 'crewRow', card);
    for (const k of ['rex', 'mara', 'theo']) {
      const c = CREW[k];
      const chip = el('div', 'crewChip', crew);
      el('div', 'av', chip, c.initials).style.background = c.color;
      el('div', 'nm', chip, c.name);
      el('div', 'rl', chip, c.role);
    }
    const mkBtn = (label, cls, action) => {
      const b = el('button', `menuBtn ${cls || ''}`, card, label);
      b.addEventListener('click', () => onAction(action));
      return b;
    };
    if (save) mkBtn(`CONTINUE — MISSION ${save.mission + 1} · ${formatMoney(save.money)}`, '', 'continue');
    mkBtn('NEW GAME', save ? 'alt' : '', 'new');
    mkBtn('CONTROLS', 'ghost', 'controls');
    el('div', 'small', card, 'WASD drive / walk · Mouse drag camera · F enter or steal · Click shoot · 1–4 weapons · Q radio · Shift sprint · Space handbrake · N nitro · M mute · Esc pause');
    if (save) el('div', 'small', card, `Save found: mission ${save.mission + 1} of 8, rep ${Math.round(save.rep)}.`);
  }

  showControls(onBack) {
    this.clearOverlay();
    const o = el('div', 'overlay', document.body);
    this.overlay = o;
    const card = el('div', 'card', o);
    el('div', 'gameTitle', card, '<span>CONTROLS</span>');
    el('div', 'helpBox', card, `
      <b>W A S D</b> — walk / drive &nbsp;·&nbsp; <b>Mouse drag</b> — orbit camera &nbsp;·&nbsp; <b>Wheel</b> — zoom<br>
      <b>F</b> — enter / steal car or boat &nbsp;·&nbsp; <b>Click</b> — shoot &nbsp;·&nbsp; <b>1–4</b> — weapons<br>
      <b>Q</b> — next radio station &nbsp;·&nbsp; <b>Shift</b> — sprint &nbsp;·&nbsp; <b>Space</b> — handbrake drift<br>
      <b>N</b> — nitro &nbsp;·&nbsp; <b>M</b> — mute &nbsp;·&nbsp; <b>Esc</b> — pause<br><br>
      Steal the teal VELA GT from the Grand Casino in the final job. Boats live at the
      marina and the canal — the marine unit chases you on the water. Lose the cops
      (1 star or less) to finish a getaway job.`);
    const b = el('button', 'menuBtn', card, 'BACK');
    b.addEventListener('click', onBack);
  }

  showPause(onAction) {
    this.clearOverlay();
    const o = el('div', 'overlay', document.body);
    this.overlay = o;
    const card = el('div', 'card', o);
    el('div', 'gameTitle', card, 'PAUSED');
    const mkBtn = (label, cls, action) => {
      const b = el('button', `menuBtn ${cls || ''}`, card, label);
      b.addEventListener('click', () => onAction(action));
      return b;
    };
    mkBtn('RESUME', '', 'resume');
    mkBtn('RESTART MISSION', 'alt', 'restart');
    mkBtn('QUIT TO TITLE', 'ghost', 'quit');
  }

  showGameOver(kind, onAction) {
    this.clearOverlay();
    const o = el('div', 'overlay', document.body);
    this.overlay = o;
    const card = el('div', 'card', o);
    el('div', 'gameTitle', card, kind === 'busted' ? 'BUSTED' : 'WASTED');
    el('div', 'gameSub', card, kind === 'busted' ? 'The VBPD took you in. The crew posts your bail — the job goes on.' : 'You went down. The crew drags you out — the job goes on.');
    const mkBtn = (label, cls, action) => {
      const b = el('button', `menuBtn ${cls || ''}`, card, label);
      b.addEventListener('click', () => onAction(action));
      return b;
    };
    mkBtn('TRY AGAIN', '', 'retry');
    mkBtn('QUIT TO TITLE', 'ghost', 'quit');
  }

  showVictory(money, onAction) {
    this.clearOverlay();
    const o = el('div', 'overlay', document.body);
    this.overlay = o;
    const card = el('div', 'card', o);
    el('div', 'gameTitle', card, '<span>THE SUNSET HEIST</span><br>IS DONE');
    el('div', 'gameSub', card, `The Vela GT is across the bay. The crew is rich. ${formatMoney(money)} in the bag.`);
    el('div', 'gameTag', card, 'Thanks for playing Vela Bay — Sunset Heist. Free roam stays open: keep driving, keep stealing, keep outrunning the law.');
    const b = el('button', 'menuBtn', card, 'KEEP PLAYING (FREE ROAM)');
    b.addEventListener('click', () => onAction('freeroam'));
    const b2 = el('button', 'menuBtn alt', card, 'PLAY AGAIN');
    b2.addEventListener('click', () => onAction('new'));
  }
}
