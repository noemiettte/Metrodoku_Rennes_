const categories = Object.keys(STATIONS[0].props);

let errors = 0;
const MAX_ERRORS = 3;
let gameOver = false;

// ---------------------------------------------------------------------------
// Utilitaires de génération
// ---------------------------------------------------------------------------

function seededRandom(seed) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function shuffle(arr, seed) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(seededRandom(seed + i) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Graine basée sur la date locale : change chaque jour à minuit.
 * Format : YYYYMMDD (ex. 20260617) → nombre stable toute la journée.
 */
function dailySeed() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm   = String(d.getMonth() + 1).padStart(2, '0');
  const dd   = String(d.getDate()).padStart(2, '0');
  return Number(`${yyyy}${mm}${dd}`);
}

// ---------------------------------------------------------------------------
// Résolution par backtracking
// ---------------------------------------------------------------------------

function findSolution(rows, cols) {
  const cells = [];

  rows.forEach(row => {
    cols.forEach(col => {
      cells.push({
        row,
        col,
        candidates: STATIONS.filter(
          s => s.props[row] && s.props[col]
        )
      });
    });
  });

  // On commence par les cases avec le moins de candidats (plus rapide)
  cells.sort((a, b) => a.candidates.length - b.candidates.length);

  const used     = new Set();
  const solution = {};

  function backtrack(index) {
    if (index === cells.length) return true;

    const cell = cells[index];
    for (const station of cell.candidates) {
      if (used.has(station.name)) continue;

      used.add(station.name);
      solution[`${cell.row}|${cell.col}`] = station.name;

      if (backtrack(index + 1)) return true;

      used.delete(station.name);
      delete solution[`${cell.row}|${cell.col}`];
    }
    return false;
  }

  return backtrack(0) ? solution : null;
}

// ---------------------------------------------------------------------------
// Génération de la grille
// ---------------------------------------------------------------------------

function generateValidGrid(seed) {
  let attempts = 0;

  while (attempts < 500) {
    // Les catégories de lignes et de colonnes doivent être DISTINCTES
    const rows = shuffle(categories, seed + attempts).slice(0, 3);
    const remaining = categories.filter(c => !rows.includes(c));

    if (remaining.length < 3) {
      throw new Error('Pas assez de catégories distinctes');
    }

    const cols     = shuffle(remaining, seed + 1000 + attempts).slice(0, 3);
    const solution = findSolution(rows, cols);

    if (solution) return { rows, cols, solution };
    attempts++;
  }

  throw new Error('Impossible de générer une grille valide');
}

// ---------------------------------------------------------------------------
// Autocomplétion
// ---------------------------------------------------------------------------

function normalize(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function getSuggestions(value) {
  const normValue = normalize(value.trim());
  if (normValue.length < 3) return [];

  return STATIONS
    .filter(s => normalize(s.name).includes(normValue))
    .slice(0, 8);
}

function setupAutocomplete(input) {
  const list = input.parentElement.querySelector('.suggestions');

  input.addEventListener('input', () => {
    if (gameOver || input.disabled) return;

    const matches = getSuggestions(input.value);
    list.innerHTML = '';

    if (matches.length === 0) {
      list.classList.remove('visible');
      return;
    }

    matches.forEach(station => {
      const li = document.createElement('li');
      li.textContent = station.name;
      li.addEventListener('mousedown', e => {
        e.preventDefault();
        input.value = station.name;
        list.innerHTML = '';
        list.classList.remove('visible');
        input.dispatchEvent(new Event('change'));
      });
      list.appendChild(li);
    });

    list.classList.add('visible');
  });

  // Petit délai pour laisser le clic mousedown s'exécuter avant le blur
  input.addEventListener('blur', () => {
    setTimeout(() => list.classList.remove('visible'), 120);
  });

  input.addEventListener('focus', () => {
    if (input.value.trim().length >= 3) {
      input.dispatchEvent(new Event('input'));
    }
  });
}

// ---------------------------------------------------------------------------
// Révélation des solutions en fin de partie
// ---------------------------------------------------------------------------

function clearSuggestions(td) {
  const list = td.querySelector('.suggestions');
  if (list) {
    list.innerHTML = '';
    list.classList.remove('visible');
  }
}

function revealAllSolutions() {
  document.querySelectorAll('#grid td').forEach(td => {
    const input = td.querySelector('input');
    const row   = input.dataset.r;
    const col   = input.dataset.c;

    clearSuggestions(td);

    // Toutes les stations valides pour cette case, triées alphabétiquement
    const candidates = STATIONS
      .filter(s => s.props[row] && s.props[col])
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'));

    // La station retenue par l'algorithme pour cette case
    const usedAnswer = window.currentSolution[`${row}|${col}`];

    let solDiv = td.querySelector('.solutions');
    if (!solDiv) {
      solDiv = document.createElement('div');
      solDiv.className = 'solutions';
      td.appendChild(solDiv);
    }

    solDiv.innerHTML = candidates
      .map(s => {
        const cls = s.name === usedAnswer ? ' class="solution-used"' : '';
        return `<span${cls}>${s.name}</span>`;
      })
      .join(', ');

    solDiv.classList.add('visible');
  });
}

// ---------------------------------------------------------------------------
// Création de la grille
// ---------------------------------------------------------------------------

function create(seed) {
  errors  = 0;
  gameOver = false;

  const puzzle = generateValidGrid(seed);
  window.currentSolution = puzzle.solution;

  const { rows, cols } = puzzle;

  let h = '<table><tr><th></th>';
  cols.forEach(c => { h += `<th>${c}</th>`; });
  h += '</tr>';

  rows.forEach(r => {
    h += `<tr><th>${r}</th>`;
    cols.forEach(c => {
      h += `
        <td>
          <div class="autocomplete-wrapper">
            <input data-r="${r}" data-c="${c}" autocomplete="off" placeholder="Station…">
            <ul class="suggestions"></ul>
          </div>
        </td>`;
    });
    h += '</tr>';
  });

  h += '</table>';

  document.getElementById('grid').innerHTML   = h;
  document.getElementById('result').textContent = `Erreurs : 0 / ${MAX_ERRORS}`;

  document.querySelectorAll('#grid input').forEach(input => {
    input.addEventListener('change', () => validateInput(input));
    setupAutocomplete(input);
  });
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateInput(input) {
  if (gameOver) return;

  const name = input.value.trim().toLowerCase();
  if (!name) return;

  const station = STATIONS.find(s => s.name.toLowerCase() === name);

  const duplicate = [...document.querySelectorAll('#grid input')]
    .filter(i => i !== input)
    .some(i => i.value.trim().toLowerCase() === name);

  const valid =
    station &&
    !duplicate &&
    station.props[input.dataset.r] &&
    station.props[input.dataset.c];

  if (valid) {
    input.classList.remove('bad');
    input.classList.add('ok');
    input.disabled = true;
    clearSuggestions(input.closest('td'));
  } else {
    input.classList.remove('ok');
    input.classList.add('bad');
    errors++;
    document.getElementById('result').textContent =
      `Erreurs : ${errors} / ${MAX_ERRORS}`;

    if (errors >= MAX_ERRORS) {
      gameOver = true;
      document.querySelectorAll('#grid input').forEach(i => {
        i.disabled = true;
        clearSuggestions(i.closest('td'));
      });
      document.getElementById('result').textContent =
        '💀 Game Over — 3 erreurs';
      revealAllSolutions();
      return;
    }
  }

  checkVictory();
}

// ---------------------------------------------------------------------------
// Vérification / victoire
// ---------------------------------------------------------------------------

function checkAllInputs() {
  if (gameOver) return;
  document.querySelectorAll('#grid input:not(:disabled)').forEach(input => {
    if (input.value.trim()) validateInput(input);
  });
}

function checkVictory() {
  const inputs = [...document.querySelectorAll('#grid input')];
  const won    = inputs.every(i => i.disabled && i.classList.contains('ok'));

  if (won) {
    gameOver = true;
    document.getElementById('result').textContent =
      '🎉 Bravo ! Métrodoku complété !';
    revealAllSolutions();
  }
}

// ---------------------------------------------------------------------------
// Boutons
// ---------------------------------------------------------------------------

document.getElementById('dailyBtn').onclick  = () => create(dailySeed());
document.getElementById('randomBtn').onclick = () => create(Date.now());
document.getElementById('checkBtn').onclick  = checkAllInputs;
document.getElementById('shareBtn').onclick  = () => {
  navigator.clipboard.writeText('Je joue à Métrodoku Rennes !');
  alert('Texte copié dans le presse-papier.');
};

// ---------------------------------------------------------------------------
// Lancement
// ---------------------------------------------------------------------------

create(dailySeed());
