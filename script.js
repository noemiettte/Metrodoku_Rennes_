let errors = 0;
const MAX_ERRORS = 3;
let gameOver = false;
let currentSolution = {};
let currentRows = [];
let currentCols = [];
let modalR = '';
let modalC = '';

const categories = Object.keys(STATIONS[0].props);

function seededRandom(s) {
  let x = Math.sin(s) * 10000;
  return x - Math.floor(x);
}

function shuffle(arr, s) {
  let a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(seededRandom(s + i) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function dailySeed() {
  const d = new Date();
  return Number(`${d.getFullYear()}${d.getMonth() + 1}${d.getDate()}`);
}

function findSolution(rows, cols) {
  const cells = [];
  rows.forEach(r => cols.forEach(c => {
    cells.push({ row: r, col: c, candidates: STATIONS.filter(s => s.props[r] && s.props[c]) });
  }));
  cells.sort((a, b) => a.candidates.length - b.candidates.length);
  const used = new Set(), sol = {};
  function bt(i) {
    if (i === cells.length) return true;
    for (const st of cells[i].candidates) {
      if (used.has(st.name)) continue;
      used.add(st.name);
      sol[`${cells[i].row}|${cells[i].col}`] = st.name;
      if (bt(i + 1)) return true;
      used.delete(st.name);
      delete sol[`${cells[i].row}|${cells[i].col}`];
    }
    return false;
  }
  return bt(0) ? sol : null;
}

function generateValidGrid(seed) {
  for (let a = 0; a < 500; a++) {
    const rows = shuffle(categories, seed + a).slice(0, 3);
    const rem = categories.filter(c => !rows.includes(c));
    const cols = shuffle(rem, seed + 1000 + a).slice(0, 3);
    const sol = findSolution(rows, cols);
    if (sol) return { rows, cols, solution: sol };
  }
  throw new Error('Pas de grille valide');
}

function getLine(station) {
  if (station.lines) return station.lines.join('/');
  return station.line || '?';
}

function key(r, c) {
  return (r + '|' + c).replace(/[^a-zA-Z0-9]/g, '_');
}

function setStatus(text, cls) {
  const el = document.getElementById('status');
  el.textContent = text;
  el.className = cls || '';
}

function updateHearts() {
  for (let i = 1; i <= 3; i++) {
    const h = document.getElementById('h' + i);
    if (h) h.className = 'heart' + (i <= errors ? ' lost' : '');
  }
}

function create(seed) {
  errors = 0;
  gameOver = false;
  activeCell = null;
  updateHearts();
  const puzzle = generateValidGrid(seed);
  currentSolution = puzzle.solution;
  currentRows = puzzle.rows;
  currentCols = puzzle.cols;
  document.getElementById('solutions-panel').innerHTML = '';
  document.getElementById('solutions-panel').className = '';

  let h = '<table><tr><th class="corner"></th>';
  currentCols.forEach(c => { h += `<th class="col-header">${c}</th>`; });
  h += '</tr>';
  currentRows.forEach(r => {
    h += `<tr><th class="row-header">${r}</th>`;
    currentCols.forEach(c => {
      h += `<td class="cell" id="cell-${key(r, c)}" onclick="openModal('${r.replace(/'/g, "\\'")}','${c.replace(/'/g, "\\'")}')">
        <div class="cell-inner">
          <span class="cell-placeholder">Appuyer pour choisir…</span>
        </div>
      </td>`;
    });
    h += '</tr>';
  });
  h += '</table>';
  document.getElementById('grid-area').innerHTML = h;
  setStatus('3 vies restantes — 9 cases à remplir', '');
}

function openModal(r, c) {
  if (gameOver) return;
  const td = document.getElementById('cell-' + key(r, c));
  if (td && td.classList.contains('ok')) return;
  modalR = r;
  modalC = c;
  document.getElementById('modal-title').textContent = `${r} ✕ ${c}`;
  const n = STATIONS.filter(s => s.props[r] && s.props[c]).length;
  document.getElementById('modal-hint').textContent = `${n} station${n > 1 ? 's' : ''} possible${n > 1 ? 's' : ''}`;
  document.getElementById('modal-input').value = '';
  filterModal();
  document.getElementById('modal-overlay').classList.add('open');
  setTimeout(() => document.getElementById('modal-input').focus(), 100);
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  document.getElementById('modal-input').value = '';
  modalR = '';
  modalC = '';
}

function normalize(s) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function filterModal() {
  const val = document.getElementById('modal-input').value;
  const norm = normalize(val.trim());
  let matches = STATIONS;
  if (norm.length >= 2) matches = STATIONS.filter(s => normalize(s.name).includes(norm));
  const list = document.getElementById('modal-list');
  const usedNames = new Set(
    [...document.querySelectorAll('.cell.ok')]
      .map(td => td.querySelector('.cell-ok-name')?.textContent)
      .filter(Boolean)
  );
  list.innerHTML = matches.slice(0, 20).map(s => {
    const used = usedNames.has(s.name);
    const possible = s.props[modalR] && s.props[modalC];
    return `<div class="modal-item" onclick="pickStation('${s.name.replace(/'/g, "\\'")}')">
      <div class="modal-item-name" style="${used ? 'color:var(--muted);text-decoration:line-through' : ''}${!possible ? ';opacity:.4' : ''}">${s.name}</div>
      <div class="modal-item-line">Ligne ${getLine(s)}${possible ? ' ✓' : ' ✗'}${used ? ' · déjà utilisée' : ''}</div>
    </div>`;
  }).join('');
}

function pickStation(name) {
  const r = modalR;
  const c = modalC;
  closeModal();
  validateChoice(name, r, c);
}

function validateChoice(name, r, c) {
  const station = STATIONS.find(s => s.name === name);
  const td = document.getElementById('cell-' + key(r, c));
  const usedNames = new Set(
    [...document.querySelectorAll('.cell.ok')]
      .map(el => el.querySelector('.cell-ok-name')?.textContent)
      .filter(Boolean)
  );
  const valid = station && !usedNames.has(name) && station.props[r] && station.props[c];
  if (valid) {
    td.classList.add('ok');
    td.innerHTML = `<div class="cell-inner">
      <div class="cell-ok-name">${name}</div>
      <div class="cell-line">Ligne ${getLine(station)}</div>
    </div>`;
    checkVictory();
  } else {
    errors++;
    updateHearts();
    td.classList.add('bad', 'shake');
    setTimeout(() => td.classList.remove('shake', 'bad'), 600);
    setStatus(
      `${MAX_ERRORS - errors} vie${MAX_ERRORS - errors !== 1 ? 's' : ''} restante${MAX_ERRORS - errors !== 1 ? 's' : ''}`,
      errors >= MAX_ERRORS ? 'lost' : ''
    );
    if (errors >= MAX_ERRORS) {
      gameOver = true;
      setStatus('💀 Game Over !', 'lost');
      revealSolutions();
    }
  }
}

function checkVictory() {
  if (document.querySelectorAll('.cell.ok').length === 9) {
    gameOver = true;
    setStatus('🎉 Bravo, Métrodoku complété !', 'won');
    revealSolutions();
  }
}

function revealSolutions() {
  const panel = document.getElementById('solutions-panel');
  panel.className = 'visible';
  let h = '<h3>Solutions possibles par case</h3><div class="sol-grid">';
  currentRows.forEach(r => {
    currentCols.forEach(c => {
      const cands = STATIONS
        .filter(s => s.props[r] && s.props[c])
        .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
      const okEl = document.getElementById('cell-' + key(r, c));
      const playerAnswer = okEl?.querySelector('.cell-ok-name')?.textContent || '';
      h += `<div class="sol-cell">
        <div class="sol-cell-label">${r.substring(0, 20)}<br>× ${c.substring(0, 20)}</div>
        <div class="sol-names">${cands.map(s => `<span class="${s.name === playerAnswer ? 'used' : ''}">${s.name}</span>`).join('')}</div>
      </div>`;
    });
  });
  h += '</div>';
  panel.innerHTML = h;
}

function shareGame() {
  const ok = document.querySelectorAll('.cell.ok').length;
  const txt = `🚇 Métrodoku Rennes\n${ok}/9 cases • ${errors} erreur${errors !== 1 ? 's' : ''}\nJoue sur Claude !`;
  if (navigator.share) {
    navigator.share({ text: txt });
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(txt).then(() => alert('Copié !'));
  } else {
    alert(txt);
  }
}

create(dailySeed());