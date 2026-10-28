'use strict';
/* AFK — a story about where the night goes. Sec 1 edition. */

/* ================= helpers ================= */
const $ = s => document.querySelector(s);
const wait = ms => new Promise(r => setTimeout(r, ms));
function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  if (attrs) for (const k in attrs) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k === 'cls') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'style') e.style.cssText = v;
    else e.setAttribute(k, v);
  }
  for (const k of kids.flat(9)) if (k != null && k !== false) e.append(k.nodeType ? k : document.createTextNode(String(k)));
  return e;
}
const N = s => String(s).replace(/\{N\}/g, S.name);
const START = 22 * 60 + 47, END = 25 * 60;
const at = (hh, mm) => hh * 60 + mm;
function fmt(t) { t = ((t % 1440) + 1440) % 1440; let hh = Math.floor(t / 60), mm = t % 60; const ap = hh >= 12 ? 'PM' : 'AM'; hh = hh % 12 || 12; return `${hh}:${String(mm).padStart(2, '0')} ${ap}`; }
const fmtS = t => fmt(t).replace(/ [AP]M$/, '');
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const QS = new URLSearchParams(location.search);
const TEST = QS.has('test');

/* ================= sound (off by default; classrooms have no earphones) ================= */
const A = {
  on: false, ctx: null, hum: null,
  init() { if (this.ctx) return; try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} },
  tone(f, d = .12, type = 'sine', v = .08, when = 0) {
    if (!this.on || !this.ctx) return; const c = this.ctx, t = c.currentTime + when;
    const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + d);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + d + .05);
  },
  thump(when = 0) {
    if (!this.on || !this.ctx) return; const c = this.ctx, t = c.currentTime + when;
    const len = c.sampleRate * .12, b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    const s = c.createBufferSource(); s.buffer = b; const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 260;
    const g = c.createGain(); g.gain.value = .9; s.connect(f).connect(g).connect(c.destination); s.start(t);
  },
  ping() { this.tone(1320, .12, 'sine', .06); this.tone(1760, .16, 'sine', .05, .09); },
  heart() { this.tone(880, .09, 'triangle', .05); this.tone(1175, .12, 'triangle', .04, .07); },
  knock() { this.thump(0); this.thump(.22); this.thump(.44); },
  hit() { this.tone(660 + Math.random() * 80, .07, 'triangle', .05); },
  miss() { this.tone(140, .12, 'sawtooth', .03); },
  win() { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, .3, 'triangle', .06, i * .1)); },
  lose() { [392, 330, 262].forEach((f, i) => this.tone(f, .35, 'triangle', .05, i * .14)); },
  say(t) { if (!this.on || !window.speechSynthesis) return; try { const u = new SpeechSynthesisUtterance(t); u.rate = .9; u.pitch = .6; u.volume = .8; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch (e) {} },
  setHum(on) {
    if (!this.ctx) return;
    if (on && this.on && !this.hum) {
      const c = this.ctx, len = c.sampleRate * 2, b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0); let last = 0;
      for (let i = 0; i < len; i++) { last = (last + .02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3; }
      const s = c.createBufferSource(); s.buffer = b; s.loop = true; const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 400;
      const g = c.createGain(); g.gain.value = .05; s.connect(f).connect(g).connect(c.destination); s.start(); this.hum = { s, g };
    } else if (!on && this.hum) { try { this.hum.s.stop(); } catch (e) {} this.hum = null; }
  },
  toggle() { this.init(); this.on = !this.on; if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); this.setHum(this.on && S.started); $('#sndBtn').textContent = this.on ? '🔊' : '🔇'; }
};

/* ================= state ================= */
const S = {
  started: false, ended: false, name: 'Sam', T: START,
  plan: { study: at(23, 30), sleep: at(24, 0), phone: 'next' },
  focus: 'room', view: 'desk', lamp: true, doing: 'staring at the revision package',
  mins: { study: 0, rift: 0, loop: 0, gram: 0, chat: 0, people: 0, other: 0 },
  solved: {}, correct: 0,
  rp: 60, youDiamond: false, matches: 0, wins: 0, inMatch: false, joined: null, limit: 0, toldLimit: false, offNicely: false, kept: false,
  brokeLimit: 0, lastSaid: 0, caved: 0, leftMatch: 0, riftDeleted: false, pressured: false, replaced: false,
  loopCards: 0, loopAuto: 0,
  gram: { opens: 0, checks: 0, stories: 0, posted: false, postAt: null, cap: '', likes: 0, likers: [], comments: [], weiSeen: false, hafStory: false, guildPost: false, mumLiked: false, compared: false },
  drawer: false, drawerOpens: 0, drawerBuzz: 0, putAway: 0, focusMode: false, focusUsed: false,
  buzzRoom: 0, quick: 0, pending: null,
  lastSeenT: START, jumps: 0, maxJump: 0, homeGap: 0,
  mum: { awake: true, pear: 'none', knockAt: 0, toldPlan: false, check: null },
  ryan: 'none', ryanRift: null,
  hafiz: { r1: null, r2: null, r3: null, seenInvite: false, promised: false, gone: false, here: false, wentDown: false, support: null, counsellor: false, knowsLeft: false, explained: false, helped: false, care: false, typedStop: false },
  hid: false, knock: null, readNote: false, read: {},
  log: {}, fired: new Set(), badges: { rift: 0, gram: 0 },
  battery: 41, endAt: null, reason: null
};
S.solvedN = () => Object.keys(S.solved).length;

/* ================= time + events ================= */
function setDoing(d) { S.doing = d; }
function clockVisible() { if (S.focus === 'room') return true; return !S.drawer && ['home', 'chats', 'thread'].includes(P.cur); }
function advance(m, cat, doing) {
  if (doing) setDoing(doing);
  for (let i = 0; i < m && !S.ended; i++) { S.T++; S.mins[cat]++; fireDue(); }
  if (!S.ended && S.T >= END) return endNight('time');
  if (clockVisible()) S.lastSeenT = S.T;
  drawClock();
}
/* the clock only shows in the room, on the home screen and in chats. come back after a while and it has jumped. */
function checkJump(where) {
  const gap = S.T - S.lastSeenT; S.lastSeenT = S.T;
  if (gap < 15 || !S.started || S.ended) return;
  S.jumps++; S.maxJump = Math.max(S.maxJump, gap);
  if (where === 'room') {
    const c = $('#rclock'); c.classList.remove('jump'); void c.offsetWidth; c.classList.add('jump'); setTimeout(() => c.classList.remove('jump'), 2600);
    roomHint(gap >= 60 ? `${fmt(S.T)}. More than an hour, gone. It felt like ten minutes.` : gap >= 30 ? `${fmt(S.T)}?! That was supposed to be a few minutes.` : `It’s ${fmt(S.T)}. That can’t be right.`);
  } else S.homeGap = gap;
}
function later(m, fn, id) { EV.push({ id: id || ('l' + Math.random()), at: S.T + m, run: fn }); }
const EV = [
  { id: 'g1', at: START + 1, log: 'Kai asked you to join ranked.', run() { deliver('guild', [['Kai', 'ranked push tonight 💎'], ['Kai', '40 RP to Diamond'], ['mei.exe', 'IN'], ['Dex', 'in'], ['nightowl', 'in'], ['Kai', '@{N} u in? need 5th']], () => setOpts('guild', gInvite())); } },
  { id: 'haf1', at: at(23, 0), log: 'Hafiz texted: “u awake?”', run: hAwake },
  { id: 'mumKnock', at: at(23, 3), log: 'Mum cut fruit and asked you to eat with her.', run() { S.mum.knockAt = S.T; knock('mum'); } },
  { id: 'g2', at: at(23, 8), when: () => S.joined == null && !S.riftDeleted, run() { deliver('guild', [['Kai', '@{N} hello??'], S.read.guild ? ['Kai', 'seen also never reply 🙄'] : ['Dex', 'waiting for u ah']], () => { if (S.joined == null) setOpts('guild', gInvite()); }); } },
  { id: 'mumLeave', at: at(23, 15), when: () => S.mum.pear === 'none', run() { S.mum.pear = 'table'; if (S.knock === 'mum') clearKnock(); roomHint('Mum’s footsteps go back to the kitchen. A chair scrapes. She’s eating alone.'); } },
  { id: 'ryanKnock', at: at(23, 17), log: 'Ryan knocked. He needed help with his fractions.', run() { knock('ryan'); } },
  { id: 'haf2', at: at(23, 20), log: 'Hafiz went down to the void deck. “home a bit loud tonight.”', run() { S.hafiz.here = true; gramStory({ id: 'haf', who: 'hafiz.j', img: IMG.void, cap: 'void deck again 🌙 light still flickering 💡' }); hInvite(); if (S.view === 'window') renderView(); } },
  { id: 'g3', at: at(23, 25), when: () => !S.riftDeleted && S.matches === 0 && S.joined !== 'yes', run() { S.replaced = true; deliver('guild', [{ sys: 'xX_dragon_Xx joined Night Shift' }, ['Kai', 'ok got a 5th 👍'], ['Kai', S.joined === 'no' ? 'dont need u le' : '@{N} u snooze u lose 🤷']], () => setOpts('guild', [{ t: 'gl guys 🙏', fn: () => deliver('guild', [['mei.exe', 'ty!! gl for WA1']]) }, { t: 'eh wait, can I still join?', fn: () => { S.joined = 'yes'; deliver('guild', [['Kai', 'ok fine. dragon u sit out 😂']]); } }])); } },
  { id: 'hafType', at: at(23, 28), when: () => !S.hafiz.r2 && !S.hafiz.wentDown, run() { S.hafiz.typedStop = true; const th = TH.hafiz; th.q = th.q.then(async () => { th.typing = 'Hafiz'; renderTh('hafiz'); await wait(4200); th.typing = null; renderTh('hafiz'); }); } },
  { id: 'ryanLeave', at: at(23, 29), when: () => S.ryan === 'none' || S.ryan === 'later', run() { S.ryanNoteAt = S.T; S.ryan = 'note'; if (S.knock === 'ryan') clearKnock(); roomHint('Something slides under your door. Paper.'); if (S.view === 'door') renderView(); } },
  { id: 'owl', at: at(23, 35), when: () => !S.riftDeleted, run() { deliver('guild', [['nightowl', 'brb the light here keeps flickering lol']]); } },
  { id: 'wei', at: at(23, 40), log: 'Wei Ling posted: “3 hrs done ✅ ready for WA1”.', run() { gramPost({ id: 'wei', who: 'weiling.studies', av: '#f59e0b', ini: 'W', em: '📚', bg: 'linear-gradient(135deg,#fde68a,#fbcfe8 55%,#c4b5fd)', cap: '3 hrs done ✅ ready for WA1. gn all 🙏', likes: 87 }); notify('gram', 'Unitygram', 'weiling.studies posted: 3 hrs done ✅ ready for WA1'); } },
  { id: 'kai4', at: at(23, 45), when: () => S.matches >= 1 && !S.offNicely && !S.riftDeleted, run() { deliver('guild', [['Kai', 'one more. last one. promise']]); } },
  { id: 'hide', at: at(23, 46), when: () => S.lamp && S.mum.awake && !S.hafiz.wentDown && (S.mins.rift + S.mins.loop + S.mins.gram >= 15), run() { roomHint('Mum is still up. If she sees the light under your door, she’ll knock.'); } },
  { id: 'haf3', at: at(23, 50), when: () => !S.hafiz.r2 && !S.hafiz.wentDown, run() {
    const lines = S.gram.hafStory ? ['saw u saw my story 👀', 'its ok if u busy'] : S.hafiz.seenInvite ? ['u seen already right 😅', 'its ok'] : ['u there?'];
    deliver('hafiz', lines, () => { if (!S.hafiz.r2) setOpts('hafiz', inviteOpts()); });
  } },
  { id: 'guildWin', at: at(23, 52), when: () => !S.youDiamond && !S.riftDeleted && (S.matches === 0 || S.offNicely), log: 'Night Shift hit Diamond without you.', run() {
    deliver('guild', [['Kai', 'DIAMOND 💎💎💎'], ['mei.exe', 'GG all 🐐'], ['Dex', 'finally']]);
    S.gram.guildPost = true;
    gramPost({ id: 'guild', who: 'kai.rift', av: '#7c3aed', ini: 'K', em: '💎', bg: 'linear-gradient(135deg,#312e81,#a21caf)', cap: 'DIAMOND 💎 night shift 🌙 GOAT-ed squad', tags: '@mei.exe @dex.r @nightowl' + (S.replaced ? ' @xX_dragon_Xx' : ''), likes: 41 });
    notify('gram', 'Unitygram', 'kai.rift posted: DIAMOND 💎 night shift 🌙');
  } },
  { id: 'haf4', at: at(24, 5), when: () => S.hafiz.promised && !S.hafiz.wentDown, run() { deliver('hafiz', ['u said coming down soon 😅', 'u still coming?'], () => setOpts('hafiz', [
    { t: 'coming! asking my mum', fn: () => { S.hafiz.r3 = 'coming'; deliver('hafiz', ['ok 👍']); roomHint('To go down, you’ll have to ask Mum. Go to the door.'); } },
    { t: 'sorry, can’t. next time?', fn: () => { S.hafiz.r3 = 'cant'; deliver('hafiz', ['ok ya. np']); } }])); } },
  { id: 'hafGone', at: at(24, 15), when: () => !S.hafiz.wentDown, log: 'Hafiz went home.', run() {
    S.hafiz.gone = true; S.hafiz.here = false; TH.hafiz.opts = null;
    deliver('hafiz', [S.hafiz.promised ? 'ok nvm. going up. gn' : 'ok going up. gn']);
    if (!S.riftDeleted) deliver('guild', [['nightowl', 'gtg. gn']]);
    if (S.view === 'window') renderView();
  } },
  { id: 'mumCheck', at: at(24, 18), when: () => S.mum.awake, log: 'Mum checked on you before bed.', run() { if (S.hafiz.wentDown) S.mum.check = 'away'; else if (S.lamp) { S.mum.check = 'light'; knock('mumcheck'); } else S.mum.check = 'dark'; } },
  { id: 'mumSleep', at: at(24, 20), run() { S.mum.awake = false; if (S.knock === 'mumcheck') clearKnock(); if (S.view === 'door') renderView(); } },
  { id: 'kai5', at: at(24, 30), when: () => !S.riftDeleted && !S.offNicely, run() { deliver('guild', [['Kai', 'anyone still up? 1 more 😤'], ['mei.exe', 'its 12.30 la']]); } },
];
function fireDue() {
  for (let i = 0; i < EV.length; i++) {
    const e = EV[i];
    if (S.fired.has(e.id) || S.T < e.at) continue;
    S.fired.add(e.id);
    if (e.when && !e.when()) continue;
    if (e.log) S.log[e.id] = { t: S.T, doing: S.doing };
    try { e.run(); } catch (err) { console.error(err); }
  }
  for (const k of ['study', 'sleep']) {
    const id = 'plan_' + k;
    if (!S.fired.has(id) && S.T >= S.plan[k]) {
      S.fired.add(id);
      roomHint(k === 'study' ? `${fmt(S.T)}. Your sticky note says: stop revising now. Questions done: ${S.solvedN()} of 4.` : `${fmt(S.T)}. Your sticky note says: lights out.`);
    }
  }
}

/* ================= layout + focus ================= */
let wide = true;
function layout() {
  wide = innerWidth >= 860 && innerWidth / innerHeight > 1.05;
  document.body.classList.toggle('wide', wide); document.body.classList.toggle('narrow', !wide);
  setFocus(S.focus, true); fitStage();
}
function setFocus(f, silent) {
  const now = performance.now();
  const changed = f !== S.focus; S.focus = f;
  $('#room').classList.toggle('unf', f !== 'room'); $('#phone').classList.toggle('unf', f !== 'phone');
  $('#room').classList.toggle('act', f === 'room'); $('#phone').classList.toggle('act', f === 'phone');
  document.querySelectorAll('#tabs button').forEach(b => { b.classList.toggle('on', b.dataset.t === f); if (b.dataset.t === f) b.classList.remove('dot'); });
  if (f === 'phone' && S.pending) { if (now - S.pending < 3000) S.quick++; S.pending = null; }
  if (changed && !silent && S.started) {
    if (f === 'room') {
      if (S.view === 'desk' && !S.inMatch) setDoing('in your room');
      checkJump('room');
      if (S.gram.weiSeen && !S.gram.compared) { S.gram.compared = true; roomHint(`Wei Ling did three hours. You’ve done ${plural(S.solvedN(), 'question')}.`); }
    }
    if (f === 'phone') { if (P.cur === 'loop') loopTick(); if (P.cur === 'rift') S.read.guild = true; if (P.cur === 'thread') readThread(P.thread); }
  }
  if (!wide) fitStage();
}
document.querySelectorAll('.veil').forEach(v => v.addEventListener('click', e => { e.stopPropagation(); setFocus(v.parentElement.id); }));
document.querySelectorAll('#tabs button').forEach(b => b.addEventListener('click', () => setFocus(b.dataset.t)));
$('#room').addEventListener('pointerdown', () => { if (S.focus !== 'room' && wide) setFocus('room'); }, true);
$('#phone').addEventListener('pointerdown', () => { if (S.focus !== 'phone') setFocus('phone'); }, true);
addEventListener('resize', layout);
['#room', '#phone', '#pscr'].forEach(s => $(s).addEventListener('scroll', e => { e.target.scrollLeft = 0; e.target.scrollTop = 0; }));
function tabDot(t) { if (S.focus !== t) document.querySelector(`#tabs button[data-t="${t}"]`).classList.add('dot'); }

/* ================= room ================= */
const IMG = { desk_on: 'img/desk_on.jpg', desk_off: 'img/desk_off.jpg', door: 'img/door.jpg', window: 'img/window.jpg', void: 'img/voiddeck.jpg', dining: 'img/dining.jpg', corridor: 'img/corridor.jpg', court: 'img/court.jpg', classroom: 'img/classroom.jpg' };
const AR = { desk: 1600 / 1194, door: 1600 / 893, window: 1600 / 893, void: 1600 / 893, dining: 1600 / 893, corridor: 1600 / 893 };
Object.values(IMG).forEach(src => { const i = new Image(); i.src = src; });
let curImg = 'A';
function setBg(src) {
  const a = $('#bgA'), b = $('#bgB'); const front = curImg === 'A' ? a : b, back = curImg === 'A' ? b : a;
  if (front.getAttribute('src') === src && front.style.opacity !== '0') return;
  back.src = src; back.style.opacity = 1; front.style.opacity = 0; curImg = curImg === 'A' ? 'B' : 'A';
}
function fitStage() {
  const r = $('#room').getBoundingClientRect(); if (!r.width) return;
  const ar = AR[S.view] || AR.desk, st = $('#stage');
  let w, hgt, x, y;
  if (wide || r.width / r.height > .9) { w = Math.max(r.width, r.height * ar); hgt = w / ar; x = (r.width - w) / 2; y = Math.min(0, (r.height - hgt) * .35); }
  else { w = r.width; hgt = w / ar; x = 0; y = 48; }
  Object.assign(st.style, { width: w + 'px', height: hgt + 'px', left: x + 'px', top: y + 'px' });
  $('#talk').style.top = wide ? '' : (y + hgt) + 'px';
}
const HOTS = [
  { id: 'study', label: 'Revision package', x: 44, y: 69 },
  { id: 'laptop', label: 'Laptop', x: 24, y: 53 },
  { id: 'lamp', label: 'Lamp', x: 17, y: 33 },
  { id: 'window', label: 'Window', x: 66, y: 20 },
  { id: 'bed', label: 'Bed', x: 38, y: 45 },
  { id: 'shirt', label: 'PE shirt', x: 79, y: 63 }
];
function renderView() {
  const v = S.view, ovl = $('#ovl'); ovl.innerHTML = ''; $('#hots').innerHTML = '';
  document.querySelectorAll('#rtop .nav button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
  if (v === 'desk') setBg(S.lamp ? IMG.desk_on : IMG.desk_off);
  if (v === 'door') {
    setBg(IMG.door);
    const dk = h('div', { cls: 'doordark' }); ovl.append(dk); if (!S.mum.awake) requestAnimationFrame(() => dk.style.opacity = 1);
    ovl.append(h('div', { cls: 'note' + (S.ryan === 'note' && !S.readNote ? ' on' : '') }));
  }
  if (v === 'window') { setBg(IMG.window); if (S.hafiz.here && !S.hafiz.gone) ovl.append(h('div', { cls: 'glow', style: 'left:47%;top:76%;width:7px;height:9px' })); }
  if (v === 'void') { setBg(IMG.void); ovl.append(h('div', { cls: 'glow', style: 'left:77.5%;top:73%' })); }
  if (v === 'dining') setBg(IMG.dining);
  if (v === 'corridor') setBg(IMG.corridor);
  fitStage();
  if (!R.busy) idleRoom();
}
document.querySelectorAll('#rtop .nav button').forEach(b => b.addEventListener('click', () => { if (R.busy || ['void', 'dining', 'corridor'].includes(S.view)) return; go(b.dataset.v); }));
function go(v) { S.view = v; if (v === 'door') $('#rtop .nav button[data-v="door"]').classList.remove('pulse'); setDoing(v === 'door' ? 'at your door' : v === 'window' ? 'looking out the window' : 'in your room'); renderView(); }

/* room talk: one conversation at a time */
const R = { busy: false };
function lineEl(txt, who, it) {
  const l = $('#line'); l.className = it ? 'it' : ''; l.innerHTML = '';
  if (who) l.append(h('span', { cls: 'who' }, who));
  l.append(N(txt)); l.style.animation = 'none'; void l.offsetWidth; l.style.animation = '';
  return l;
}
function waitTap() {
  return new Promise(res => {
    const l = $('#line'), more = h('span', { cls: 'more' }, '▸'); l.append(more);
    const done = () => { l.removeEventListener('click', done); removeEventListener('keydown', key); more.remove(); res(); };
    const key = e => { if ((e.key === ' ' || e.key === 'Enter') && S.focus === 'room' && $('#card').style.display !== 'block') { e.preventDefault(); done(); } };
    l.addEventListener('click', done); addEventListener('keydown', key);
  });
}
async function say(...lines) {
  for (const ln of lines) {
    if (S.ended) return;
    if (Array.isArray(ln)) lineEl(ln[1], ln[0]); else lineEl(ln, null, true);
    $('#chips').innerHTML = ''; await waitTap();
  }
}
function choose(opts) {
  return new Promise(res => {
    const c = $('#chips'); c.innerHTML = '';
    opts.forEach((o, i) => c.append(h('button', { cls: 'chip', style: `animation-delay:${i * 70}ms`, onclick: () => { c.innerHTML = ''; res(i); } }, N(o))));
  });
}
async function scene(fn) {
  if (R.busy) return; R.busy = true; $('#hots').innerHTML = '';
  try { await fn(); } finally { R.busy = false; if (!S.ended) { $('#chips').innerHTML = ''; renderView(); } }
}
let hintTxt = '';
function roomHint(t) { hintTxt = N(t); if (!R.busy) lineEl(hintTxt, null, true); tabDot('room'); }
function idleRoom() {
  $('#chips').innerHTML = ''; $('#hots').innerHTML = '';
  if (S.view === 'desk') {
    for (const hs of HOTS) $('#hots').append(h('button', { cls: 'hs' + (hs.id === 'study' && S.T < S.plan.study && S.solvedN() < 4 ? ' hot' : ''), style: `left:${hs.x}%;top:${hs.y}%`, onclick: () => deskAct(hs.id) }, hs.id === 'lamp' && !S.lamp ? 'Lamp (off)' : hs.label));
    lineEl(hintTxt || 'Your desk. The revision package is waiting.', null, true);
  }
  if (S.view === 'door') doorIdle();
  if (S.view === 'window') windowIdle();
}

/* ---------- desk ---------- */
function deskAct(id) {
  if (id === 'study') return openStudy();
  if (id === 'window') return go('window');
  if (id === 'laptop') return scene(async () => { await say('Your notes doc. You haven’t typed anything new since 9 PM.', 'The cursor blinks like it’s waiting for you.'); });
  if (id === 'shirt') return scene(async () => { await say('Your PE shirt from CCA today.', 'In the last ten seconds, Hafiz passed you the ball and you missed. He just laughed.', ['Hafiz', '“Next time lah.”']); });
  if (id === 'lamp') return scene(async () => {
    S.lamp = !S.lamp; renderView();
    if (!S.lamp && S.mum.awake && S.T >= at(23, 30) && S.mins.rift + S.mins.loop + S.mins.gram >= 10) { S.hid = true; await say('You switch off the lamp.', 'Now there’s no light under your door. If Mum walks past, she’ll think you’re asleep.'); }
    else await say(S.lamp ? 'Lamp on.' : 'You switch off the lamp. Just the laptop glow now.');
  });
  if (id === 'bed') return scene(async () => {
    await say(`${fmt(S.T)}. Your bed.`);
    const c = await choose(['Go to sleep. (This ends the night.)', 'Not yet.']);
    if (c === 0) { await say('You plug in your phone. You pull the blanket up.'); endNight('sleep'); }
  });
}

/* ---------- revising: G3 Math WA1, integers with powers and roots ---------- */
const QB = [
  { k: 'add', name: 'Adding & subtracting integers', q: '(−7) + 15 − (−4)', a: ['4', '12', '−4'], c: 1, why: 'Subtracting a negative is adding: 8 + 4 = 12.' },
  { k: 'pow', name: 'Powers & roots', q: '(−3)² − ∛(−8)', a: ['7', '−7', '11'], c: 2, why: '(−3)² = 9 and ∛(−8) = −2, so 9 − (−2) = 11.' },
  { k: 'mul', name: 'Multiplying & dividing integers', q: '(−24) ÷ (−6) × √25', a: ['20', '0.8', '−20'], c: 0, why: 'Negative ÷ negative is positive: 4 × 5 = 20.' },
  { k: 'mix', name: 'Mixed operations', q: '2³ − 4 × (−5) + √49', a: ['−13', '35', '−5'], c: 1, why: 'Multiply first: 8 − (−20) + 7 = 35.' }
];
function openStudy() {
  if (R.busy) return; R.busy = true; $('#hots').innerHTML = '';
  lineEl('G3 Math WA1 tomorrow. Four questions you should be able to do.', null, true);
  const card = $('#card'); card.style.display = 'block';
  const close = () => { card.style.display = 'none'; R.busy = false; renderView(); };
  const menu = () => {
    card.innerHTML = '';
    card.append(h('h3', {}, 'Revision package · G3 Math'));
    for (const q of QB) {
      const done = S.solved[q.k];
      card.append(h('button', { cls: 'topic', disabled: done ? '' : null, onclick: () => !done && ask(q) }, h('span', {}, q.name), h('small', {}, done ? 'done ✓' : '0/1')));
    }
    card.append(h('div', { cls: 'meta' }, `Each question takes about 8 minutes. It’s ${fmt(S.T)}.`));
    card.append(h('div', { cls: 'row' }, h('button', { cls: 'btn', onclick: close }, 'Close the package')));
  };
  const ask = q => {
    card.innerHTML = '';
    card.append(h('h3', {}, q.name), h('div', { cls: 'q' }, q.q));
    const opts = h('div', { cls: 'opts' }), fb = h('div', { cls: 'fb' });
    q.a.forEach((a, i) => opts.append(h('button', {
      cls: 'opt', onclick: () => {
        if (opts.dataset.done) return; opts.dataset.done = 1;
        const ok = i === q.c; opts.children[q.c].classList.add('ok'); if (!ok) opts.children[i].classList.add('no');
        S.solved[q.k] = ok ? 'right' : 'wrong'; if (ok) S.correct++;
        fb.textContent = ok ? 'Got it.' : `Not quite. ${q.why}`;
        advance(8, 'study', 'revising ' + q.name.toLowerCase());
        if (S.ended) return;
        card.append(h('div', { cls: 'row' }, S.solvedN() < 4 ? h('button', { cls: 'btn pri', onclick: menu }, 'Next question') : null, h('button', { cls: 'btn', onclick: close }, 'Stop for now')));
        if (S.solvedN() >= 4) fb.textContent += ' That’s all four.';
      }
    }, a)));
    card.append(opts, fb);
  };
  menu();
}

/* ---------- door ---------- */
function knock(who) {
  S.knock = who; A.knock();
  const t = $('#tag');
  t.textContent = who === 'ryan' ? '🚪 knock knock — “It’s Ryan…”' : who === 'mumcheck' ? N('🚪 “{N}? Still awake ah?”') : '🚪 knock knock — “It’s Mum.”';
  t.style.display = 'block'; t.onclick = () => { setFocus('room'); if (!R.busy) go('door'); };
  $('#rtop .nav button[data-v="door"]').classList.add('pulse'); tabDot('room');
  if (S.view === 'door' && !R.busy) renderView();
}
function clearKnock() { S.knock = null; $('#tag').style.display = 'none'; $('#rtop .nav button[data-v="door"]').classList.remove('pulse'); }
function ryanNoteText() {
  const sawPost = S.gram.posted && S.ryanNoteAt != null && S.gram.postAt <= S.ryanNoteAt;
  return sawPost ? '“Mummy showed me ur post. ‘grind mode’. but u said not now 😕 nvm I ask my friend. — R”' : '“Q3 how?? 😅 nvm I ask my friend. — R”';
}
function doorIdle() {
  const opts = [], acts = [];
  const add = (t, f) => { opts.push(t); acts.push(f); };
  if (S.knock === 'mum') { lineEl('“It’s Mum. I cut some fruit. Come out and eat a bit with me?”', 'Through the door'); add('Go out and eat with her (about 10 min)', mumOpen); add('“Later, Mum!”', mumLater); }
  else if (S.knock === 'ryan') { lineEl('“{N}? It’s Ryan. Can help me with my fractions? Due tomorrow.”', 'Through the door'); add('Open the door and help him (about 6 min)', ryanHelp); add('“Not now, Ryan.”', ryanLater); }
  else if (S.knock === 'mumcheck') { lineEl('“{N}? Still awake ah? Sleep already. WA1 tomorrow.”', 'Mum, through the door'); add('“Ok, Mum. Sleeping soon.”', () => scene(async () => { clearKnock(); S.mum.check = 'answered'; await say('Her footsteps go back down the corridor.'); })); }
  else {
    const bits = [S.mum.awake ? 'Your door. There’s still light in the corridor. Mum’s awake.' : 'Your door. The light under it is gone. Mum’s asleep.'];
    if (S.ryan === 'note' && !S.readNote) bits.push('There’s a folded piece of paper on the floor.');
    lineEl(bits.join(' '), null, true);
    if (S.ryan === 'note' && !S.readNote) add('Pick up the paper', () => scene(async () => { S.readNote = true; await say('Pencil. Ryan’s handwriting.', ['Note', ryanNoteText()]); }));
    if (S.mum.pear === 'table' || S.mum.pear === 'later') add('Go out to the dining table', () => scene(async () => {
      const warm = S.T - S.mum.knockAt > 25;
      S.view = 'dining'; renderView(); $('#hots').innerHTML = '';
      await say(warm ? 'The plate is still on the table, covered with a tissue. The watermelon has gone warm.' : 'Watermelon and papaya on the good plate. Mum’s chair is pushed in. She ate her half.', S.mum.awake ? 'Mum’s bedroom light is on. You can hear her phone playing a drama.' : 'The flat is dark except for the lamp over the table.');
      const c = await choose(['Eat it', 'Leave it']);
      if (c === 0) { S.mum.pear = warm ? 'warm' : 'late'; advance(3, 'people', 'eating fruit at the dining table'); await say(warm ? 'Still sweet. Mostly.' : 'Sweet. You eat it standing up.'); }
      S.view = 'door';
    }));
    if ((S.hafiz.seenInvite || S.hafiz.promised) && !S.hafiz.gone && !S.hafiz.wentDown && S.mum.awake) add('Ask Mum if you can go down to the void deck', askMum);
  }
  if (opts.length) { const c = $('#chips'); c.innerHTML = ''; opts.forEach((o, i) => c.append(h('button', { cls: 'chip', style: `animation-delay:${i * 70}ms`, onclick: () => acts[i]() }, N(o)))); }
}
function mumOpen() {
  scene(async () => {
    clearKnock(); S.mum.pear = 'ate'; S.view = 'dining'; renderView(); $('#hots').innerHTML = ''; setDoing('eating fruit with Mum');
    await say('Watermelon and papaya, on the good plate. Dinner’s still under the food cover. You said you’d eat later.', ['Mum', '“Eat. You never eat dinner properly.”'], 'The watermelon is cold and very sweet.',
      ['Mum', '“Ryan also stressed. P5 fractions. Every night he asks me. I also don’t know how to do.”'], ['Mum', '“WA1 tomorrow, right? Don’t sleep too late ah.”']);
    const c = await choose([`“Thanks, Mum. Lights out by ${fmt(S.plan.sleep)}.”`, '“Ya, ya. Ok.”']);
    if (c === 0) { S.mum.toldPlan = true; await say(['Mum', '“Ok. I’ll check.”'], 'She smiles like she will, actually.'); }
    else await say(['Mum', '“Hm.”'], 'She pushes the last slice of papaya towards you.');
    advance(10, 'people', 'eating fruit with Mum');
    S.view = 'desk';
  });
}
function mumLater() { scene(async () => { clearKnock(); S.mum.pear = 'later'; await say(['Mum', '“Ok. I leave it on the table. Eat before it gets warm.”'], 'Footsteps going back to the kitchen.'); }); }
function ryanHelp() {
  scene(async () => {
    clearKnock(); S.ryan = 'helped';
    await say('Ryan, P5, holding his worksheet like it bit him.', ['Ryan', '“2/3 + 1/4. I keep adding the bottom also.”'], 'You show him: make the bottoms the same first. Twelfths.', ['Ryan', '“Ohhh. 8/12 plus 3/12… 11/12!”'], ['Ryan', '“Eh, can I play Rift with you one day? Your guild sounds fun.”']);
    const c = await choose(['“When you’re older.”', '“Weekend. One game, with me.”']);
    S.ryanRift = c === 0 ? 'older' : 'weekend';
    await say(['Ryan', c === 0 ? '“Aiyah. Ok.”' : '“Deal!”'], 'He’s gone before you can say anything else.');
    advance(6, 'people', 'helping Ryan with his fractions');
  });
}
function ryanLater() { scene(async () => { S.ryan = 'later'; clearKnock(); await say(['Ryan', '“…ok.”'], 'Footsteps going back down the corridor.'); }); }
function askMum() {
  scene(async () => {
    await say('You knock on Mum’s door. She’s in bed, scrolling her phone. She puts it down.', ['Mum', `“Now? It’s ${fmt(S.T)}.”`]);
    const c = await choose(['“Hafiz is at the void deck alone. Something’s wrong at his home. Just 15 minutes?”', '“Never mind.”']);
    if (c === 1) return;
    await say('Mum looks at you for a long second.', ['Mum', '“…Ok. Fifteen minutes. Bring your phone. I’ll watch from the corridor.”']);
    await voidDeck();
  });
}

/* ---------- window ---------- */
function windowIdle() {
  let t;
  if (S.hafiz.here && !S.hafiz.gone) t = 'Down on the path by the void deck, a phone screen glows. Someone’s sitting alone. The light above them keeps flickering.';
  else if (S.hafiz.gone && S.T < at(24, 30)) t = 'The void deck is empty now. That one light is still flickering.';
  else if (S.T >= at(24, 30)) t = 'Even the blue windows are going dark. Yours is one of the last ones on.';
  else t = 'Block after block. Most windows are dark. A few glow blue: screens. Somebody else is also awake.';
  lineEl(t, null, true);
  if (S.hafiz.here && !S.hafiz.gone && S.hafiz.seenInvite) $('#chips').append(h('button', { cls: 'chip', onclick: () => scene(async () => { await say('Hafiz said the light at the void deck keeps flickering.', 'That’s him.'); }) }, 'Is that Hafiz?'));
}

/* ---------- void deck ---------- */
async function voidDeck() {
  S.hafiz.wentDown = true; TH.hafiz.opts = null;
  S.view = 'corridor'; renderView(); $('#hots').innerHTML = ''; setDoing('on the way down to the void deck');
  await say('You slip on your slippers. Mum stands at the door with her arms folded, watching you walk to the lift.');
  S.view = 'void'; renderView(); $('#hots').innerHTML = ''; setDoing('at the void deck with Hafiz');
  await say('The void deck is cooler than your room. The light over the chess table flickers, like he said.', 'Hafiz is on the far stool. His screen says RIFT. Player name: nightowl.', ['Hafiz', '“Eh. You actually came.”']);
  await choose(['“…You’re nightowl?”']);
  await say(['Hafiz', '“Ya lor. I say gg to you every night.”'], ['Hafiz', '“Home a bit loud tonight. My parents. Down here quieter.”']);
  const c = await choose(['“That sounds hard. I’m here.”', '“You should just go up and sleep.”', '“Want me to come down sometimes?”']);
  S.hafiz.support = ['listen', 'fix', 'offer'][c];
  await say(c === 0 ? ['Hafiz', '“Ya.” He doesn’t say anything else for a while. That’s ok.'] : c === 1 ? ['Hafiz', '“Ya, I know.” He doesn’t move.'] : ['Hafiz', '“Can. But you got WA1 tomorrow.” He’s smiling, though.']);
  const d = await choose(['“If it gets bad at home, the school counsellor is actually ok. I can go with you.”', '(Say nothing. Just sit.)']);
  if (d === 0) { S.hafiz.counsellor = true; await say(['Hafiz', '“…Ok. Maybe.”'], 'He puts his phone face-down on the table.'); }
  else await say('You don’t say anything. He puts his phone face-down on the table.');
  await say('You don’t fix anything. You just sit there. Neither of you picks up your phone.');
  advance(12, 'people', 'at the void deck with Hafiz');
  if (S.ended) return;
  await say(['Hafiz', '“Ok, go sleep lah. WA1 tomorrow.”'], ['You', '“You also.”'], ['Hafiz', '“Ya ya. …Thanks, {N}.”']);
  advance(2, 'people', 'walking back up');
  S.hafiz.here = false; S.hafiz.gone = true;
  S.view = 'desk'; renderView(); $('#hots').innerHTML = '';
  await say(`Back upstairs. ${fmt(S.T)}. Mum locks the door behind you.`, ['Mum', '“Ok. Sleep now.”']);
  hintTxt = 'Your bed is right there.';
}

/* ================= phone ================= */
const P = { cur: 'home', thread: null, loopTimer: null, loopIdx: 0 };
const pscr = () => $('#pscr');
const NOCLOCK = ['rift', 'loop', 'gram', 'match'];
function drawClock() {
  $('#rclock').textContent = fmt(S.T);
  $('#ptime').textContent = fmtS(S.T); $('#ptime').style.visibility = NOCLOCK.includes(P.cur) ? 'hidden' : 'visible';
  $('#homebar').style.visibility = ['home', 'drawer', 'match'].includes(P.cur) || S.drawer ? 'hidden' : 'visible';
  S.battery = Math.max(3, 41 - Math.floor(S.matches * 4 + S.loopCards * .6 + S.mins.gram * .15 + (S.T - START) / 12));
  $('#pbat').textContent = '🔋 ' + S.battery + '%';
  if (P.cur === 'home' && !S.drawer) { const b = document.querySelector('.home .big'); if (b) b.textContent = fmtS(S.T); }
}
function show(el) { pscr().innerHTML = ''; pscr().append(el); }
function openP(screen, arg) {
  if (S.drawer && screen !== 'drawer') return pDrawer();
  if (P.cur === 'loop' && screen !== 'loop') stopLoop();
  const from = P.cur; P.cur = screen;
  if (['home', 'chats', 'thread'].includes(screen) && NOCLOCK.includes(from)) checkJump('phone');
  if (screen === 'home') pHome();
  if (screen === 'rift') pRift();
  if (screen === 'loop') pLoop();
  if (screen === 'gram') pGram(from !== 'gram');
  if (screen === 'chats') pChats();
  if (screen === 'thread') pThread(arg);
  if (screen === 'drawer') pDrawer();
  drawClock();
}
function badge(n) { return n ? h('span', { cls: 'bd' }, n) : null; }
function chatsUnread() { return TH.hafiz.unread + TH.kai.unread; }
function pHome() {
  const appBtn = (ic, nm, bg, n, fn, extra = '') => h('button', { cls: 'app ' + extra, onclick: fn }, h('div', { cls: 'ic', style: `background:${bg}` }, ic), nm, badge(n));
  const gap = S.homeGap; S.homeGap = 0;
  const el = h('div', { cls: 'scr home' },
    h('div', { cls: 'big' + (gap ? ' jump' : '') }, fmtS(S.T)), h('div', { cls: 'dt' }, 'Wednesday'),
    h('div', { cls: 'gap' }, gap ? `${gap} minutes since you last saw the time` : ''),
    h('div', { cls: 'grid' },
      S.riftDeleted ? h('div', { cls: 'app gone' }, h('div', { cls: 'ic' }), ' ') : appBtn('⚔️', 'Rift', 'linear-gradient(135deg,#6d28d9,#db2777)', S.badges.rift + TH.guild.unread, () => openP('rift')),
      appBtn('∞', 'Loop', 'linear-gradient(135deg,#f43f5e,#f59e0b)', 0, () => openP('loop')),
      appBtn('📸', 'Unitygram', 'linear-gradient(135deg,#f59e0b,#e11d48 60%,#9f1239)', S.badges.gram, () => openP('gram')),
      appBtn('💬', 'Chats', 'linear-gradient(135deg,#22c55e,#0ea5e9)', chatsUnread(), () => openP('chats')),
      appBtn('🌙', 'Focus', S.focusMode ? 'linear-gradient(135deg,#334155,#6366f1)' : '#2a2c33', 0, () => { S.focusMode = !S.focusMode; if (S.focusMode) S.focusUsed = true; pHome(); }, S.focusMode ? 'on' : '')),
    h('div', { style: 'flex:1' }),
    h('div', { cls: 'fm' }, S.focusMode ? 'Focus is on. Games and feeds are silenced. People can still reach you.' : ''),
    h('button', { cls: 'away', onclick: () => { S.drawer = true; S.putAway++; openP('drawer'); setFocus('room'); setDoing('in your room'); } }, 'Put the phone in the drawer'));
  show(el);
}
function pDrawer() {
  P.cur = 'drawer';
  show(h('div', { cls: 'scr drawer' }, h('div', { cls: 'knob' }), h('p', {}, 'Your phone is in the drawer.'), h('div', { cls: 'bz', id: 'bz' }, S.drawerBuzz ? 'bzzt '.repeat(Math.min(S.drawerBuzz, 4)).trim() : ''),
    h('button', { onclick: () => { S.drawer = false; S.drawerOpens++; openP('home'); } }, 'Open the drawer')));
  drawClock();
}
const ICONS = { rift: ['⚔️', 'linear-gradient(135deg,#6d28d9,#db2777)'], chats: ['💬', 'linear-gradient(135deg,#22c55e,#0ea5e9)'], gram: ['📸', 'linear-gradient(135deg,#f59e0b,#e11d48 60%,#9f1239)'] };
let lastBanner = null;
function notify(app, title, text, open) {
  if (app === 'rift' && S.riftDeleted) return;
  if (app === 'gram') S.badges.gram++;
  const silenced = S.focusMode && (app === 'rift' || app === 'gram');
  refreshHome();
  if (S.drawer) { S.drawerBuzz++; const bz = $('#bz'); if (bz) bz.textContent = 'bzzt '.repeat(Math.min(S.drawerBuzz, 4)).trim(); if (S.focus === 'room') roomHint('Your phone buzzes inside the drawer.'); return; }
  if (silenced) return;
  A.ping(); tabDot('phone');
  const fd = S.plan.phone === 'facedown' && S.focus === 'room';
  const go2 = () => { setFocus('phone'); if (open) open(); else openP(app === 'chats' ? 'chats' : app); };
  // same source keeps updating one banner instead of stacking
  if (lastBanner && lastBanner.isConnected && lastBanner.dataset.k === title) {
    lastBanner.querySelector('.tx').textContent = N(text); lastBanner.onclick = () => { go2(); lastBanner.remove(); };
    clearTimeout(lastBanner._t); lastBanner._t = setTimeout(() => out(lastBanner), 4800);
  } else {
    const b = h('div', { cls: 'bn' + (fd ? ' blur' : ''), 'data-k': title },
      h('div', { cls: 'ic', style: `background:${ICONS[app][1]}` }, ICONS[app][0]),
      h('div', { style: 'flex:1;min-width:0' }, h('div', { cls: 't' }, h('b', {}, title), h('span', {}, 'now')), h('div', { cls: 'm tx' }, N(text))),
      h('button', { cls: 'bx', 'aria-label': 'Dismiss', onclick: e => { e.stopPropagation(); out(b); } }, '×'));
    b.onclick = () => { go2(); b.remove(); };
    const bn = $('#banner'); while (bn.children.length > 1) bn.firstChild.remove(); bn.append(b); lastBanner = b;
    b._t = setTimeout(() => out(b), 4800);
  }
  if (S.focus === 'room') { S.buzzRoom++; if (!S.pending) S.pending = performance.now(); }
  function out(b) { b.classList.add('out'); setTimeout(() => b.remove(), 320); }
}
function refreshHome() { if (P.cur === 'home' && !S.drawer) pHome(); else if (P.cur === 'chats') pChats(); }

/* ---------- chats: people type, pause, reply, and remember ---------- */
const TH = {
  hafiz: { name: 'Hafiz', av: '#16a34a', ini: 'H', msgs: [{ ts: 'Today 6:12 PM', f: 'l', t: 'gg today. next time u score' }, { f: 'r', t: 'next time 😤' }], unread: 0, opts: null, typing: null, q: Promise.resolve(), lastT: null, listed: true },
  kai: { name: 'Kai', av: '#7c3aed', ini: 'K', msgs: [{ ts: 'Yesterday', f: 'l', t: 'tmr ranked. dont be late' }, { f: 'r', t: 'ok' }], unread: 0, opts: null, typing: null, q: Promise.resolve(), lastT: null, listed: false },
  guild: { name: 'Night Shift', group: true, msgs: [{ w: 'mei.exe', t: 'gn yesterday guys' }, { w: 'Kai', t: 'tmr ranked. no excuses' }], unread: 0, opts: null, typing: null, q: Promise.resolve(), lastT: null }
};
function visibleTh(id) {
  if (S.focus !== 'phone' || S.drawer) return false;
  return id === 'guild' ? (P.cur === 'rift' && !S.inMatch) : (P.cur === 'thread' && P.thread === id);
}
function tsFor(th) { const show = th.lastT == null || S.T - th.lastT >= 3; th.lastT = S.T; return show ? fmt(S.T) : null; }
function markSeen(id) { const th = TH[id]; for (let i = th.msgs.length - 1; i >= 0; i--) { const m = th.msgs[i]; if (m.f === 'r' || m.me) { if (m.rc) m.rc = id === 'guild' ? 'Seen by 4' : 'Seen'; break; } if (m.f === 'l' || m.w) break; } }
function deliver(id, lines, after) {
  const th = TH[id];
  th.q = th.q.then(async () => {
    for (const ln of lines) {
      if (S.ended || ln == null) continue;
      if (ln.sys) { th.msgs.push({ sys: N(ln.sys) }); renderTh(id); await wait(300); continue; }
      const who = Array.isArray(ln) ? ln[0] : th.name, text = Array.isArray(ln) ? ln[1] : ln;
      markSeen(id); th.typing = who; renderTh(id);
      await wait(Math.min(2300, 650 + N(text).length * 30));
      th.typing = null;
      if (S.ended) return;
      if (id === 'guild') th.msgs.push({ w: who, t: text }); else th.msgs.push({ f: 'l', t: text, ts: tsFor(th) });
      if (id === 'kai') th.listed = true;
      if (!visibleTh(id)) {
        th.unread++;
        if (id === 'guild') { notify('rift', 'Night Shift', `${who}: ${N(text)}`); }
        else notify('chats', th.name, text, () => openP('thread', id));
      } else if (id !== 'guild') readThread(id);
      renderTh(id);
      await wait(250);
    }
    if (after && !S.ended) after();
  }).catch(e => console.error(e));
  return th.q;
}
function setOpts(id, opts) { TH[id].opts = opts; renderTh(id); }
function pick(id, i) {
  const th = TH[id], o = th.opts && th.opts[i]; if (!o) return;
  th.opts = null;
  if (o.silent) { if (o.fn) o.fn(); renderTh(id); return; }
  if (id === 'guild') th.msgs.push({ w: S.name, t: o.t, me: true, rc: 'Delivered' });
  else th.msgs.push({ f: 'r', t: o.t, rc: 'Delivered', ts: tsFor(th) });
  advance(1, 'chat', id === 'guild' ? 'in the Rift guild chat' : id === 'hafiz' ? 'texting Hafiz' : 'texting Kai');
  renderTh(id);
  setTimeout(() => { if (!S.ended && o.fn) o.fn(); }, 450);
}
function renderTh(id) { if (id === 'guild') { if (P.cur === 'rift') renderGuild(); } else if (P.cur === 'thread' && P.thread === id) renderThread(); }
function readThread(id) {
  TH[id].unread = 0; S.read[id] = S.T;
  if (id === 'hafiz' && S.fired.has('haf2')) S.hafiz.seenInvite = true;
}
function pChats() {
  P.cur = 'chats';
  const row = id => { const t = TH[id], last = [...t.msgs].reverse().find(m => !m.sys); return h('button', { cls: 'crow', onclick: () => openP('thread', id) }, h('div', { cls: 'av', style: `background:${t.av}` }, t.ini), h('div', { cls: 'mid' }, h('div', { cls: 'nm' }, t.name, h('small', {}, t.typing ? 'typing…' : '')), h('div', { cls: 'pv' }, (last.f === 'r' ? 'You: ' : '') + N(last.t))), t.unread ? h('div', { cls: 'dot' }) : null); };
  show(h('div', { cls: 'scr' }, h('div', { cls: 'hd' }, h('button', { cls: 'bk', onclick: () => openP('home') }, '‹'), h('div', { cls: 'tt' }, 'Chats')), h('div', { cls: 'body' }, row('hafiz'), TH.kai.listed ? row('kai') : null)));
}
function pThread(id) {
  P.cur = 'thread'; P.thread = id;
  if (S.focus === 'phone') readThread(id);
  setDoing(id === 'hafiz' ? 'texting Hafiz' : 'texting Kai');
  const t = TH[id];
  show(h('div', { cls: 'scr' }, h('div', { cls: 'hd' }, h('button', { cls: 'bk', onclick: () => openP('chats') }, '‹'), h('div', { cls: 'tt' }, t.name, h('small', { id: 'tsub' }, ''))), h('div', { cls: 'body', id: 'tbody' }), h('div', { cls: 'tray', id: 'ttray' })));
  renderThread();
}
function renderThread() {
  const id = P.thread, t = TH[id], b = $('#tbody'), tray = $('#ttray'); if (!b || !t) return;
  const th = h('div', { cls: 'th' });
  for (const m of t.msgs) {
    if (m.sys) { th.append(h('div', { cls: 'sys' }, m.sys)); continue; }
    if (m.ts) th.append(h('div', { cls: 'ts' }, m.ts));
    th.append(h('div', { cls: 'bu ' + m.f }, N(m.t)));
    if (m.rc) th.append(h('div', { cls: 'rcpt' }, m.rc));
  }
  if (t.typing) th.append(h('div', { cls: 'typing' }, h('i'), h('i'), h('i')));
  b.innerHTML = ''; b.append(th); b.scrollTop = 1e6;
  const sub = $('#tsub'); if (sub) sub.textContent = t.typing ? 'typing…' : (id === 'hafiz' && S.hafiz.here && !S.hafiz.gone ? 'online' : '');
  tray.innerHTML = '';
  if (!t.opts) { tray.append(h('div', { cls: 'fake' }, 'Message')); return; }
  t.opts.forEach((o, i) => tray.append(h('button', { cls: 'chip' + (o.silent ? ' dim' : ''), style: `animation-delay:${i * 70}ms`, onclick: () => pick(id, i) }, N(o.t))));
}

/* ---------- Hafiz ---------- */
function hAwake() {
  deliver('hafiz', ['u awake?'], () => setOpts('hafiz', [
    { t: 'ya. revising 😩', fn: () => { S.hafiz.r1 = 'rev'; deliver('hafiz', ['same 😩', 'WA1 tmr right', 'i dont get the minus minus part 💀'], () => setOpts('hafiz', [
      { t: 'minus a negative = plus. (−3) − (−8) = 5', fn: () => { S.hafiz.helped = true; deliver('hafiz', ['OHHH', 'ok that makes sense', 'thanks 🙏']); } },
      { t: 'same 💀', fn: () => deliver('hafiz', ['we die together 🫡']) }])); } },
    { t: 'ya, about to play ranked', fn: () => { S.hafiz.r1 = 'rift'; deliver('hafiz', ['ok gl 👍', '…me too probably']); } },
    { t: '(leave it on seen)', silent: true, fn: () => { S.hafiz.r1 = 'seen'; } }]));
}
function hInvite() {
  TH.hafiz.opts = null;
  deliver('hafiz', [S.hafiz.r1 === 'seen' ? 'eh u seen my msg 😅' : null, 'at the void deck now', 'home a bit loud tonight', 'the light here keep flickering. like horror movie 😂', 'come down if u want. or not lah'], () => setOpts('hafiz', inviteOpts()));
}
function inviteOpts() {
  const comingHint = () => roomHint('To go down, you’ll have to ask Mum. Go to the door.');
  return [
    { t: 'ok. coming down soon', fn: () => { S.hafiz.r2 = 'coming'; S.hafiz.promised = true; deliver('hafiz', ['ok 👍']); comingHint(); } },
    { t: 'u ok? what happened?', fn: () => { S.hafiz.r2 = 'care'; deliver('hafiz', ['nothing la', 'parents again', 'its ok one'], () => setOpts('hafiz', [
      { t: 'want me to come down?', fn: () => { S.hafiz.promised = true; deliver('hafiz', ['if u can. no stress']); comingHint(); } },
      { t: 'that sucks. here if u want to talk', fn: () => { S.hafiz.care = true; deliver('hafiz', ['ya. thanks']); } }])); } },
    { t: 'can’t, WA1 tmr', fn: () => { S.hafiz.r2 = 'cant'; deliver('hafiz', ['ya ok. gl 👍']); } },
    { t: 'lol', fn: () => { S.hafiz.r2 = 'lol'; deliver('hafiz', ['ya']); } }];
}

/* ---------- Kai, privately ---------- */
function kaiDecline() {
  deliver('kai', ['eh. serious?', 'we need u. come on man', 'u always like that one'], () => setOpts('kai', [
    { t: 'ya sorry. WA1 tmr', fn: () => deliver('kai', ['ok then we lose bc of u lor', 'we find someone else']) },
    { t: '(leave it on seen)', silent: true, fn: () => later(2, () => deliver('kai', ['seen also never reply 🙄'])) }]));
}
function kaiOff() {
  deliver('kai', ['u really going? 😐'], () => setOpts('kai', [
    { t: 'ya. WA1. gn', fn: () => deliver('kai', ['fine.']) },
    { t: '(leave it on seen)', silent: true }]));
}
function kaiLeft() {
  deliver('kai', ['what was that', 'we lost bc u left'], () => setOpts('kai', [
    { t: 'sorry, something came up', fn: () => deliver('kai', ['ok…']) },
    { t: '(leave it on seen)', silent: true }]));
}

/* ---------- Rift + the guild ---------- */
function gInvite() {
  return [
    { t: 'in. one game though, WA1 tmr', fn: () => { S.joined = 'yes'; S.limit = 1; S.toldLimit = true; deliver('guild', [['Kai', 'ok 1 game. LETS GO 💎']]); } },
    { t: 'in!', fn: () => { S.joined = 'yes'; deliver('guild', [['Kai', 'LETS GOOO 💎'], ['mei.exe', '🐐']]); } },
    { t: 'can’t tonight. WA1 tmr', fn: () => { S.joined = 'maybe'; S.pressured = true; deliver('guild', [['Kai', 'WA1 is integers only what'], ['Dex', 'u can do in ur sleep'], ['Kai', '15 min only. come on man']], () => setOpts('guild', [
      { t: 'ok fine. one.', fn: () => { S.joined = 'yes'; S.limit = 1; S.toldLimit = true; S.caved++; deliver('guild', [['Kai', 'thats the spirit 😤']]); } },
      { t: 'no really. gl guys 🙏', fn: () => { S.joined = 'no'; deliver('guild', [['mei.exe', 'fair. gl for WA1!'], ['nightowl', 'gl'], ['Kai', 'ok.']], () => later(2, kaiDecline)); } }])); } }];
}
function gAfterMatch(win, promoted) {
  const lines = win
    ? (promoted ? [['Kai', 'DIAMOND 💎💎💎'], ['mei.exe', '{N} GOAT-ed 🐐'], ['nightowl', 'gg'], ['Kai', 'ok now Diamond III tonight. who’s in']]
      : [['Kai', `GG!! ${Math.max(0, 100 - S.rp)} RP to Diamond`], ['mei.exe', '{N} GOAT-ed 🐐'], ['nightowl', 'gg'], ['Kai', 'ONE MORE']])
    : [['Kai', 'tilted. ONE MORE'], ['Dex', 'that one not our fault'], ['nightowl', 'gg']];
  if (S.toldLimit && S.matches >= S.limit) lines.push(['Kai', `u said “last one” right 😏`], ['Kai', S.youDiamond ? 'but Diamond III is right there…' : `but we’re ${Math.max(0, 100 - S.rp)} RP away…`]);
  deliver('guild', lines, () => setOpts('guild', S.toldLimit && S.matches >= S.limit ? [
    { t: 'ya. that’s it. gn 👋', fn: () => { S.offNicely = true; S.kept = !S.brokeLimit; deliver('guild', [['mei.exe', 'respect. gn!'], ['nightowl', 'gn. gl'], ['Kai', 'ok ok. gn 😤']]); } },
    { t: 'ok ok… one more', fn: () => { S.brokeLimit++; S.lastSaid++; S.limit = S.matches + 1; deliver('guild', [['Kai', 'THATS WHAT IM TALKING ABOUT']]); } }
  ] : [
    { t: 'one more!', fn: () => deliver('guild', [['Kai', '💎💎💎']]) },
    { t: 'last one, then I’m off. WA1 tmr', fn: () => { S.toldLimit = true; S.lastSaid++; S.limit = S.matches + 1; deliver('guild', [['mei.exe', 'respect'], ['Kai', 'ok ok last one']]); } },
    { t: 'I’m off. gn 👋', fn: () => deliver('guild', [['Kai', 'eh?? we’re so close'], ['Kai', 'don’t loser leh'], ['mei.exe', 'eh don’t say like that'], ['Kai', 'joking only 🙄'], ['Dex', 'come on man. 1 more']], () => setOpts('guild', [
      { t: 'ok fine. one more', fn: () => { S.caved++; deliver('guild', [['Kai', 'KNEW IT 😂']]); } },
      { t: 'no. gn 👋', fn: () => { S.offNicely = true; deliver('guild', [['mei.exe', 'gn!! gl tmr'], ['nightowl', 'gn. gl'], ['Kai', 'ok fine 😤']], () => later(1, kaiOff)); } }])) }]));
}
function rankInfo() {
  if (S.rp >= 100) return { name: S.rp >= 200 ? 'Diamond III' : 'Diamond IV', pct: S.rp % 100, note: S.rp >= 200 ? 'Next: Diamond II' : `${200 - S.rp} RP to Diamond III` };
  return { name: 'Gold I', pct: S.rp, note: `${100 - S.rp} RP to Diamond 💎` };
}
function pRift() {
  P.cur = 'rift'; S.badges.rift = 0; TH.guild.unread = 0; if (S.focus === 'phone') S.read.guild = true; setDoing('in the Rift lobby');
  const ri = rankInfo();
  show(h('div', { cls: 'scr rift' },
    h('button', { cls: 'hm', onclick: () => openP('home') }, '‹ Home'),
    h('button', { cls: 'menu', onclick: riftMenu, 'aria-label': 'Rift menu' }, '⋯'),
    h('div', { cls: 'logo' }, 'RIFT', h('small', {}, 'LANES · SEASON 9')),
    h('div', { cls: 'rank' }, h('div', { cls: 'r1' }, h('span', {}, 'Rank'), h('b', {}, ri.name)), h('div', { cls: 'bar' }, h('i', { style: `width:${ri.pct}%` })), h('div', { cls: 'r2' }, ri.note)),
    h('button', { cls: 'play', onclick: startMatch }, h('span', { id: 'playL' }, 'PLAY RANKED'), h('small', {}, 'about 20 minutes · Night Shift (5)')),
    h('div', { cls: 'gc', id: 'gc' }), h('div', { cls: 'tray', id: 'rtray', style: 'background:transparent;border:0' })));
  renderGuild();
}
function renderGuild() {
  const gc = $('#gc'); if (!gc) return;
  TH.guild.unread = 0; S.badges.rift = 0;
  gc.innerHTML = ''; gc.append(h('div', { cls: 'gh' }, 'Night Shift · guild chat'));
  for (const m of TH.guild.msgs.slice(-16)) {
    if (m.sys) { gc.append(h('div', { cls: 'sys' }, m.sys)); continue; }
    gc.append(h('div', { cls: 'gm' }, h('b', { cls: m.me ? 'me' : m.w === 'nightowl' ? 'owl' : '' }, m.me ? S.name : m.w), ': ', N(m.t)));
    if (m.rc) gc.append(h('div', { cls: 'tyl' }, m.rc));
  }
  if (TH.guild.typing) gc.append(h('div', { cls: 'tyl' }, `${TH.guild.typing} is typing…`));
  gc.scrollTop = 1e6;
  const tr = $('#rtray'); if (!tr) return; tr.innerHTML = '';
  (TH.guild.opts || []).forEach((o, i) => tr.append(h('button', { cls: 'chip', style: `animation-delay:${i * 70}ms`, onclick: () => pick('guild', i) }, N(o.t))));
  const pl = $('#playL'); if (pl) { const off = S.offNicely || S.joined === 'no'; pl.textContent = off ? 'PLAY ANYWAY' : 'PLAY RANKED'; pl.parentElement.classList.toggle('dim', off); }
}
function riftMenu() {
  const sh = h('div', { cls: 'sheet' }, h('h4', {}, 'Leave Night Shift and delete Rift?'), h('p', {}, 'Your 214-day login streak and your rank will be gone. Your guild won’t be told why.'),
    h('button', { cls: 'b red', onclick: () => { sh.remove(); deleteRift(); } }, 'Leave guild & delete'), h('button', { cls: 'b', onclick: () => sh.remove() }, 'Cancel'));
  document.querySelector('.scr.rift').append(sh);
}
function deleteRift() {
  S.riftDeleted = true; S.badges.rift = 0; TH.guild.opts = null; openP('home');
  roomHint('Gone. Just like that. Your thumb keeps going to where the icon used to be.');
  later(6, () => { if (S.hafiz.gone || S.hafiz.wentDown) return; S.hafiz.knowsLeft = true; deliver('hafiz', ['eh kai says u left night shift??', 'everything ok?'], () => setOpts('hafiz', [
    { t: 'ya. too much. need to focus', fn: () => { S.hafiz.explained = true; deliver('hafiz', ['ok fair', 'was nice playing w u tho']); } },
    { t: '(leave it on seen)', silent: true }])); });
}
/* the match: three lanes, keep the shards out. 22 real seconds, 20 minutes of night. */
function startMatch() {
  if (S.inMatch || S.ended) return;
  if (S.offNicely || S.joined === 'no') { S.brokeLimit++; S.offNicely = false; S.joined = 'yes'; TH.guild.msgs.push({ w: S.name, t: 'ok im back', me: true }); deliver('guild', [['Kai', 'KNEW IT 😂']]); }
  else if (S.toldLimit && S.matches >= S.limit) { S.brokeLimit++; S.limit = S.matches + 1; }
  if (S.joined == null || S.joined === 'maybe') S.joined = 'yes';
  TH.guild.opts = null;
  S.inMatch = true; P.cur = 'match'; setDoing('in a ranked match'); A.say('Match found'); drawClock();
  const scr = h('div', { cls: 'scr', style: 'background:#07060f' });
  const cv = h('canvas', { cls: 'match' });
  scr.append(cv, h('div', { cls: 'mhud' }, h('span', { id: 'mscore' }, 'SCORE 0'), h('span', { id: 'mtime' }, '0:22'), h('button', { onclick: () => leaveMatch() }, 'LEAVE')));
  show(scr);
  const ctx = cv.getContext('2d'); let W = 0, H = 0; const dpr = Math.min(2, devicePixelRatio || 1);
  const r0 = cv.getBoundingClientRect(); W = r0.width; H = r0.height; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const DUR = 22000, MIN = 20; let t0 = performance.now(), last = t0, spawnT = 0, shards = [], parts = [], hits = 0, total = 0, combo = 0, flash = [0, 0, 0], minsDone = 0, over = false, shake = 0;
  const lanes = 3, hitY = () => H - 90, preKnock = S.knock;
  const press = l => {
    if (over) return; flash[l] = 1;
    let best = null; for (const s of shards) if (s.l === l && !s.dead && Math.abs(s.y - hitY()) < 46) { if (!best || Math.abs(s.y - hitY()) < Math.abs(best.y - hitY())) best = s; }
    if (best) { best.dead = true; hits++; combo++; A.hit(); for (let i = 0; i < 12; i++) parts.push({ x: best.x, y: best.y, vx: (Math.random() - .5) * 6, vy: (Math.random() - .8) * 6, a: 1 }); }
    else { combo = 0; A.miss(); }
  };
  cv.addEventListener('pointerdown', e => { const r = cv.getBoundingClientRect(); press(Math.min(2, Math.floor((e.clientX - r.left) / (r.width / lanes)))); });
  const KEYS = { '1': 0, '2': 1, '3': 2, a: 0, s: 1, d: 2, j: 0, k: 1, l: 2, arrowleft: 0, arrowdown: 1, arrowright: 2 };
  const onKey = e => { if (S.focus !== 'phone') return; const k = KEYS[e.key.toLowerCase()]; if (k != null) { e.preventDefault(); press(k); } };
  addEventListener('keydown', onKey);
  const stop = () => { over = true; removeEventListener('keydown', onKey); };
  const toast = txt => { const t = h('div', { cls: 'mtoast' }, txt); scr.append(t); setTimeout(() => t.remove(), 3200); };
  function frame(now) {
    if (over) return;
    if (!cv.isConnected) return stop();
    const dt = Math.min(50, now - last); last = now; const el = now - t0;
    const should = Math.floor(el / DUR * MIN);
    while (minsDone < should && minsDone < MIN) { minsDone++; advance(1, 'rift', 'in a ranked match'); if (S.ended) return stop(); }
    if (S.knock && S.knock !== preKnock && !scr.dataset.k) { scr.dataset.k = 1; toast('🚪 Someone’s knocking.'); }
    spawnT -= dt; const rate = 620 - el / DUR * 260;
    if (spawnT <= 0 && el < DUR - 1200) { spawnT = rate * (.7 + Math.random() * .6); const l = Math.floor(Math.random() * 3); shards.push({ l, x: (l + .5) * W / lanes, y: -20, v: (.16 + el / DUR * .12) }); total++; }
    for (const s of shards) { s.y += s.v * dt; if (!s.dead && s.y > hitY() + 50) { s.dead = true; s.missed = true; combo = 0; shake = 6; } }
    shards = shards.filter(s => !(s.dead && !s.missed) && s.y < H + 40);
    ctx.save(); if (shake > 0) { ctx.translate((Math.random() - .5) * shake, (Math.random() - .5) * shake); shake *= .85; }
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#120a2a'); g.addColorStop(1, '#05040c'); ctx.fillStyle = g; ctx.fillRect(-10, -10, W + 20, H + 20);
    for (let l = 0; l < lanes; l++) {
      const x0 = l * W / lanes; ctx.fillStyle = `rgba(139,92,246,${.05 + flash[l] * .25})`; ctx.fillRect(x0 + 3, 0, W / lanes - 6, H); flash[l] *= .85;
      ctx.strokeStyle = 'rgba(196,181,253,.15)'; ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x0, H); ctx.stroke();
    }
    ctx.strokeStyle = '#f0abfc'; ctx.lineWidth = 2; ctx.shadowColor = '#f0abfc'; ctx.shadowBlur = 12; ctx.beginPath(); ctx.moveTo(0, hitY()); ctx.lineTo(W, hitY()); ctx.stroke(); ctx.shadowBlur = 0;
    for (const s of shards) { if (s.dead) continue; ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(Math.PI / 4); ctx.fillStyle = '#c4b5fd'; ctx.shadowColor = '#a78bfa'; ctx.shadowBlur = 16; ctx.fillRect(-13, -13, 26, 26); ctx.restore(); }
    for (const p of parts) { p.x += p.vx; p.y += p.vy; p.vy += .2; p.a *= .93; ctx.fillStyle = `rgba(240,171,252,${p.a})`; ctx.fillRect(p.x, p.y, 3, 3); }
    parts = parts.filter(p => p.a > .05);
    ctx.font = '600 12px ui-monospace,monospace'; ctx.fillStyle = 'rgba(203,188,255,.55)'; ctx.textAlign = 'center';
    ['1 / A', '2 / S', '3 / D'].forEach((k, l) => ctx.fillText(k, (l + .5) * W / lanes, hitY() + 34));
    if (combo >= 3) { ctx.font = '800 22px system-ui'; ctx.fillStyle = '#f0abfc'; ctx.fillText(`${combo} COMBO`, W / 2, H * .35); }
    ctx.restore();
    $('#mscore').textContent = 'SCORE ' + hits * 100; $('#mtime').textContent = '0:' + String(Math.max(0, Math.ceil((DUR - el) / 1000))).padStart(2, '0');
    if (el >= DUR) { stop(); while (minsDone < MIN && !S.ended) { minsDone++; advance(1, 'rift', 'in a ranked match'); } if (!S.ended) finishMatch(hits / Math.max(1, total)); return; }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  function leaveMatch() {
    const sh = h('div', { cls: 'sheet' }, h('h4', {}, 'Leave the match?'), h('p', {}, 'Your team plays 4 against 5. You lose 30 RP. Night Shift will see you left.'),
      h('button', { cls: 'b red', onclick: () => { stop(); S.inMatch = false; S.leftMatch++; S.rp = Math.max(0, S.rp - 30); S.matches++; openP('rift'); deliver('guild', [['Kai', '???'], ['mei.exe', 'eh u ok?'], ['nightowl', '?']], () => later(1, kaiLeft)); } }, 'Leave'),
      h('button', { cls: 'b', onclick: () => sh.remove() }, 'Keep playing'));
    scr.append(sh);
  }
}
function finishMatch(ratio) {
  S.inMatch = false; S.matches++;
  const win = ratio >= (S.matches === 1 ? .35 : .5);
  const wasDiamond = S.rp >= 100;
  if (win) { S.wins++; S.rp += 22; A.win(); A.say('Victory'); } else { S.rp = Math.max(0, S.rp - 9); A.lose(); A.say('Defeat'); }
  const promoted = !wasDiamond && S.rp >= 100;
  if (promoted) {
    S.youDiamond = true;
    gramPost({ id: 'guild', who: 'kai.rift', av: '#7c3aed', ini: 'K', em: '💎', bg: 'linear-gradient(135deg,#312e81,#a21caf)', cap: 'DIAMOND 💎 night shift 🌙 GOAT-ed squad', tags: '@mei.exe @dex.r @nightowl @{N} 🐐', likes: 41 });
    later(2, () => notify('gram', 'Unitygram', 'kai.rift tagged you in a post: DIAMOND 💎'));
  }
  const ri = rankInfo();
  pscr().querySelector('.scr').append(h('div', { cls: 'result' },
    h('h2', { style: `color:${win ? '#f0abfc' : '#94a3b8'}` }, win ? 'VICTORY' : 'DEFEAT'),
    h('div', { cls: 'rp' }, win ? '+22 RP' : '−9 RP'),
    h('div', { style: 'font-size:15px;margin-top:6px' }, promoted ? 'DIAMOND IV 💎 promoted!' : ri.note),
    h('div', { style: 'font-size:12px;color:#8b7fc4;margin-top:4px' }, `accuracy ${Math.round(ratio * 100)}%`),
    h('button', { cls: 'play', style: 'margin-top:16px;width:80%', onclick: () => openP('rift') }, 'CONTINUE')));
  gAfterMatch(win, promoted);
}

/* ---------- Loop: the feed that keeps playing ---------- */
const LOOP = [
  ['🐈', 'cat discovers the aircon for the first time', '@meowmeowsg', '48.2k'], ['📚', 'when the teacher says “this one confirm come out”', '@sec1survival', '112k'],
  ['🧋', 'ranking every bubble tea topping (i am correct)', '@bbtcritic', '23.9k'], ['🏃', 'the 7:12 am sprint when the bus is already at the stop', '@sgcommute', '88.1k'],
  ['🎮', 'your “last game” at 11 pm vs at 1 am', '@riftmemes', '201k'], ['🫓', 'ranking prata orders. egg is S tier. fight me', '@foodkakis', '31.4k'],
  ['😴', '5 study hacks you will save and never use', '@studygram.sg', '67k'], ['⌨️', 'satisfying: cleaning a keyboard for 60 seconds', '@satisfyingdaily', '1.2M'],
  ['☕', 'this uncle’s kopi pour is art', '@hawkerheroes', '402k'], ['🔋', 'nobody: · my phone at 2%:', '@relatable.sg', '56k'],
  ['🦆', 'duck chasing a cat chasing a duck', '@chaosanimals', '930k'], ['📝', 'the 5 stages of WA week', '@sec1survival', '74k'],
  ['🏀', 'he really tried to dunk at the void deck 💀', '@hoopssg', '19.8k'], ['🌧️', 'rain sounds + lofi to pretend to study to', '@lofisg', '12.1k'],
  ['👀', 'wait for it…', '@waitforit', '3.3M'], ['🍜', 'rating every cup noodle at the mama shop near my block', '@foodkakis', '45k'],
  ['🧠', 'how many seconds can you watch this without scrolling?', '@brainrot.daily', '780k'], ['🎧', 'POV: you put on one song and now it’s 1 am', '@relatable.sg', '98k'],
  ['🐢', 'tortoise eats a strawberry in slow motion', '@slowlife', '2.1M'], ['💡', 'why you can’t stop scrolling (watch till the end)', '@mindfacts', '150k'],
  ['🏫', 'P6 me vs Sec 1 me', '@sec1survival', '61k'], ['🧩', 'only 1% can find the hidden 6', '@puzzlr', '4.4M'],
  ['🛗', 'the HDB lift when you’re late', '@hdblife', '27k'], ['🍉', 'cutting fruit for your kid but make it ASMR', '@asmrhome', '310k']
];
const LCOL = [['#7c3aed', '#db2777'], ['#0f766e', '#22d3ee'], ['#b45309', '#f43f5e'], ['#1d4ed8', '#9333ea'], ['#15803d', '#a3e635'], ['#be123c', '#fb923c'], ['#334155', '#64748b']];
function nextLoopCard() {
  if (S.loopCards === 9) return ['⚔️', 'RIFT: LANES · Season 9 ends in 2 days. Don’t fall behind.', 'Sponsored', ''];
  const c = LOOP[P.loopIdx % LOOP.length]; P.loopIdx++; return c;
}
function pLoop() {
  P.cur = 'loop';
  const el = h('div', { cls: 'scr loop' }, h('div', { cls: 'lprog' }, h('i', { id: 'lpi' })), h('div', { cls: 'ltop' }, 'Loop'), h('button', { cls: 'lback', onclick: () => openP('home') }, 'Close'), h('div', { id: 'lst', style: 'position:absolute;inset:0' }), h('div', { cls: 'lhint' }, 'scroll, swipe or press ↓ for the next one'));
  show(el); loopCard(false);
  let y0 = null;
  el.addEventListener('wheel', e => { e.preventDefault(); if (Math.abs(e.deltaY) > 20 && !el.dataset.cool) { el.dataset.cool = 1; setTimeout(() => delete el.dataset.cool, 450); loopCard(false); } }, { passive: false });
  el.addEventListener('pointerdown', e => { y0 = e.clientY; });
  el.addEventListener('pointerup', e => { if (y0 != null && y0 - e.clientY > 40) loopCard(false); y0 = null; });
}
function loopCard(auto) {
  const st = $('#lst'); if (!st) return;
  const [em, cap, hd, likes] = nextLoopCard(), col = LCOL[S.loopCards % LCOL.length];
  S.loopCards++; if (auto) S.loopAuto++;
  st.innerHTML = '';
  st.append(h('div', { cls: 'lcard', style: `background:linear-gradient(160deg,${col[0]},${col[1]} 70%,#000)` }, h('div', { cls: 'em' }, em),
    h('div', { cls: 'side' }, h('div', {}, h('span', {}, '♡'), h('div', {}, likes || '')), h('div', {}, h('span', {}, '💬')), h('div', {}, h('span', {}, '↗'))),
    h('div', { cls: 'h' }, hd), h('div', { cls: 'c' }, cap)));
  advance(3, 'loop', `watching Loop (video #${S.loopCards})`);
  loopTick();
}
function loopTick() {
  clearInterval(P.loopTimer); if (P.cur !== 'loop' || S.ended) return;
  let p = 0; const pi = $('#lpi');
  P.loopTimer = setInterval(() => {
    if (P.cur !== 'loop' || S.ended) return clearInterval(P.loopTimer);
    if (S.focus !== 'phone') return; // it only plays while you watch
    p += 100 / 45; if (pi) pi.style.width = Math.min(100, p) + '%';
    if (p >= 100) { p = 0; loopCard(true); }
  }, 100);
}
function stopLoop() { clearInterval(P.loopTimer); }
addEventListener('keydown', e => {
  if (P.cur !== 'loop' || S.focus !== 'phone' || S.ended || e.repeat) return;
  if (e.key === 'ArrowDown' || e.key === 'PageDown') { e.preventDefault(); loopCard(false); }
});

/* ---------- Unitygram: post, check, compare ---------- */
const GR = {
  posts: [
    { id: 'kai0', who: 'kai.rift', av: '#7c3aed', ini: 'K', em: '⚔️', bg: 'linear-gradient(135deg,#4c1d95,#be185d)', cap: '40 RP to Diamond. tonight we cook 🔥', likes: 33, ago: '1h' },
    { id: 'arjun0', who: 'arjun.k', av: '#0ea5e9', ini: 'A', em: '🏀', bg: 'linear-gradient(135deg,#065f46,#0ea5e9)', cap: 'after CCA. 1MA3 represent', likes: 54, ago: '5h' },
    { id: 'mei0', who: 'mei.exe', av: '#db2777', ini: 'M', em: '🐈', bg: 'linear-gradient(135deg,#9d174d,#f59e0b)', cap: 'my cat has more aura than me', likes: 212, ago: '8h' }
  ],
  stories: [
    { id: 'mei', who: 'mei.exe', em: '🐈', bg: 'linear-gradient(160deg,#9d174d,#f59e0b)', cap: 'she sleeps like this every night', seen: false },
    { id: 'arjun', who: 'arjun.k', em: '🍜', bg: 'linear-gradient(160deg,#065f46,#0ea5e9)', cap: 'supper after CCA 🤤', seen: false }
  ],
  activity: []
};
const myHandle = () => (S.name.toLowerCase().replace(/[^a-z0-9]/g, '') || 'me') + '.sg';
function gramPost(p) { const i = GR.posts.findIndex(x => x.id === p.id); if (i >= 0) GR.posts.splice(i, 1); GR.posts.unshift(Object.assign({ ago: 'now', postedAt: S.T }, p)); if (P.cur === 'gram') renderGram(); }
function gramStory(s) { GR.stories.unshift(Object.assign({ seen: false }, s)); if (P.cur === 'gram') renderGram(); }
function pGram(opening) {
  P.cur = 'gram';
  if (opening) { S.gram.opens++; advance(2, 'gram', 'on Unitygram'); }
  setDoing('on Unitygram');
  show(h('div', { cls: 'scr gram' },
    h('div', { cls: 'top' }, h('span', { cls: 'lg' }, 'Unitygram'),
      h('button', { onclick: compose, 'aria-label': 'New post' }, '＋'),
      h('button', { onclick: activity, 'aria-label': 'Likes' }, '♡', S.badges.gram ? h('span', { cls: 'bd' }, S.badges.gram) : null),
      h('button', { onclick: () => openP('home'), style: 'font-size:14px' }, 'Close')),
    h('div', { cls: 'body', id: 'gbody' })));
  renderGram();
  let acc = 0, lastY = 0; const body = $('#gbody');
  body.addEventListener('scroll', () => { const d = Math.abs(body.scrollTop - lastY); lastY = body.scrollTop; acc += d; while (acc > 480) { acc -= 480; advance(2, 'gram', 'scrolling Unitygram'); } markGramSeen(); });
}
function markGramSeen() {
  const w = document.querySelector('.post[data-id="wei"]'), b = $('#gbody');
  if (w && b && !S.gram.weiSeen && S.focus === 'phone') { const r = w.getBoundingClientRect(), rb = b.getBoundingClientRect(); if (r.top < rb.bottom - 80) { S.gram.weiSeen = true; S.log.weiSeen = { t: S.T }; } }
}
function renderGram() {
  const body = $('#gbody'); if (!body) return; const keep = body.scrollTop;
  body.innerHTML = '';
  const st = h('div', { cls: 'stories' });
  GR.stories.forEach(s => st.append(h('button', { cls: 'st' + (s.seen ? ' seen' : ''), onclick: () => viewStory(s) }, h('div', { cls: 'ring' }, h('div', { style: s.img ? `background-image:url(${s.img})` : `background:${s.bg}` }, s.img ? '' : s.em)), h('span', {}, s.who))));
  body.append(st);
  for (const p of GR.posts) {
    const mine = p.id === 'me';
    const el = h('div', { cls: 'post', 'data-id': p.id },
      h('div', { cls: 'ph' }, h('div', { cls: 'av', style: `background:${mine ? '#9f1239' : p.av}` }, mine ? S.name[0].toUpperCase() : p.ini), mine ? myHandle() : p.who, h('small', {}, p.ago === 'now' ? fmtAgo(p.postedAt) : p.ago)),
      h('div', { cls: 'img', style: p.img ? `background-image:url(${p.img})` : `background:${p.bg}` }, p.img ? '' : p.em, mine ? h('div', { cls: 'cap2' }, p.cap) : null),
      h('div', { cls: 'act' }, '♡', '💬', '↗'),
      h('div', { cls: 'lk' }, `${mine ? S.gram.likes : p.likes + (p.id === 'wei' ? Math.floor((S.T - p.postedAt) * 1.4) : 0)} likes`),
      h('div', { cls: 'cp' }, h('b', {}, mine ? myHandle() : p.who), N(p.cap)),
      p.tags ? h('div', { cls: 'tg' }, N(p.tags)) : null,
      ...(mine ? S.gram.comments.slice(-2).map(c => h('div', { cls: 'cm' }, h('b', {}, c.w), c.t)) : []),
      mine ? h('button', { cls: 'mine', onclick: activity }, 'See who liked it') : null);
    body.append(el);
  }
  body.scrollTop = keep;
  requestAnimationFrame(markGramSeen);
}
function fmtAgo(t) { const d = S.T - t; return d < 1 ? 'now' : d < 60 ? `${d}m` : `${Math.floor(d / 60)}h`; }
function viewStory(s) {
  if (S.ended) return;
  s.seen = true; S.gram.stories++;
  advance(2, 'gram', `watching ${s.who}’s story`);
  if (s.id === 'haf') { S.gram.hafStory = true; S.log.hafStory = { t: S.T }; }
  const v = h('div', { cls: 'storyv' }, h('div', { cls: 'sbar' }, h('i')), h('div', { cls: 'who' }, h('span', {}, s.who), h('span', { style: 'color:#888;font-weight:400' }, s.id === 'haf' ? 'Seen by you' : '')),
    h('div', { cls: 'pic', style: s.img ? `background-image:url(${s.img})` : `background:${s.bg}` }, s.img ? null : h('div', { cls: 'em' }, s.em), N(s.cap)),
    h('div', { cls: 'rep' }, s.id === 'haf' ? h('button', { onclick: () => { v.remove(); openP('thread', 'hafiz'); } }, 'Reply to Hafiz') : null, h('button', { onclick: () => { v.remove(); renderGram(); } }, 'Close')));
  document.querySelector('.scr.gram').append(v);
  requestAnimationFrame(() => { const i = v.querySelector('.sbar i'); if (i) i.style.width = '100%'; });
}
function compose() {
  if (S.gram.posted) { const sc = document.querySelector('.scr.gram'); const sh = h('div', { cls: 'sheet' }, h('h4', {}, 'You already posted tonight'), h('p', {}, `${S.gram.likes} likes so far.`), h('button', { cls: 'b', onclick: () => { sh.remove(); activity(); } }, 'Check likes'), h('button', { cls: 'b', onclick: () => sh.remove() }, 'Close')); sc.append(sh); return; }
  const caps = ['G3 Math WA1 grind mode 📚', 'locked in. WA1 tmr 🔒', 'send help 😭 WA1 tmr'];
  const c = h('div', { cls: 'compose' },
    h('div', { cls: 'top', style: 'display:flex;justify-content:space-between;padding:10px 14px;font-weight:700' }, h('span', {}, 'New post'), h('button', { onclick: () => c.remove() }, 'Cancel')),
    h('div', { cls: 'pv', style: `background-image:url(${S.lamp ? IMG.desk_on : IMG.desk_off})` }),
    h('div', { cls: 'note3' }, 'Your desk, right now. Pick a caption:'),
    h('div', { cls: 'cps' }, ...caps.map(cp => h('button', { cls: 'chip', onclick: () => { c.remove(); doPost(cp); } }, cp))));
  document.querySelector('.scr.gram').append(c);
}
function doPost(cap) {
  S.gram.posted = true; S.gram.postAt = S.T + 5; S.gram.cap = cap; S.log.posted = { t: S.T + 5, doing: S.doing };
  advance(5, 'gram', 'posting on Unitygram');
  if (S.ended) return;
  gramPost({ id: 'me', img: S.lamp ? IMG.desk_on : IMG.desk_off, cap, likes: 0 });
  const wave = [[2, 5, 'arjun.k'], [5, 8, 'weiling.studies'], [9, 10, 'priya.t'], [14, 12, 'mei.exe'], [20, 14, 'dex.r'], [28, 16, 'arjun.k'], [38, 17, 'unity_1ma3'], [50, 18, 'jiayi.w'], [65, 19, 'priya.t']];
  wave.forEach(([dt, n, who]) => later(dt, () => { S.gram.likes += n; GR.activity.unshift({ w: who, t: `and ${n - 1} others liked your post` }); notify('gram', 'Unitygram', `❤️ ${who} and ${n - 1} others liked your post`); if (P.cur === 'gram') renderGram(); }));
  later(4, () => { if (S.hafiz.here && !S.hafiz.gone) { S.gram.likes++; GR.activity.unshift({ w: 'hafiz.j', t: 'liked your post' }); notify('gram', 'Unitygram', '❤️ hafiz.j liked your post'); } });
  later(9, () => { if (S.mum.awake) { S.gram.likes++; S.gram.mumLiked = true; S.log.mumLike = { t: S.T, doing: S.doing }; GR.activity.unshift({ w: 'Mum', t: 'liked your post ❤️' }); notify('gram', 'Unitygram', '❤️ Mum liked your post'); } });
  later(6, () => addComment('arjun.k', 'grind 🔥'));
  later(14, () => addComment('priya.t', 'pls share notes 🙏'));
  later(20, () => { if (!S.riftDeleted) addComment('kai.rift', S.joined === 'no' ? 'so this is why u never play 😏' : 'grind mode or ranked mode 😏'); });
}
function addComment(w, t) { S.gram.comments.push({ w, t }); GR.activity.unshift({ w, t: `commented: ${t}` }); notify('gram', 'Unitygram', `💬 ${w}: ${t}`); if (P.cur === 'gram') renderGram(); }
function activity() {
  if (S.ended) return;
  S.gram.checks++; S.badges.gram = 0;
  advance(4, 'gram', 'checking your likes');
  if (S.ended) return;
  const sc = document.querySelector('.scr.gram'); if (!sc) return;
  const v = h('div', { cls: 'compose actv' },
    h('div', { cls: 'top', style: 'display:flex;justify-content:space-between;padding:10px 14px;font-weight:700' }, h('span', {}, 'Activity'), h('button', { onclick: () => { v.remove(); renderGram(); } }, 'Done')),
    S.gram.posted ? h('div', { cls: 'big2' }, h('b', {}, `❤️ ${S.gram.likes}`), 'likes on your post') : h('div', { cls: 'big2' }, 'You haven’t posted anything tonight.'),
    h('div', { cls: 'body' }, ...GR.activity.slice(0, 12).map(a => h('div', { cls: 'row3' }, h('div', { cls: 'av', style: 'background:#3f3f46' }, a.w[0].toUpperCase()), h('div', {}, h('b', {}, a.w), ' ', a.t)))));
  sc.append(v);
}

/* ================= endings ================= */
const ENDS = { present: 'PRESENT', ontime: 'ON TIME', carried: 'CARRIED', ghost: 'GHOST', liked: 'LIKED', loggedoff: 'LOGGED OFF' };
const ENDKEYS = Object.keys(ENDS);
function store() { try { return JSON.parse(localStorage.getItem('afk.v2') || '{}'); } catch (e) { return {}; } }
function storeSet(o) { try { localStorage.setItem('afk.v2', JSON.stringify(Object.assign(store(), o))); } catch (e) {} }
function pickEnding() {
  const m = S.mins;
  if (S.hafiz.wentDown) return 'present';
  if (S.riftDeleted) return 'loggedoff';
  if ((m.gram >= 20 && m.gram >= m.loop && m.gram >= m.rift && m.gram >= m.study) || (S.gram.checks >= 5 && m.gram >= m.rift)) return 'liked';
  if (m.loop >= 25 && m.loop >= m.rift && m.loop >= m.study) return 'ghost';
  if (S.matches >= 3 || (S.matches >= 2 && m.rift > m.study)) return 'carried';
  if (S.endAt - START < 40 && S.reason === 'sleep') return 'ontime';
  if (S.solvedN() >= 3) return 'ontime';
  const [dom, dm] = [['study', m.study], ['rift', m.rift], ['loop', m.loop], ['gram', m.gram]].sort((a, b) => b[1] - a[1])[0];
  return dm >= 10 ? ({ rift: 'carried', loop: 'ghost', gram: 'liked' }[dom] || 'ontime') : 'ontime';
}
const cine = {
  el: $('#cine'), inn: $('#cine .in'), bg: $('#cine .bg'),
  open(bg, op = .28) { this.el.classList.add('on'); this.inn.innerHTML = ''; this.setBg(bg, op); },
  setBg(bg, op = .28) { this.bg.style.backgroundImage = bg ? `url(${bg})` : 'none'; this.bg.style.opacity = bg ? op : 0; },
  close() { this.el.classList.remove('on'); this.inn.innerHTML = ''; }
};
function cTap() {
  return new Promise(res => {
    const g = h('div', { cls: 'go' }, 'click to continue'); cine.inn.append(g);
    const done = () => { cine.el.removeEventListener('click', done); removeEventListener('keydown', key); g.remove(); res(); };
    const key = e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); done(); } };
    setTimeout(() => { cine.el.addEventListener('click', done); addEventListener('keydown', key); }, 350);
  });
}
async function cLines(lines) {
  for (const ln of lines) {
    if (!ln) continue;
    cine.inn.innerHTML = '';
    cine.inn.append(Array.isArray(ln) ? h('div', { cls: 'cl' }, h('span', { cls: 'who' }, N(ln[0])), N(ln[1])) : h('div', { cls: 'cl it' }, N(ln)));
    await cTap();
  }
}
function cChoose(prompt, opts) {
  return new Promise(res => {
    cine.inn.innerHTML = ''; if (prompt) cine.inn.append(h('div', { cls: 'cl' }, N(prompt)));
    const box = h('div', { cls: 'cchips' }); opts.forEach((o, i) => box.append(h('button', { cls: 'chip', style: `animation-delay:${i * 80}ms`, onclick: e => { e.stopPropagation(); res(i); } }, N(o))));
    cine.inn.append(box);
  });
}
async function endNight(reason) {
  if (S.ended) return; S.ended = true; S.reason = reason; S.endAt = S.T;
  stopLoop(); A.setHum(false);
  const k = pickEnding(); S.ending = k;
  const found = new Set(store().endings || []); found.add(k); storeSet({ endings: [...found], name: S.name });
  await wait(300);
  if (reason === 'time') { cine.open(IMG.desk_off, .25); await cLines(['1:00 AM.', 'Your phone slides out of your hand and lands on your face.', 'That’s the end of the night, whether you chose it or not.']); }
  else cine.open(null);
  await endingScene(k);
  await morning(k);
  await otherSide();
  await owlReveal(k);
  await exchange();
  await mirror();
  await smallChange();
  finale(k, found);
}
async function endingScene(k) {
  const n = S.solvedN(), endT = fmt(S.endAt);
  if (k === 'carried') { cine.setBg(IMG.desk_off, .3); await cLines([S.youDiamond ? 'DIAMOND. 💎' : `${plural(S.matches, 'match')}. ${S.wins} won.`, 'The guild chat is all caps. “GOAT-ed.” For a second it feels really, really good.', 'Then the screen goes dark, and the room is very quiet.', `It’s ${endT}. The revision package is open to the same page it was on at 10:47.`]); }
  if (k === 'ghost') { cine.setBg(IMG.window, .3); await cLines(['You don’t remember deciding to watch any of it.', `${S.loopCards} videos. You could name maybe three.`, 'Outside, the last blue windows have gone dark.', `Yours hasn’t. It’s ${endT}.`]); }
  if (k === 'liked') {
    cine.setBg(IMG.desk_off, .3);
    await cLines(S.gram.posted ? [`Your post has ${S.gram.likes} likes.`, `You checked it ${plural(S.gram.checks, 'time')}.`, S.gram.weiSeen ? 'Wei Ling’s has more. You checked that too.' : 'Every time it buzzed, you went back.', 'The revision package hasn’t moved.']
      : [`${plural(S.gram.stories, 'story')}. ${plural(S.gram.opens, 'visit')} to Unitygram.`, 'Everyone else’s night looked better than yours.', 'The revision package hasn’t moved.']);
  }
  if (k === 'ontime') {
    cine.setBg(IMG.desk_off, .3);
    const early = S.plan.sleep - S.endAt > 45, onT = S.endAt <= S.plan.sleep;
    await cLines([`Lights out at ${endT}. ${early ? 'Way before your plan. You just… stopped.' : onT ? 'Right on your plan.' : `Your plan said ${fmt(S.plan.sleep)}.`}`, `${n} of 4 questions done.${n >= 3 ? ' It feels good. It should.' : n === 0 ? ' The revision package stays open on the desk.' : ''}`,
      S.hafiz.gone ? 'One last buzz from the desk. Hafiz: “ok going up. gn”' : 'Your phone lights up once on the desk. Hafiz.', 'You don’t check it.']);
  }
  if (k === 'loggedoff') { cine.setBg(IMG.desk_off, .25); await cLines(['No Rift. No guild. No noise.', 'You lie in the dark, and the quiet doesn’t feel like rest. Your thumb keeps going to where the icon used to be.', S.loopCards + S.gram.opens > 4 ? 'So you opened something else instead. Just for a bit.' : 'You stare at the ceiling for a long time.', S.hafiz.explained ? 'At least one person knew why.' : 'Nobody knows why you left.']); }
  if (k === 'present') { cine.setBg(IMG.void, .3); await cLines([`You didn’t finish the revision package. ${n ? `${n} of 4.` : ''}`, S.youDiamond ? 'You did hit Diamond, somehow.' : 'You didn’t hit Diamond.', 'From your window you watch Hafiz walk back to his block. He looks up and waves.', 'You wave back.', S.riftDeleted ? 'Later he texts: “so who’s going to say gg to me at 1am now”' : null]); }
  const endline = { present: 'You were there.', ontime: 'Everything on the list got done. One thing wasn’t on the list.', carried: 'Everyone online had a great night.', ghost: 'The night didn’t go anywhere. It just went.', loggedoff: 'Stopping took guts. But nothing filled the space.',
    liked: S.gram.posted ? `${S.gram.likes} people saw your night. None of them were in it.` : 'You saw everyone’s night. Nobody was in yours.' }[k];
  cine.inn.innerHTML = ''; cine.setBg(null);
  cine.inn.append(h('div', { cls: 'endttl' }, 'ENDING'), h('div', { cls: 'endname' }, ENDS[k]), h('div', { cls: 'endline' }, endline));
  await cTap();
}
async function morning(k) {
  const lines = {
    carried: ['Third period. G3 Math WA1.', 'Question 1: (−7) + 15 − (−4). You read it three times. The minus signs keep swimming.'],
    ghost: ['Third period. G3 Math WA1.', 'You’re not tired, exactly. Just… somewhere else. You can’t remember what you watched. Or what you revised.'],
    liked: ['Third period. G3 Math WA1.', 'Question 1: (−7) + 15 − (−4). You know this one.', 'But your mind is on the comments you haven’t replied to.'],
    ontime: ['Third period. G3 Math WA1.', 'Question 1: (−7) + 15 − (−4). You know this one.', 'At recess, Hafiz is quieter than usual. He says he’s fine.'],
    loggedoff: ['Recess. Kai finds you at the canteen.', ['Kai', '“Eh. You just left the guild? Without saying anything?”'], 'You don’t know how to answer that.'],
    present: ['Third period. G3 Math WA1.', 'Question 1: (−7) + 15 − (−4). Not perfect. Enough.', 'At recess, Hafiz steals one of your fries and says “gg” out loud. In real life. For the first time.']
  }[k];
  cine.setBg(IMG.classroom, .3); cine.inn.innerHTML = ''; cine.inn.append(h('div', { cls: 'endttl' }, 'THURSDAY')); await wait(900);
  await cLines(lines);
  const court = {
    carried: ['4:30 PM. CCA.', 'You’re so tired you miss three easy shots in a row.', 'Hafiz says “gg” under his breath. You don’t know why that stings.'],
    ghost: ['4:30 PM. CCA.', 'Between drills, you check your phone. Then again. Then again.', 'Hafiz passes you the ball. You’re looking at your screen. It rolls past you.'],
    liked: ['4:30 PM. CCA.', 'Someone says they saw your post. “Grind mode ah?”', 'You laugh. You didn’t grind.'],
    ontime: ['4:30 PM. CCA.', 'Hafiz isn’t here today. Coach says he’s “not feeling well”.', 'You text him: “u ok?” He takes a long time to reply.'],
    loggedoff: ['4:30 PM. CCA.', 'Hafiz asks: “Why you leave the guild?”', S.hafiz.explained ? '“Told you. Too much.” He nods. “Ok. Still can play in real life what.”' : 'You open your mouth. Nothing good comes out.'],
    present: ['4:30 PM. CCA.', 'Last ten seconds. Hafiz passes you the ball.', 'You score.', ['Hafiz', '“See? Next time came.”']]
  }[k];
  cine.setBg(IMG.court, .3); cine.inn.innerHTML = ''; await wait(700);
  await cLines(court);
  cine.setBg(null);
}
async function otherSide() {
  const L = S.log, items = [];
  const add = (id, what, out) => { if (L[id]) items.push({ t: L[id].t, what, you: L[id].doing ? `You were ${L[id].doing}.` : '', out }); };
  add('g1', 'Kai asked you to join ranked.', S.joined === 'no' ? 'You said no, and held it.' : S.matches ? `You played ${plural(S.matches, 'match')}.` : 'You never answered.');
  add('haf1', 'Hafiz texted: “u awake?”', S.hafiz.r1 === 'seen' ? 'You left it on seen.' : S.hafiz.r1 ? 'You replied.' : 'You didn’t reply.');
  add('mumKnock', 'Mum cut watermelon and papaya and asked you to eat with her.', { ate: 'You sat with her.', later: 'You said “later”. She ate her half alone.', late: 'You ate it later, by yourself.', warm: 'You found it much later. It had gone warm.', table: 'She waited at the table, then ate alone.' }[S.mum.pear] || '');
  add('ryanKnock', 'Ryan needed help with his fractions.', S.ryan === 'helped' ? 'You helped him. Six minutes.' : 'He slid a note under your door and asked a friend instead.');
  add('haf2', 'Hafiz went down to the void deck. “home a bit loud tonight.”', S.hafiz.wentDown ? 'You went down.' : S.hafiz.r2 === 'care' ? 'You asked if he was ok.' : S.hafiz.r2 ? 'You replied.' : S.hafiz.seenInvite ? 'You read it.' : 'You never opened it.');
  if (L.hafStory) items.push({ t: L.hafStory.t, what: 'You watched Hafiz’s story from the void deck.', you: '', out: S.hafiz.r2 || S.hafiz.wentDown ? 'He saw that you watched it.' : 'He saw that you watched it. You didn’t reply.' });
  if (L.posted) items.push({ t: L.posted.t, what: `You posted: “${S.gram.cap}”`, you: '', out: S.ryan !== 'helped' && S.ryanNoteAt && S.gram.postAt <= S.ryanNoteAt ? 'Ryan saw it on Mum’s phone.' : '' });
  if (L.mumLike) items.push({ t: L.mumLike.t, what: 'Mum liked your post. She was in bed.', you: '', out: ['later', 'table'].includes(S.mum.pear) ? 'Earlier, you’d told her “later”.' : '' });
  add('wei', 'Wei Ling posted: “3 hrs done ✅ ready for WA1”.', S.gram.weiSeen ? 'You saw it.' : '');
  add('guildWin', 'Night Shift hit Diamond without you.', S.replaced ? 'Someone else took your slot.' : '');
  add('hafGone', 'Hafiz went home.', S.hafiz.promised ? 'You’d said you were coming.' : '');
  add('mumCheck', 'Mum checked on you before bed.', S.mum.check === 'dark' ? 'Your lamp was off. She went to bed thinking you were asleep.' : S.mum.check === 'away' ? 'You were at the void deck, and she was watching from the corridor.' : 'She saw the light under your door and told you to sleep.');
  if (!items.length) return;
  items.sort((a, b) => a.t - b.t);
  cine.inn.innerHTML = '';
  const tl = h('div', { cls: 'tl' });
  cine.inn.append(h('div', { cls: 'endttl' }, 'THE NIGHT, FROM THE OTHER SIDE'), tl);
  items.forEach((it, i) => tl.append(h('div', { cls: 'it', style: `animation-delay:${i * 400}ms` }, h('div', { cls: 'tm' }, fmt(it.t)), h('div', { cls: 'wh' }, it.what), h('div', { cls: 'yo' }, it.you ? h('b', {}, it.you) : null, ' ', it.out))));
  await wait(items.length * 400); await cTap();
}
async function owlReveal(k) {
  if (k === 'present') return cLines(['nightowl was Hafiz.', 'You found out because you showed up.']);
  const line = {
    carried: S.matches ? 'You were in the same matches. You were with him all night. Just not there.' : 'He was online all night. So were you.',
    ghost: `He messaged you ${plural(TH.hafiz.msgs.filter(m => m.f === 'l').length - 1, 'time')} tonight. You were watching strangers.`,
    liked: `He posted one story tonight, from the void deck. ${S.gram.hafStory ? 'You saw it. He saw you see it.' : 'You never saw it.'}`,
    ontime: 'You did everything right. He sat there anyway.',
    loggedoff: 'When you left the guild, one of the people you left was him.'
  }[k];
  await cLines(['nightowl was Hafiz.', `He was at the void deck below your window from 11:20 PM to ${S.hafiz.gone ? '12:15 AM' : 'late'}, playing Rift because it was quieter than home.`, line]);
}
/* the exchange rate: time on the phone was never the same as time in the room */
async function exchange() {
  const m = S.mins;
  cine.inn.innerHTML = '';
  const box = h('div', { cls: 'mirror' }, h('h2', {}, 'What things cost tonight'), h('div', { cls: 'note2' }, 'IN MINUTES OF YOUR NIGHT'));
  const rate = (name, cost, you, sub) => box.append(h('div', { cls: 'rate' }, h('span', {}, h('b', { style: 'font-family:inherit;color:#ecebe8;font-weight:600' }, name), ' · ', cost), h('b', {}, you), sub ? h('small', {}, sub) : null));
  rate('Revising', '1 question = 8 min', `${m.study} min`, `${plural(S.solvedN(), 'question')}.`);
  if (S.loopCards) rate('Loop', '1 swipe = 3 min', `${m.loop} min`, `${plural(S.loopCards, 'video')}${S.loopAuto ? `, ${S.loopAuto} of them played on their own` : ''}.`);
  if (m.gram) rate('Unitygram', 'open 2 · story 2 · check likes 4 · post 5', `${m.gram} min`, `You checked your likes ${plural(S.gram.checks, 'time')}.`);
  if (S.matches) rate('Rift', '1 match = 20 min', `${m.rift} min`, `${plural(S.matches, 'match')}. Each one took about 22 seconds of your real time.`);
  if (m.chat) rate('Texting', '1 reply = 1 min', `${m.chat} min`);
  if (m.people) rate('People, in person', '', `${m.people} min`);
  box.append(h('div', { cls: 'stat' }, 'One swipe here stands for a few minutes of videos, because nobody watches just one.', h('small', {}, 'Phone time and room time were never the same speed. That’s not the game being unfair. That’s what it feels like.')));
  if (S.jumps) box.append(h('div', { cls: 'stat' }, `${S.jumps === 1 ? 'Once' : `${S.jumps} times`}, you looked up and the clock had jumped 15 minutes or more.`, h('small', {}, `The biggest jump: ${S.maxJump} minutes.`)));
  cine.inn.append(box);
  await cTap();
}
async function mirror() {
  const m = S.mins, tot = Math.max(1, S.endAt - START);
  const cats = [['study', 'Revising', 'var(--lamp)'], ['rift', 'Rift', 'var(--rift)'], ['loop', 'Loop', 'var(--loop)'], ['gram', 'Unitygram', 'var(--gram)'], ['chat', 'Texting', 'var(--chat)'], ['people', 'People, in person', 'var(--ppl)']];
  const other = tot - cats.reduce((a, c) => a + m[c[0]], 0);
  cine.inn.innerHTML = '';
  const box = h('div', { cls: 'mirror' });
  box.append(h('h2', {}, 'Where your night went'), h('div', { cls: 'note2' }, `10:47 PM → ${fmt(S.endAt)} · ${tot} MINUTES · NOT A SCORE. A MIRROR.`));
  const bar = h('div', { cls: 'sbar' }), leg = h('div', { cls: 'leg' });
  cats.forEach(([key, nm, col]) => { if (!m[key]) return; bar.append(h('i', { style: `width:0;background:${col}`, 'data-w': (m[key] / tot * 100) + '%' })); leg.append(h('div', {}, h('span', { style: `background:${col}` }), `${nm}: ${m[key]} min`)); });
  if (other > 0) { bar.append(h('i', { style: 'width:0;background:var(--oth)', 'data-w': (other / tot * 100) + '%' })); leg.append(h('div', {}, h('span', { style: 'background:var(--oth)' }), `Everything else: ${other} min`)); }
  box.append(bar, leg);
  const stat = (t, s, good) => box.append(h('div', { cls: 'stat' + (good ? ' good' : '') }, t, s ? h('small', {}, s) : null));
  stat(`Your plan: stop revising at ${fmt(S.plan.study)}. You revised for ${m.study} minutes in total.`, `${S.solvedN()} of 4 questions done.`);
  const late = S.endAt - S.plan.sleep;
  stat(`Your plan: lights out by ${fmt(S.plan.sleep)}. Lights out: ${fmt(S.endAt)}.`, late > 0 ? `${late} minutes past your plan.` : late < 0 ? `${-late} minutes early.` : 'Exactly on time.');
  const ph = { next: 'next to you', facedown: 'face down on the desk', drawer: 'in the drawer' }[S.plan.phone];
  stat(`Your plan: phone ${ph}.`, S.plan.phone === 'drawer' ? (S.drawerOpens ? `You opened the drawer ${plural(S.drawerOpens, 'time')}.` : 'It stayed there.') : S.putAway ? `You put it in the drawer ${plural(S.putAway, 'time')} anyway.` : '');
  if (S.buzzRoom) stat(`Your phone lit up ${plural(S.buzzRoom, 'time')} while you were looking at the room.`, `You looked at it within 3 seconds ${plural(S.quick, 'time')}.`);
  if (S.lastSaid || S.brokeLimit || S.caved) stat(`You said “last one” ${plural(S.lastSaid + (S.toldLimit && !S.lastSaid ? 1 : 0), 'time')}.`, S.brokeLimit ? `You played past your own limit ${plural(S.brokeLimit, 'time')}.` : S.caved ? `You gave in to the guild ${plural(S.caved, 'time')}.` : 'And you meant it.');
  const good = [];
  if (S.ryan === 'helped') good.push('You helped Ryan.');
  if (S.mum.pear === 'ate') good.push('You sat with Mum.');
  if (S.mum.toldPlan) good.push('You told Mum your plan out loud.');
  if (S.hafiz.helped) good.push('You explained the minus-minus rule to Hafiz.');
  if (S.joined === 'no') good.push('You said no to your guild, under pressure.');
  if (S.offNicely && !S.brokeLimit) good.push('You told your guild your limit, and kept it.');
  if (S.wins) good.push('Your guild had a better night because of you. That’s real too.');
  if (S.hafiz.r2 === 'care') good.push('You asked Hafiz what happened.');
  if (S.hafiz.wentDown) good.push('You showed up for Hafiz.');
  if (S.hafiz.counsellor) good.push('You offered to go with Hafiz to the school counsellor.');
  if (S.focusUsed) good.push('You tried Focus mode.');
  if (good.length) stat('What went right:', good.join(' '), true);
  cine.inn.append(box);
  requestAnimationFrame(() => setTimeout(() => bar.querySelectorAll('i').forEach(i => i.style.width = i.dataset.w), 60));
  await cTap();
}
async function smallChange() {
  const OPTS = ['Phone in another room, or a drawer, when I study.', 'Tell my friends my stop time before I start playing.', 'Write a plan with a stop time, and set an alarm for it.', 'Switch off notifications for one app.', 'Post it, then put the phone away. No checking likes tonight.', 'Check on one friend, in person.', 'When I say “last one”, mean it.'];
  const i = await cChoose('If you could change one small thing, starting tonight, what would it be?', OPTS);
  cine.inn.innerHTML = '';
  const ds = new Date().toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' });
  cine.inn.append(h('div', { cls: 'commit' }, h('div', { cls: 'h' }, `${S.name}’s one small change`), h('div', { cls: 'b' }, OPTS[i]), h('div', { cls: 'f' }, h('span', {}, 'Starting: tonight'), h('span', {}, ds))),
    h('div', { cls: 'fine' }, 'Screenshot this, or write it down. Nothing in this game is saved or sent anywhere.'));
  await cTap();
}
function finale(k, found) {
  cine.inn.innerHTML = '';
  cine.inn.append(h('div', { cls: 'endttl' }, 'YOUR ENDING'), h('div', { cls: 'endname', style: 'font-size:clamp(40px,7vw,64px)' }, ENDS[k]),
    h('div', { cls: 'ends' }, `ENDINGS FOUND · ${found.size} OF ${ENDKEYS.length}`, h('br'), ...ENDKEYS.map((e, i) => [found.has(e) ? h('b', {}, ENDS[e]) : '? ? ?', i < ENDKEYS.length - 1 ? '  ·  ' : ''])),
    h('div', { cls: 'endline', style: 'margin-top:22px;font-size:17px' }, 'The night will be the same. You might not.'),
    h('div', { cls: 'row2' }, h('button', { cls: 'bigbtn', onclick: () => location.reload() }, 'PLAY AGAIN')));
}

/* ================= title + intro ================= */
async function title() {
  cine.open(IMG.desk_off, .35);
  const found = new Set(store().endings || []);
  return new Promise(res => {
    cine.inn.append(h('div', { cls: 'ttl' },
      h('h1', {}, 'AFK'), h('div', { cls: 'tg' }, 'away from keyboard'), h('div', { cls: 'sub' }, 'a story about where the night goes'),
      h('div', { cls: 'warn' }, 'About 15–20 minutes. Play it in one go.', h('br'), 'Play it the way you’d really spend the night. There’s no right answer.', h('br'), 'Nothing you do here is saved or sent anywhere.'),
      h('button', { cls: 'bigbtn', onclick: () => res() }, 'BEGIN'),
      h('button', { cls: 'smbtn', onclick: e => { e.stopPropagation(); A.toggle(); e.target.textContent = 'SOUND: ' + (A.on ? 'ON' : 'OFF'); } }, 'SOUND: OFF'),
      found.size ? h('div', { cls: 'ends' }, `ENDINGS FOUND · ${found.size} OF ${ENDKEYS.length}`, h('br'), ...ENDKEYS.map((e, i) => [found.has(e) ? h('b', {}, ENDS[e]) : '? ? ?', i < ENDKEYS.length - 1 ? '  ·  ' : ''])) : null));
  });
}
async function intro() {
  cine.setBg(null);
  await cLines(['Wednesday. 10:47 PM.', 'G3 Math WA1 tomorrow.', 'The revision package has been open to the same page for an hour.']);
  const prev = store().name || '';
  await new Promise(res => {
    cine.inn.innerHTML = '';
    const inp = h('input', { cls: 'nameIn', maxlength: 14, placeholder: 'type a name', value: prev, 'aria-label': 'Your name' });
    const ok = () => { S.name = inp.value.trim().replace(/[<>]/g, '') || 'Sam'; res(); };
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') ok(); });
    cine.inn.append(h('div', { cls: 'cl' }, 'What do your friends call you?'), inp, h('button', { cls: 'bigbtn', style: 'font-size:12px;padding:12px 22px', onclick: ok }, 'THAT’S ME'));
    setTimeout(() => inp.focus(), 100);
  });
  await cLines(['Before the night starts, you write a plan on a sticky note.']);
  S.plan.study = [at(23, 15), at(23, 30), at(23, 45), at(24, 0)][await cChoose('Stop revising at…', ['11:15 PM', '11:30 PM', '11:45 PM', '12:00 AM'])];
  S.plan.sleep = [at(23, 45), at(24, 0), at(24, 30), at(25, 0)][await cChoose('Lights out by…', ['11:45 PM', '12:00 AM', '12:30 AM', '1:00 AM'])];
  S.plan.phone = ['next', 'facedown', 'drawer'][await cChoose('And your phone goes…', ['next to you', 'face down on the desk', 'in the drawer'])];
  await new Promise(res => {
    cine.inn.innerHTML = '';
    cine.inn.append(h('div', { cls: 'howto' }, h('h2', {}, 'How this works'), h('ul', {},
      h('li', {}, wide ? 'Your room is on the left. Your phone is on the right. Click a side to pay attention to it.' : 'Use ROOM and PHONE at the bottom to switch between your room and your phone.'),
      h('li', {}, 'Time moves when you do something: revise, play, reply, scroll, open a door.'),
      h('li', {}, 'People will need you tonight. So will your phone. You can’t be everywhere.'),
      h('li', {}, 'Click the text, or press Space, to continue.')),
      h('div', { style: 'text-align:center' }, h('button', { cls: 'bigbtn', onclick: res }, 'START THE NIGHT'))));
  });
}
function startNight() {
  cine.close();
  const ph = { next: 'next to me', facedown: 'face down', drawer: 'in the drawer' }[S.plan.phone];
  const sk = $('#sticky'); sk.innerHTML = ''; sk.append(h('b', {}, 'TONIGHT'), `revise till ${fmtS(S.plan.study)}`, h('br'), `lights out ${fmtS(S.plan.sleep)}`, h('br'), `phone: ${ph}`); sk.style.display = 'block';
  S.drawer = S.plan.phone === 'drawer';
  S.started = true; A.setHum(A.on);
  layout(); renderView(); openP(S.drawer ? 'drawer' : 'home'); drawClock();
  hintTxt = 'Your desk. The revision package is waiting.'; idleRoom();
  setTimeout(() => advance(1, 'other', 'staring at the revision package'), 1200);
}
$('#sndBtn').addEventListener('click', () => A.toggle());
$('#homebar').addEventListener('click', () => { if (!S.inMatch && !S.drawer && !S.ended) openP('home'); });
$('#helpBtn').addEventListener('click', () => { if (R.busy) return; scene(async () => { await say(wide ? 'Click the room or the phone to look at it.' : 'Switch between ROOM and PHONE at the bottom.', 'Time moves when you do something. Your plan is on the sticky note.', 'Click the white dots in your room to do things. Use Desk, Door and Window to look around.'); }); });

async function main() {
  layout();
  if (TEST) { S.name = QS.get('name') || 'Sam'; S.plan.phone = QS.get('phone') || 'next'; return startNight(); }
  await title();
  try { if (wide && document.documentElement.requestFullscreen && !document.fullscreenElement) await document.documentElement.requestFullscreen(); } catch (e) {}
  await intro();
  startNight();
}
window.AFK = { S, advance, endNight, openP, setFocus, go, TH, GR, EV };
main();
