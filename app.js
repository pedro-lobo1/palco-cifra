'use strict';
/* =========================================================
   PALCO – cifras sem anúncios, feito para tocar ao vivo
   ========================================================= */

/* ---------- Utilidades / armazenamento ---------- */
const STORE = 'palco.v1';
const DRIVE_CLIENT_ID = '1042109351796-l3orq68h382me7sg8k6bcg7989ji4a4k.apps.googleusercontent.com';
const DRIVE_FILE = 'palco-cifra-backup.json';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const SUPABASE_URL = 'https://eluoobuawbsszhbraztl.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_-zieybwZ8m_uTKMCtmw8HA_4FKMNFTY';
const db = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nz = t => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function defaults() { return { songs: [], setlists: [], prefs: { font: 20, mode: 'full', speed: 3 }, tab: 'songs' }; }
function load() {
  try {
    const d = JSON.parse(localStorage.getItem(STORE));
    if (d && Array.isArray(d.songs)) {
      const def = defaults();
      return { ...def, ...d, prefs: { ...def.prefs, ...(d.prefs || {}) } };
    }
  } catch (e) { /* ignora */ }
  const d = defaults();
  d.songs.push(demoSong());
  return d;
}
function save() { try { localStorage.setItem(STORE, JSON.stringify(S)); } catch (e) { toast('Erro ao salvar'); } }
const byId = id => S.songs.find(s => String(s.id) === String(id));
const setById = id => S.setlists.find(s => String(s.id) === String(id));

function demoSong() {
  return {
    id: uid(), title: 'Música de Exemplo', artist: 'Palco', key: 'G', bpm: '72', transpose: 0,
    notes: 'Entrada só baixo e teclado. Refrão 2x no final.',
    content: `[Intro] G  D/F#  Em  C

[Verso]
G               D/F#
  Aqui vai a primeira linha da letra
Em              C
  Cole a cifra que você copiou
G               D/F#
  As linhas de acorde ficam coloridas
Em        C         D
  E dá pra trocar o tom na hora

[Pré-Refrão]
Am7        C        D
  Marque as partes entre colchetes

[Refrão]
G         D/F#
  Toque nos botões lá em cima
Em          C
  Pra pular direto pra cada parte
G         D/F#
  Próxima música com um toque
Em      C       D    G
  Sem anúncio nenhum

[Final] C  D  G`
  };
}

let S = load();

/* ---------- Teoria: acordes e transposição ---------- */
const SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const IDX = { C: 0, 'B#': 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, Fb: 4, F: 5, 'E#': 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11, Cb: 11 };
const CHORD_RE = /^([A-G])([#b♯♭]?)((?:maj|min|dim|aug|sus|add|alt|omit|m|M|º|°|ø|Δ|∆|\+|-|−|\d|\(|\)|,|#|b|♯|♭|\/(?=\d))*)(?:\/([A-G])([#b♯♭]?))?$/;
const FILLER_RE = /^(\|+|:?\|\|?:?|x\d+|[\[(]?\d+x[\])]?|[\[(]?x\d+[\])]?|[\[(]?bis[\])]?|->|→|~|[-–—−]+|\.+|,|;|%|\(|\)|\/|N\.?C\.?|\*+|>+|•|·|:|=|\d+\.)$/i;
const WRAP_RE = /^([|(\[]*)(.*?)([|)\],;.*]*)$/;
const TAB_RE = /^\s*[EADGBe]\s?[|:][-\d\s~hpb\/\\x()|]*--/;
const SEC_PFX_RE = /^\s*((?:intro(?:du[cç][aã]o)?|verso(?:\s*\d+)?|estrofe(?:\s*\d+)?|pr[eé]-?refr[aã]o|refr[aã]o|coro|ponte|solo|interl[uú]dio|base|repete|final(?:iza[cç][aã]o)?|outro|coda|riff|passagem|instrumental|1ª\s*parte|2ª\s*parte|primeira\s*parte|segunda\s*parte)(?:\s*:\s*|\s+[-–—]+\s*|\s+))(.+)$/i;

function normAcc(a) { return a === '♯' ? '#' : a === '♭' ? 'b' : (a || ''); }
function isSimpleChord(t) {
  if (CHORD_RE.test(t)) return true;
  const m = t.match(WRAP_RE);
  return !!(m && m[2] && CHORD_RE.test(m[2]));
}
function isChordToken(t) {
  if (isSimpleChord(t)) return true;
  if (/(-|–|—|->|→)/.test(t)) {
    const parts = t.split(/(-|–|—|->|→)/).filter(Boolean);
    let chords = 0;
    for (const p of parts) {
      if (isSimpleChord(p)) chords++;
      else if (!/^(-|–|—|->|→)$/.test(p)) return false;
    }
    return chords >= 2;
  }
  return false;
}
function isChordLine(line) {
  const clean = line.replace(/(^|\s)[\[(]([^\]\)]*)[\])](?=\s|$)/g, (m, sp, inner) =>
    inner.trim().split(/\s+/).every(w => !w || isChordToken(w)) ? m : sp
  ).trim();
  const toks = (clean || line.trim()).split(/\s+/);
  if (!toks[0]) return false;
  let chords = 0;
  for (const t of toks) {
    if (isChordToken(t)) chords++;
    else if (!FILLER_RE.test(t)) return false;
  }
  return chords > 0 && (clean === line.trim() || chords >= 2 || !/^(A|E|Em)\b/.test(clean));
}
function noteName(r, n, flat) {
  const i = IDX[r];
  if (i == null) return r;
  return (flat ? FLAT : SHARP)[((i + n) % 12 + 12) % 12];
}
function trCore(c, n, flat) {
  const m = c.match(CHORD_RE);
  if (!m) return null;
  return noteName(m[1] + normAcc(m[2]), n, flat) + m[3] + (m[4] ? '/' + noteName(m[4] + normAcc(m[5]), n, flat) : '');
}
function trSimple(t, n, flat) {
  let r = trCore(t, n, flat);
  if (r != null) return r;
  const m = t.match(WRAP_RE);
  if (m && m[2]) { r = trCore(m[2], n, flat); if (r != null) return m[1] + r + m[3]; }
  return null;
}
function trToken(t, n, flat) {
  const r = trSimple(t, n, flat);
  if (r != null) return r;
  if (isChordToken(t)) {
    return t.split(/(-|–|—|->|→)/).map(p => trSimple(p, n, flat) ?? p).join('');
  }
  return t;
}
// Transpõe mantendo o alinhamento dos acordes sobre a letra
function trLine(line, n, flat) {
  let out = '';
  const re = /\S+/g;
  let m;
  while ((m = re.exec(line))) {
    const t = trToken(m[0], n, flat);
    let pos = m.index;
    if (out.length > 0 && pos < out.length + 1) pos = out.length + 1;
    out = out.padEnd(pos, ' ') + t;
  }
  return out;
}
function useFlat(s, n) {
  const m = String(s.key || '').trim().match(/^([A-G][#b]?)(m(?!aj))?/);
  if (m && IDX[m[1]] != null) {
    const i = ((IDX[m[1]] + n) % 12 + 12) % 12;
    return m[2] ? [2, 7, 0, 5, 10, 3].includes(i) : [5, 10, 3, 8, 1, 6].includes(i);
  }
  return /(^|\s)[A-G]b/.test(s.content || '');
}
function shownKey(s) {
  if (!s || !s.key) return '';
  const n = s.transpose || 0;
  if (!n) return s.key;
  return trToken(String(s.key).trim(), n, useFlat(s, n));
}

/* ---------- Leitura da cifra ---------- */
function parse(song, n) {
  const flat = useFlat(song, n);
  const tr = l => (n ? trLine(l, n, flat) : l);
  const lines = String(song.content || '').replace(/\r/g, '').replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\u00a0/g, ' ').split('\n');
  const out = [], sections = [];
  for (const raw of lines) {
    const line = raw.replace(/\t/g, '    ').replace(/\s+$/, '');
    if (TAB_RE.test(line)) { out.push({ t: 'tab', s: line }); continue; }
    const sm = line.match(/^\s*\[([^\]]+)\]\s*(.*)$/);
    if (sm && !isChordToken(sm[1])) {
      const id = 'sec' + sections.length;
      sections.push({ id, label: sm[1].trim() });
      out.push({ t: 'sec', s: sm[1].trim(), id });
      const rest = sm[2];
      if (rest.trim()) out.push(isChordLine(rest) ? { t: 'chord', s: tr(rest) } : { t: 'lyr', s: rest });
      continue;
    }
    const pm = line.match(SEC_PFX_RE);
    if (pm && isChordLine(pm[2])) {
      out.push({ t: 'chord', s: pm[1] + ' ' + tr(pm[2]) });
      continue;
    }
    if (!line.trim()) { out.push({ t: 'blank' }); continue; }
    if (isChordLine(line)) out.push({ t: 'chord', s: tr(line) });
    else {
      const s = n ? line.replace(/\[([^\]]+)\]/g, (m, c) => isChordToken(c.trim()) ? '[' + trToken(c.trim(), n, flat) + ']' : m) : line;
      out.push({ t: 'lyr', s });
    }
  }
  return { out, sections };
}
function sheetHTML(p, mode) {
  let html = '', lastBlank = true;
  for (const L of p.out) {
    if (mode === 'chords' && L.t === 'lyr') continue;
    if (mode === 'lyrics' && (L.t === 'chord' || L.t === 'tab')) continue;
    if (L.t === 'blank') {
      if (lastBlank) continue;
      html += '<div class="ln blank"></div>';
      lastBlank = true;
      continue;
    }
    if (L.t === 'sec') { html += `<div class="sec" id="${L.id}">${esc(L.s)}</div>`; lastBlank = true; continue; }
    lastBlank = false;
    if (mode === 'lyrics' && L.t === 'lyr') {
      const txt = L.s.replace(/\[([^\]]+)\]/g, (m, c) => isChordToken(c.trim()) ? '' : m).trim().replace(/\s{2,}/g, ' ');
      html += `<div class="ln lyr">${esc(txt)}</div>`;
      continue;
    }
    const content = L.t === 'lyr'
      ? esc(L.s).replace(/\[([^\]]+)\]/g, (m, c) => isChordToken(c.trim()) ? `<span class="ic">[${c}]</span>` : m)
      : esc(L.s);
    html += `<div class="ln ${L.t}">${content}</div>`;
  }
  return html;
}

/* ---------- Navegação (com botão voltar do Android) ---------- */
const $app = document.getElementById('app');
let view = { name: 'home', q: '' };
const stack = [];
let sheetOpen = false;

function go(v) {
  stack.push(view);
  view = v;
  history.pushState({ d: stack.length }, '');
  leave();
  render();
}
function back() { history.back(); }
window.addEventListener('popstate', () => {
  if (sheetOpen) { sheetOpen = false; closeSheetDom(); return; }
  view = stack.pop() || { name: 'home', q: '' };
  leave();
  render();
});
function leave() { stopScroll(); if (view.name !== 'stage') wake(false); }
function render() {
  const fn = { home: renderHome, editSong: renderEditSong, editSet: renderEditSet, pick: renderPick, stage: renderStage }[view.name];
  (fn || renderHome)();
}

/* ---------- Painel inferior e avisos ---------- */
function openSheet(html) {
  closeSheetDom();
  const d = document.createElement('div');
  d.id = 'ov'; d.className = 'ov';
  d.innerHTML = `<div class="sheet-box">${html}</div>`;
  d.addEventListener('click', e => { if (e.target === d) closeSheet(); });
  document.body.appendChild(d);
  if (!sheetOpen) { sheetOpen = true; history.pushState({ sheet: 1 }, ''); }
}
function closeSheetDom() { const o = document.getElementById('ov'); if (o) o.remove(); }
function closeSheet() { if (sheetOpen) history.back(); else closeSheetDom(); }
function goFromSheet(v) {
  sheetOpen = false; closeSheetDom();
  stack.push(view); view = v;
  history.replaceState({ d: stack.length }, '');
  leave(); render();
}
function toast(msg) {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.className = 'show';
  clearTimeout(toast.h);
  toast.h = setTimeout(() => { t.className = ''; }, 1400);
}

/* ---------- Aviso de instalação no iPhone/iPad ---------- */
function iosHint() {
  const ua = navigator.userAgent || '';
  const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = navigator.standalone || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
  if (!ios || standalone || localStorage.getItem('palco.hideIos')) return '';
  const box = 'margin:0 12px 10px;padding:12px;border-radius:12px;background:#14213f;border:1px solid #2f6bff;font-size:14px;line-height:1.5';
  if (location.protocol === 'file:')
    return `<div style="${box}">⚠️ No iPhone o app não instala abrindo o arquivo. Abra pelo <b>link https</b> publicado (ex.: Netlify) no Safari.</div>`;
  if (/CriOS|FxiOS|EdgiOS|Instagram|FBAN|FBAV|WhatsApp|Line\//.test(ua))
    return `<div style="${box}">📲 Para instalar, abra este link no <b>Safari</b> (toque em ⋯ → "Abrir no Safari").</div>`;
  return `<div style="${box}">📲 <b>Instalar no iPhone:</b> toque em <b>Compartilhar ⬆️</b> na barra do Safari → role para baixo → <b>"Adicionar à Tela de Início"</b>.
    <button class="btn" style="display:block;margin-top:8px;padding:8px" data-a="hideIos">Entendi</button></div>`;
}

/* ---------- Tela inicial ---------- */
function filteredSongs(q) {
  const k = nz(q);
  return S.songs
    .filter(s => !k || nz(s.title).includes(k) || nz(s.artist).includes(k))
    .sort((a, b) => String(a.title).localeCompare(String(b.title), 'pt'));
}
function renderHome() {
  const tab = S.tab === 'sets' ? 'sets' : 'songs';
  $app.innerHTML = `
  <header class="top"><h1>🎸 Palco Cifra</h1><button class="icon" data-a="quickPaste" aria-label="Nova música do que foi copiado">📋</button><button class="icon" data-a="menu" aria-label="Menu">⋯</button></header>
  <nav class="tabs">
    <button class="${tab === 'songs' ? 'on' : ''}" data-a="tab" data-v="songs">Músicas (${S.songs.length})</button>
    <button class="${tab === 'sets' ? 'on' : ''}" data-a="tab" data-v="sets">Repertórios (${S.setlists.length})</button>
  </nav>
  ${tab === 'songs' ? `<div class="search"><input id="q" type="search" placeholder="🔎 Buscar música ou artista" value="${esc(view.q || '')}"></div>` : ''}
  ${iosHint()}
  <main class="list" id="hlist"></main>
  <button class="fab" data-a="${tab === 'songs' ? 'newSong' : 'newSet'}" aria-label="Adicionar">+</button>`;

  const draw = () => {
    const el = document.getElementById('hlist');
    if (tab === 'songs') {
      const list = filteredSongs(view.q);
      el.innerHTML = list.map(s => `
        <div class="row" data-a="playSong" data-id="${s.id}">
          <div class="grow"><b>${esc(s.title)}</b><small>${esc(s.artist || '')}</small></div>
          <span class="key">${esc(shownKey(s))}</span>
          <button class="icon sm" data-a="editSong" data-id="${s.id}" aria-label="Editar">✎</button>
        </div>`).join('') || `<p class="empty">${S.songs.length ? 'Nada encontrado.' : 'Nenhuma música ainda.<br>Toque em <b>+</b> e cole uma cifra.'}</p>`;
    } else {
      el.innerHTML = S.setlists.map(l => `
        <div class="row" data-a="editSet" data-id="${l.id}">
          <div class="grow"><b>${esc(l.name || 'Sem nome')}</b><small>${l.songs.length} música(s)</small></div>
          <button class="btn primary" style="flex:0 0 auto;padding:10px 16px" data-a="playSet" data-id="${l.id}">▶ Tocar</button>
        </div>`).join('') || '<p class="empty">Crie um repertório para o culto/show<br>e passe de uma música para outra com um toque.</p>';
    }
  };
  draw();
  const q = document.getElementById('q');
  if (q) q.addEventListener('input', e => { view.q = e.target.value; draw(); });
}

/* ---------- Colagem inteligente (limpa texto copiado de sites de cifra) ---------- */
const JUNK_RE = /^(cifras?(\.com\.br| club)?|cifraclub|imprimir|compartilhar|favoritar|salvar|seguir|baixar|exibir.*|ocultar.*|simplificar.*|auto ?rolagem.*|rolagem.*|tamanho.*|texto|tablatura|acordes?|v[ií]deo ?aula|videoaula|letra|cifra|tom|afina[cç][aã]o.*|composi[cç][aã]o.*|colabora[cç][aã]o.*|revis(ão|ões).*|enviar.*|corrigir.*|comentários?.*|\d+ (exibições|visualizações).*|ver (mais|todos).*|mais acessadas.*|publicidade|anúncio|patrocinado|home|início|buscar.*|entrar|cadastre-se|login|menu|×|x|aa|a\+|a-|\+|-|ok|fechar|mudar tom.*|meio tom.*|trocar tom.*)$/i;

// Linhas típicas do Cifra Club / Cifras.com.br que não fazem parte da música
const JUNK2_RE = /^((imprimir|compartilhar|favoritar|salvar|baixar|seguir|adicionar|copiar)\b.*|cifra\s*:.*|principal\b.*|parte \d+ de \d+|vers(ão|ões)\b.*|cifra club.*|academy.*|aprenda a tocar.*|aula\b.*|metr[oô]nomo.*|afinador.*|exibir\b.*|ocultar\b.*|mostrar\b.*|diagramas?.*|tablaturas?\b.*|baixo|bateria|gaita|teclado|ukulele|cavaco|viol[aã]o( e guitarra)?|guitarra|partitura|grade|mais|menos|editar|reportar.*|denunciar.*|\d+([.,]\d+)?\s*(mil|mi)?\s*(exibições|visualizações|views).*|★.*|☆.*)$/i;
// A partir destas linhas é rodapé do site: corta o resto
const FOOTER_RE = /^(composi[cç][aã]o de\b|essa informação está errada|enviada por\b|colabora[cç][aã]o e revis[aã]o\b|ver (mais|todas) (músicas|cifras)|mais (cifras|músicas) de\b|comentários\b|cifras relacionadas)/i;

function cleanPaste(text) {
  const res = { title: '', artist: '', key: '', notes: '', content: '' };
  const lines = String(text || '').replace(/\r/g, '').replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\u00a0/g, ' ').split('\n');
  const keep = [];
  let started = false;
  for (const raw of lines) {
    const t = raw.trim();
    let m;
    if ((m = t.match(/^(.+?)\s+-\s+(.+?)\s+-\s+(Cifra Club|Cifras)\b/i))) { res.title = res.title || m[1]; res.artist = res.artist || m[2]; continue; }
    if (started && FOOTER_RE.test(t)) break;
    if ((m = t.match(/^[Tt]om\s*:\s*([A-G][#b]?m?)\b/)) && !res.key) { res.key = m[1]; continue; }
    if ((m = t.match(/^[Cc]apo(traste)?\b.*?(\d+)/))) { res.notes = `Capotraste na ${m[2]}ª casa`; continue; }
    if (/^(afina[cç][aã]o|tuning)\b/i.test(t)) continue;
    if (/^parte \d+ de \d+$/i.test(t)) continue;
    if (t && t.length < 50 && (JUNK_RE.test(t) || (!started && JUNK2_RE.test(t)))) continue;
    if (t && (isChordLine(t) || /^\[[^\]]+\]/.test(t))) started = true;
    keep.push(raw.replace(/\t/g, '    ').replace(/\s+$/, ''));
  }
  // Título e artista = primeiras linhas curtas antes do primeiro acorde/parte
  const head = [];
  let i = 0;
  for (; i < keep.length; i++) {
    const t = keep[i].trim();
    if (!t) continue;
    if (isChordLine(t) || /^\[[^\]]+\]/.test(t) || TAB_RE.test(t)) break;
    if (head.length < 2 && t.length <= 60) head.push(i); else break;
  }
  // Só usa como título se depois vier cifra (evita pegar letra)
  if (head.length && i < keep.length) {
    res.title = res.title || keep[head[0]].trim();
    if (head[1] != null) res.artist = res.artist || keep[head[1]].trim();
    head.slice().reverse().forEach(k => keep.splice(k, 1));
  }
  res.content = keep.join('\n').replace(/^\n+/, '').replace(/\n{3,}/g, '\n\n').trimEnd();
  if (!res.key) { const m = String(text).match(/Tom:\s*([A-G][#b]?m?)/); if (m) res.key = m[1]; }
  return res;
}
function applyPaste(text) {
  const r = cleanPaste(text);
  const set = (id, v) => { const e = document.getElementById(id); if (e && v && !e.value.trim()) e.value = v; };
  document.getElementById('f-content').value = r.content;
  set('f-title', r.title); set('f-artist', r.artist); set('f-key', r.key); set('f-notes', r.notes);
  toast(r.title ? `Colado ✓ ${r.title}` : 'Colado ✓ confira o nome');
}

/* ---------- Editor de música ---------- */
function renderEditSong() {
  const s = byId(view.id) || { title: '', artist: '', key: '', bpm: '', notes: '', content: '' };
  $app.innerHTML = `
  <header class="top">
    <button class="icon" data-a="back" aria-label="Voltar">←</button>
    <h1>${view.id ? 'Editar música' : 'Nova música'}</h1>
    ${view.id ? `<button class="icon danger" data-a="delSong" data-id="${view.id}" aria-label="Excluir">🗑</button>` : ''}
  </header>
  <main class="form">
    <label>Nome<input id="f-title" value="${esc(s.title)}" placeholder="Nome da música"></label>
    <label>Artista<input id="f-artist" value="${esc(s.artist)}" placeholder="Opcional"></label>
    <div class="two">
      <label>Tom original<input id="f-key" value="${esc(s.key)}" placeholder="G, Am, F#…" autocapitalize="characters"></label>
      <label>BPM<input id="f-bpm" inputmode="numeric" value="${esc(s.bpm)}" placeholder="Opcional"></label>
    </div>
    <label>Recado para a banda<input id="f-notes" value="${esc(s.notes)}" placeholder="Ex: começa só voz e violão, refrão 2x"></label>
    <label>Cifra <small>Cole a cifra (acordes em cima da letra). Marque as partes com [Intro], [Verso], [Refrão]… para criar os atalhos.</small></label>
    <button class="paste" data-a="paste">📋 Colar da área de transferência</button>
    <textarea id="f-content" spellcheck="false" autocapitalize="off" autocomplete="off" placeholder="[Intro] G D Em C

[Verso]
G          D
  Letra da música…">${esc(s.content)}</textarea>
  </main>
  <div class="bottom-bar">
    <button class="btn" data-a="back">Cancelar</button>
    <button class="btn primary" data-a="saveSong">Salvar</button>
  </div>`;
  // Colar com o dedo (segurar → Colar) num campo vazio também limpa e preenche tudo
  document.getElementById('f-content').addEventListener('paste', e => {
    const ta = e.target;
    if (ta.value.trim()) return;
    const t = (e.clipboardData || window.clipboardData).getData('text');
    if (!t) return;
    e.preventDefault();
    applyPaste(t);
  });
}

/* ---------- Repertório ---------- */
function renderEditSet() {
  const s = setById(view.id);
  if (!s) { back(); return; }
  s.songs = s.songs.filter(id => byId(id));
  $app.innerHTML = `
  <header class="top">
    <button class="icon" data-a="back" aria-label="Voltar">←</button>
    <h1>Repertório</h1>
    <button class="icon danger" data-a="delSet" aria-label="Excluir">🗑</button>
  </header>
  <div class="form" style="padding-bottom:0"><input id="set-name" value="${esc(s.name)}" placeholder="Nome (ex: Culto domingo)"></div>
  <main class="list" style="padding-top:12px">
    ${s.songs.map((id, i) => {
      const x = byId(id);
      return `<div class="row">
        <span class="num">${i + 1}</span>
        <div class="grow"><b>${esc(x.title)}</b><small>${esc(x.artist || '')}</small></div>
        <span class="key">${esc(shownKey(x))}</span>
        <button class="icon sm" data-a="up" data-i="${i}" ${i === 0 ? 'disabled' : ''}>↑</button>
        <button class="icon sm" data-a="down" data-i="${i}" ${i === s.songs.length - 1 ? 'disabled' : ''}>↓</button>
        <button class="icon sm" data-a="rm" data-i="${i}">✕</button>
      </div>`;
    }).join('') || '<p class="empty">Nenhuma música ainda.</p>'}
  </main>
  <div class="bottom-bar">
    <button class="btn" data-a="pick">+ Músicas</button>
    <button class="btn primary" data-a="playSet" data-id="${s.id}">▶ Tocar</button>
  </div>`;
  document.getElementById('set-name').addEventListener('input', e => { s.name = e.target.value; save(); });
}
function renderPick() {
  const s = setById(view.id);
  if (!s) { back(); return; }
  $app.innerHTML = `
  <header class="top"><button class="icon" data-a="back" aria-label="Voltar">←</button><h1>Adicionar músicas</h1></header>
  <div class="search" style="padding-top:10px"><input id="q" type="search" placeholder="🔎 Buscar" value="${esc(view.q)}"></div>
  <main class="list" id="plist"></main>
  <div class="bottom-bar"><button class="btn primary" data-a="addPicked">Adicionar (<span id="pc">0</span>)</button></div>`;
  view.draw = () => {
    document.getElementById('plist').innerHTML = filteredSongs(view.q).map(x => {
      const on = view.sel.includes(x.id);
      return `<div class="row ${on ? 'sel' : ''}" data-a="togglePick" data-id="${x.id}">
        <span class="chk">${on ? '✓' : ''}</span>
        <div class="grow"><b>${esc(x.title)}</b><small>${esc(x.artist || '')}${s.songs.includes(x.id) ? ' · já está no repertório' : ''}</small></div>
        <span class="key">${esc(shownKey(x))}</span></div>`;
    }).join('') || '<p class="empty">Nenhuma música.</p>';
    document.getElementById('pc').textContent = view.sel.length;
  };
  view.draw();
  document.getElementById('q').addEventListener('input', e => { view.q = e.target.value; view.draw(); });
}

/* ---------- MODO PALCO ---------- */
function renderStage(keepScroll) {
  const ids = view.list = view.list.filter(id => byId(id));
  if (!ids.length) { back(); return; }
  view.i = Math.min(Math.max(view.i, 0), ids.length - 1);
  const song = byId(ids[view.i]);
  const n = song.transpose || 0;
  const p = parse(song, n);
  const next = byId(ids[view.i + 1]);
  const old = document.getElementById('sheet');
  const st = keepScroll && old ? old.scrollTop : 0;
  const mode = S.prefs.mode;

  $app.innerHTML = `
  <div class="stage" style="--fs:${S.prefs.font}px">
    <header class="st-top">
      <button class="icon" data-a="back" aria-label="Sair">✕</button>
      <div class="st-title" data-a="jump">
        <b>${esc(song.title)}</b>
        <small>${song.artist ? esc(song.artist) + ' · ' : ''}${view.i + 1}/${ids.length} ▾</small>
      </div>
      <div class="st-key" data-a="settings">
        <span>Tom</span><b>${esc(shownKey(song) || '–')}</b>${song.bpm ? `<small>${esc(song.bpm)} bpm</small>` : ''}
      </div>
    </header>
    ${p.sections.length ? `<nav class="chips">${p.sections.map(s => `<button data-a="sec" data-id="${s.id}">${esc(s.label)}</button>`).join('')}</nav>` : ''}
    <main id="sheet" class="sheet mode-${mode}">
      ${song.notes ? `<div class="notes">📝 ${esc(song.notes)}</div>` : ''}
      ${sheetHTML(p, mode)}
      <div class="end">${next ? `Próxima: <b>${esc(next.title)}</b>${next.key ? ' · Tom ' + esc(shownKey(next)) : ''}` : 'Fim da lista'}</div>
    </main>
    <div class="ctl">
      <button data-a="trDown" aria-label="Baixar meio tom">−½</button>
      <button data-a="trReset" class="tr" aria-label="Tom original">${n ? (n > 0 ? '+' : '') + n : '±0'}</button>
      <button data-a="trUp" aria-label="Subir meio tom">+½</button>
      <button data-a="fontDown" aria-label="Diminuir letra">A−</button>
      <button data-a="fontUp" aria-label="Aumentar letra">A+</button>
      <button data-a="scroll" id="b-scroll" class="${scrollRAF ? 'on' : ''}" aria-label="Rolagem automática">⏬</button>
      <button data-a="settings" aria-label="Ajustes">⚙</button>
    </div>
    <div class="nav">
      <button data-a="prev" ${view.i === 0 ? 'disabled' : ''} aria-label="Música anterior">◀</button>
      <button data-a="next" class="nx" ${next ? '' : 'disabled'}>
        ${next ? `<small>Próxima ▶</small><b>${esc(next.title)}${next.key ? ' · ' + esc(shownKey(next)) : ''}</b>` : '<b>Fim da lista</b>'}
      </button>
    </div>
  </div>`;
  const sh = document.getElementById('sheet');
  sh.scrollTop = st;
  bindSwipe(sh);
  wake(true);
}
function setSong(i) {
  if (i < 0 || i >= view.list.length) { toast(i < 0 ? 'Início da lista' : 'Fim da lista'); return; }
  stopScroll();
  view.i = i;
  renderStage(false);
  toast('▶ ' + byId(view.list[i]).title);
}
function bindSwipe(el) {
  let x0 = null, y0 = 0, t0 = 0;
  el.addEventListener('touchstart', e => { const t = e.touches[0]; x0 = t.clientX; y0 = t.clientY; t0 = Date.now(); }, { passive: true });
  el.addEventListener('touchend', e => {
    if (x0 == null) return;
    const t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0;
    x0 = null;
    if (Date.now() - t0 > 600) return;
    if (Math.abs(dx) > 90 && Math.abs(dy) < 60 && el.scrollWidth <= el.clientWidth + 4) setSong(view.i + (dx < 0 ? 1 : -1));
  }, { passive: true });
}

/* Rolagem automática */
let scrollRAF = null, lastT = 0, acc = 0;
function startScroll() {
  lastT = performance.now(); acc = 0;
  const step = t => {
    const el = document.getElementById('sheet');
    if (!el) { scrollRAF = null; return; }
    acc += ((t - lastT) / 1000) * S.prefs.speed * 10;
    lastT = t;
    const px = Math.floor(acc);
    if (px) { el.scrollTop += px; acc -= px; }
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 1) { stopScroll(); return; }
    scrollRAF = requestAnimationFrame(step);
  };
  scrollRAF = requestAnimationFrame(step);
  const b = document.getElementById('b-scroll'); if (b) b.classList.add('on');
}
function stopScroll() {
  if (scrollRAF) cancelAnimationFrame(scrollRAF);
  scrollRAF = null;
  const b = document.getElementById('b-scroll'); if (b) b.classList.remove('on');
}

/* Tela sempre acesa durante o modo palco */
let wl = null;
async function wake(on) {
  try {
    if (on && 'wakeLock' in navigator && !wl) {
      wl = await navigator.wakeLock.request('screen');
      wl.addEventListener('release', () => { wl = null; });
    } else if (!on && wl) { await wl.release(); wl = null; }
  } catch (e) { /* sem suporte */ }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && view.name === 'stage') wake(true);
});

function settingsHTML() {
  const m = S.prefs.mode;
  return `<h3>Ajustes do palco</h3>
    <div class="hint">Mostrar</div>
    <div class="seg">
      <button class="${m === 'full' ? 'on' : ''}" data-a="mode" data-v="full">Completo</button>
      <button class="${m === 'chords' ? 'on' : ''}" data-a="mode" data-v="chords">Só acordes</button>
      <button class="${m === 'lyrics' ? 'on' : ''}" data-a="mode" data-v="lyrics">Só letra</button>
    </div>
    <div class="hint">Velocidade da rolagem automática</div>
    <div class="seg">
      <button data-a="spd" data-v="-1">− Devagar</button>
      <button disabled style="opacity:1"><b id="spdv">${S.prefs.speed}</b></button>
      <button data-a="spd" data-v="1">Rápido +</button>
    </div>
    <button class="btn wide" data-a="editFromStage">✎ Editar esta música</button>
    <p class="hint">Dica: arraste para o lado na cifra para trocar de música. Pedal Bluetooth/teclado: ← → trocam de música, ↑ ↓ / PageUp PageDown rolam a página.</p>
    <button class="btn wide ghost" data-a="closeSheet">Fechar</button>`;
}

/* ---------- Sincronização com Google Drive ---------- */
let gToken = null, gTokenExp = 0, gisLoading = null;
const driveClientId = () => DRIVE_CLIENT_ID || localStorage.getItem('palco.driveId') || '';

function loadGIS() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (gisLoading) return gisLoading;
  gisLoading = new Promise((res, rej) => {
    const sc = document.createElement('script');
    sc.src = 'https://accounts.google.com/gsi/client';
    sc.async = true;
    sc.onload = () => res();
    sc.onerror = () => { gisLoading = null; rej(new Error('Sem conexão com o Google')); };
    document.head.appendChild(sc);
  });
  return gisLoading;
}

async function driveToken() {
  if (gToken && Date.now() < gTokenExp - 30000) return gToken;
  const cid = driveClientId().trim();
  if (!cid) throw new Error('Informe o Client ID do Google Drive');
  await loadGIS();
  return new Promise((res, rej) => {
    const tc = google.accounts.oauth2.initTokenClient({
      client_id: cid,
      scope: DRIVE_SCOPE,
      callback: r => {
        if (r.error || !r.access_token) return rej(new Error(r.error_description || r.error || 'Login cancelado'));
        gToken = r.access_token;
        gTokenExp = Date.now() + (Number(r.expires_in) || 3600) * 1000;
        res(gToken);
      }
    });
    tc.requestAccessToken({ prompt: gToken ? '' : 'consent' });
  });
}

async function driveFetch(url, opt = {}) {
  const tk = await driveToken();
  const r = await fetch(url, { ...opt, headers: { Authorization: 'Bearer ' + tk, ...(opt.headers || {}) } });
  if (r.status === 401) { gToken = null; throw new Error('Sessão expirada, tente novamente'); }
  if (!r.ok) throw new Error('Erro Google Drive (' + r.status + ')');
  return r;
}

async function driveFind() {
  const q = encodeURIComponent(`name='${DRIVE_FILE}' and trashed=false`);
  const r = await driveFetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,modifiedTime)&spaces=drive`);
  const d = await r.json();
  return d.files?.[0] || null;
}

function mergeBackup(d) {
  if (!d || !Array.isArray(d.songs)) throw new Error('formato');
  for (const s of d.songs) { const i = S.songs.findIndex(x => String(x.id) === String(s.id)); if (i >= 0) S.songs[i] = s; else S.songs.push(s); }
  for (const l of d.setlists || []) { const i = S.setlists.findIndex(x => String(x.id) === String(l.id)); if (i >= 0) S.setlists[i] = l; else S.setlists.push(l); }
  save();
  supaLoad(false);
}

async function drivePush() {
  toast('Enviando para o Drive…');
  const payload = JSON.stringify({ app: 'palco', v: 1, updatedAt: new Date().toISOString(), songs: S.songs, setlists: S.setlists });
  const existing = await driveFind();
  if (existing) {
    await driveFetch(`https://www.googleapis.com/upload/drive/v3/files/${existing.id}?uploadType=media`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: payload
    });
  } else {
    const b = 'palco_' + Date.now();
    const meta = JSON.stringify({ name: DRIVE_FILE, mimeType: 'application/json' });
    const body = `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${b}\r\nContent-Type: application/json\r\n\r\n${payload}\r\n--${b}--`;
    await driveFetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${b}` }, body
    });
  }
  localStorage.setItem('palco.driveSync', new Date().toLocaleString('pt-BR'));
  toast(`Salvo no Drive ✓ (${S.songs.length} músicas)`);
  closeSheet();
}

async function drivePull() {
  toast('Buscando no Drive…');
  const existing = await driveFind();
  if (!existing) { toast('Nenhum backup encontrado no Drive'); return; }
  const r = await driveFetch(`https://www.googleapis.com/drive/v3/files/${existing.id}?alt=media`);
  const d = await r.json();
  mergeBackup(d);
  localStorage.setItem('palco.driveSync', new Date().toLocaleString('pt-BR'));
  toast(`Sincronizado ✓ (${d.songs.length} músicas)`);
  closeSheet(); render();
}

function menuHTML() {
  const cid = driveClientId();
  const last = localStorage.getItem('palco.driveSync');
  return `<h3>Menu</h3>
    <button class="btn wide primary" data-a="supaSync">🔄 Sincronizar com Supabase</button>
    <hr style="border:0;border-top:1px solid var(--line);margin:14px 0">
    <div class="hint" style="margin-bottom:6px">☁️ <b>Google Drive</b>${last ? ` · último sync: ${esc(last)}` : ''}</div>
    ${DRIVE_CLIENT_ID ? '' : `<input id="drive-cid" placeholder="Cole seu Google Client ID (.apps.googleusercontent.com)" value="${esc(cid)}" style="margin-bottom:8px;font-size:13px">`}
    <button class="btn wide" data-a="drivePush">☁️ Enviar para o Google Drive</button>
    <button class="btn wide" data-a="drivePull">☁️ Baixar do Google Drive</button>
    <hr style="border:0;border-top:1px solid var(--line);margin:14px 0">
    <button class="btn wide" data-a="export">⬇️ Exportar backup (arquivo .json)</button>
    <button class="btn wide" data-a="import">⬆️ Importar backup (arquivo .json)</button>
    <p class="hint">As cifras ficam salvas offline no aparelho. Use o Google Drive ou o arquivo .json para sincronizar entre PC e celular.</p>
    <button class="btn wide ghost" data-a="closeSheet">Fechar</button>`;
}

/* ---------- Sincronização com Supabase (tabela "Cifras") ---------- */
const isSupaId = id => /^\d+$/.test(String(id || ''));
const toSupaRow = s => ({
  titulo: s.title || '',
  artista: s.artist || '',
  tom: s.key || '',
  bpm: s.bpm || '',
  notes: s.notes || '',
  transpose: s.transpose || 0,
  conteudo: s.content || ''
});
const fromSupaRow = r => ({
  id: String(r.id),
  title: r.titulo || '',
  artist: r.artista || '',
  key: r.tom || '',
  bpm: r.bpm || '',
  notes: r.notes || '',
  transpose: r.transpose || 0,
  content: r.conteudo || ''
});

async function supaLoad(manual) {
  if (!db) { if (manual) toast('Supabase não conectado'); return; }
  if (manual) toast('Sincronizando…');
  try {
    const { data, error } = await db.from('Cifras').select('id,titulo,artista,tom,bpm,notes,transpose,conteudo').order('titulo', { ascending: true });
    if (error || !Array.isArray(data)) { if (manual) toast('Erro ao acessar Supabase'); return; }
    const remote = data.map(fromSupaRow);
    const localOnly = S.songs.filter(s => !isSupaId(s.id) && !(s.title === 'Música de Exemplo' && s.artist === 'Palco'));
    S.songs = [...remote, ...localOnly];
    save();
    if (view.name === 'home') render();
    let sent = 0;
    for (const s of localOnly) {
      if (!remote.some(r => nz(r.title) === nz(s.title) && nz(r.artist) === nz(s.artist))) {
        await supaSave(s);
        sent++;
      }
    }
    if (manual) { toast(`Supabase ✓ (${S.songs.length} cifras${sent ? `, ${sent} enviada(s)` : ''})`); closeSheet(); }
  } catch (e) { if (manual) toast('Sem conexão com o Supabase'); }
}

async function supaSave(s) {
  if (!db || !s) return;
  try {
    if (isSupaId(s.id)) {
      await db.from('Cifras').update(toSupaRow(s)).eq('id', Number(s.id));
    } else {
      const oldId = s.id;
      const { data, error } = await db.from('Cifras').insert(toSupaRow(s)).select('id').single();
      if (!error && data?.id != null) {
        s.id = String(data.id);
        S.setlists.forEach(l => { l.songs = l.songs.map(x => x === oldId ? s.id : x); });
        if (view.list) view.list = view.list.map(x => x === oldId ? s.id : x);
        save();
        if (view.name === 'home') render();
      }
    }
  } catch (e) { /* offline */ }
}

async function supaDelete(id) {
  if (!db || !isSupaId(id)) return;
  try { await db.from('Cifras').delete().eq('id', Number(id)); } catch (e) { /* offline */ }
}

/* ---------- Ações (cliques) ---------- */
const actions = {
  tab: d => { S.tab = d.v; save(); render(); },
  menu: () => {
    openSheet(menuHTML());
    const inp = document.getElementById('drive-cid');
    if (inp) inp.addEventListener('input', e => localStorage.setItem('palco.driveId', e.target.value.trim()));
  },
  drivePush: () => drivePush().catch(e => toast(e.message || 'Erro ao enviar')),
  drivePull: () => drivePull().catch(e => toast(e.message || 'Erro ao baixar')),
  supaSync: () => supaLoad(true),
  closeSheet: () => closeSheet(),
  back: () => back(),
  hideIos: () => { localStorage.setItem('palco.hideIos', '1'); render(); },
  quickPaste: async () => {
    let t = '';
    try { t = await navigator.clipboard.readText(); } catch (e) { /* sem permissão */ }
    go({ name: 'editSong', id: null });
    if (t && t.trim()) applyPaste(t);
    else toast('Nada copiado. Segure no campo da cifra → Colar');
  },

  newSong: () => go({ name: 'editSong', id: null }),
  editSong: d => go({ name: 'editSong', id: d.id }),
  playSong: d => {
    const ids = filteredSongs(view.q).map(s => s.id);
    go({ name: 'stage', list: ids, i: Math.max(0, ids.indexOf(d.id)) });
  },
  paste: async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (!t) return toast('Área de transferência vazia');
      applyPaste(t);
    } catch (e) { toast('Toque e segure no campo da cifra → Colar'); }
  },
  saveSong: () => {
    const f = id => document.getElementById(id).value;
    const title = f('f-title').trim();
    if (!title) return toast('Dê um nome à música');
    const content = f('f-content');
    let key = f('f-key').trim();
    if (!key) { const m = content.match(/Tom:\s*([A-G][#b]?m?)/); if (m) key = m[1]; }
    let s = byId(view.id);
    if (!s) { s = { id: uid(), transpose: 0 }; S.songs.push(s); }
    Object.assign(s, { title, artist: f('f-artist').trim(), key, bpm: f('f-bpm').trim(), notes: f('f-notes').trim(), content });
    save(); toast('Salvo ✓'); back();
    supaSave(s);
  },
  delSong: d => {
    const s = byId(d.id);
    if (!s || !confirm(`Excluir "${s.title}"?`)) return;
    S.songs = S.songs.filter(x => x.id !== d.id);
    S.setlists.forEach(l => { l.songs = l.songs.filter(id => id !== d.id); });
    save(); toast('Excluída'); back();
    supaDelete(d.id);
  },

  newSet: () => {
    const l = { id: uid(), name: 'Repertório ' + new Date().toLocaleDateString('pt-BR'), songs: [] };
    S.setlists.unshift(l); save();
    go({ name: 'editSet', id: l.id });
  },
  editSet: d => go({ name: 'editSet', id: d.id }),
  playSet: d => {
    const l = setById(d.id);
    const ids = l ? l.songs.filter(id => byId(id)) : [];
    if (!ids.length) return toast('Repertório vazio');
    go({ name: 'stage', list: ids, i: 0 });
  },
  up: d => moveInSet(+d.i, -1),
  down: d => moveInSet(+d.i, 1),
  rm: d => { const l = setById(view.id); l.songs.splice(+d.i, 1); save(); render(); },
  delSet: () => {
    const l = setById(view.id);
    if (!l || !confirm(`Excluir o repertório "${l.name}"? (as músicas continuam salvas)`)) return;
    S.setlists = S.setlists.filter(x => x.id !== l.id); save(); back();
  },
  pick: () => go({ name: 'pick', id: view.id, sel: [], q: '' }),
  togglePick: d => {
    const i = view.sel.indexOf(d.id);
    if (i >= 0) view.sel.splice(i, 1); else view.sel.push(d.id);
    view.draw();
  },
  addPicked: () => {
    const l = setById(view.id);
    if (!view.sel.length) return toast('Selecione músicas');
    l.songs.push(...view.sel); save();
    toast(`${view.sel.length} adicionada(s)`); back();
  },

  prev: () => setSong(view.i - 1),
  next: () => setSong(view.i + 1),
  trUp: () => transpose(1),
  trDown: () => transpose(-1),
  trReset: () => { const s = byId(view.list[view.i]); s.transpose = 0; save(); renderStage(true); toast('Tom original'); supaSave(s); },
  fontUp: () => { S.prefs.font = Math.min(48, S.prefs.font + 2); save(); renderStage(true); },
  fontDown: () => { S.prefs.font = Math.max(12, S.prefs.font - 2); save(); renderStage(true); },
  scroll: () => (scrollRAF ? stopScroll() : startScroll()),
  sec: d => {
    const el = document.getElementById(d.id), sh = document.getElementById('sheet');
    if (el && sh) sh.scrollTo({ top: el.offsetTop - 6, behavior: 'smooth' });
  },
  settings: () => openSheet(settingsHTML()),
  mode: d => { S.prefs.mode = d.v; save(); closeSheet(); renderStage(false); },
  spd: d => {
    S.prefs.speed = Math.min(15, Math.max(1, S.prefs.speed + +d.v)); save();
    const v = document.getElementById('spdv'); if (v) v.textContent = S.prefs.speed;
  },
  editFromStage: () => goFromSheet({ name: 'editSong', id: view.list[view.i] }),
  jump: () => openSheet(`<h3>Ir para música</h3>
    ${view.list.map((id, i) => {
      const s = byId(id);
      return `<button class="jrow ${i === view.i ? 'cur' : ''}" data-a="jumpTo" data-i="${i}">
        <span class="num">${i + 1}</span><span class="grow"><b>${esc(s.title)}</b><small>${esc(s.artist || '')}</small></span>
        <span class="key">${esc(shownKey(s))}</span></button>`;
    }).join('')}
    <button class="btn wide ghost" data-a="closeSheet">Fechar</button>`),
  jumpTo: d => { closeSheet(); setSong(+d.i); },

  export: () => {
    const blob = new Blob([JSON.stringify({ app: 'palco', v: 1, songs: S.songs, setlists: S.setlists }, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `palco-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    closeSheet();
  },
  import: () => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.json,application/json';
    inp.onchange = () => {
      const f = inp.files[0]; if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        try {
          const d = JSON.parse(r.result);
          mergeBackup(d);
          toast(`Importado: ${d.songs.length} música(s)`); closeSheet(); render();
        } catch (e) { toast('Arquivo inválido'); }
      };
      r.readAsText(f);
    };
    inp.click();
  }
};
function moveInSet(i, dir) {
  const l = setById(view.id), j = i + dir;
  if (j < 0 || j >= l.songs.length) return;
  [l.songs[i], l.songs[j]] = [l.songs[j], l.songs[i]];
  save(); render();
}
function transpose(d) {
  const s = byId(view.list[view.i]);
  s.transpose = (((s.transpose || 0) + d + 17) % 12) - 5; // mantém entre -5 e +6
  save(); renderStage(true); supaSave(s);
  if (s.key) toast('Tom: ' + shownKey(s));
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-a]');
  if (!b || b.disabled) return;
  const fn = actions[b.dataset.a];
  if (fn) { e.preventDefault(); e.stopPropagation(); fn(b.dataset, b); }
});

/* Pedal Bluetooth / teclado */
document.addEventListener('keydown', e => {
  if (view.name !== 'stage' || sheetOpen) return;
  const sh = document.getElementById('sheet');
  if (!sh) return;
  const page = sh.clientHeight * 0.8;
  switch (e.key) {
    case 'ArrowRight': case 'n': setSong(view.i + 1); break;
    case 'ArrowLeft': case 'p': setSong(view.i - 1); break;
    case 'PageDown': case 'ArrowDown': case ' ': sh.scrollBy({ top: page, behavior: 'smooth' }); break;
    case 'PageUp': case 'ArrowUp': sh.scrollBy({ top: -page, behavior: 'smooth' }); break;
    case '+': case '=': transpose(1); break;
    case '-': transpose(-1); break;
    default: return;
  }
  e.preventDefault();
});

/* ---------- Início ---------- */
history.replaceState({ d: 0 }, '');
render();
supaLoad();
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
