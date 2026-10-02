import './style.css';

const COLS = 6;
const ROWS = 12;
const CELL = 32;
const COLORS = ['#ff5a5f', '#4cc9f0', '#ffd166', '#9b5de5', '#2ec4b6'];
const DROP_INTERVAL = 500;
const SOFT_DROP_INTERVAL = 50;
const SCORE_PER_PUYO = 10;

const app = document.querySelector('#app');
app.innerHTML = `
  <div class="game-shell">
    <header class="topbar">
      <h1>Puyo Puyo</h1>
      <button id="restart">Restart</button>
    </header>
    <main class="layout">
      <canvas id="board" width="${COLS * CELL}" height="${ROWS * CELL}"></canvas>
      <aside class="panel">
        <section><h2>Score</h2><div id="score">0</div></section>
        <section><h2>Chain</h2><div id="chain">0</div></section>
        <section><h2>Next</h2><canvas id="next" width="96" height="96"></canvas></section>
        <section class="help">
          <p>Move: ← →</p>
          <p>Rotate: ↑ / X</p>
          <p>Soft drop: ↓</p>
          <p>Hard drop: Space</p>
        </section>
      </aside>
    </main>
    <div id="message" class="message hidden"></div>
  </div>
`;

const boardCanvas = document.querySelector('#board');
const boardCtx = boardCanvas.getContext('2d');
const nextCanvas = document.querySelector('#next');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.querySelector('#score');
const chainEl = document.querySelector('#chain');
const messageEl = document.querySelector('#message');
const restartBtn = document.querySelector('#restart');

let board;
let current;
let nextPiece;
let score;
let chain;
let gameOver;
let lastDrop;
let softDrop = false;

function emptyBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function randColor() {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}

function makePiece() {
  return {
    x: 2,
    y: 0,
    rot: 0,
    colors: [randColor(), randColor()]
  };
}

function cellsFor(piece) {
  const offsets = [
    [{ x: 0, y: 0 }, { x: 0, y: -1 }],
    [{ x: 0, y: 0 }, { x: 1, y: 0 }],
    [{ x: 0, y: 0 }, { x: 0, y: 1 }],
    [{ x: 0, y: 0 }, { x: -1, y: 0 }],
  ][piece.rot];
  return offsets.map((o, i) => ({ x: piece.x + o.x, y: piece.y + o.y, color: piece.colors[i] }));
}

function valid(piece) {
  return cellsFor(piece).every(({ x, y }) => x >= 0 && x < COLS && y < ROWS && (y < 0 || !board[y][x]));
}

function spawn() {
  current = nextPiece ?? makePiece();
  nextPiece = makePiece();
  current.x = 2;
  current.y = 0;
  current.rot = 0;
  if (!valid(current)) {
    gameOver = true;
    messageEl.textContent = 'Game Over';
    messageEl.classList.remove('hidden');
  }
}

function placeCurrent() {
  cellsFor(current).forEach(({ x, y, color }) => {
    if (y >= 0) board[y][x] = color;
  });
}

function applyGravity() {
  let moved = false;
  for (let y = ROWS - 2; y >= 0; y--) {
    for (let x = 0; x < COLS; x++) {
      if (board[y][x] && !board[y + 1][x]) {
        board[y + 1][x] = board[y][x];
        board[y][x] = null;
        moved = true;
      }
    }
  }
  return moved;
}

function findGroups() {
  const visited = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
  const groups = [];
  const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (!board[y][x] || visited[y][x]) continue;
      const color = board[y][x];
      const stack = [[x, y]];
      const group = [];
      visited[y][x] = true;
      while (stack.length) {
        const [cx, cy] = stack.pop();
        group.push([cx, cy]);
        for (const [dx, dy] of dirs) {
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) continue;
          if (visited[ny][nx] || board[ny][nx] !== color) continue;
          visited[ny][nx] = true;
          stack.push([nx, ny]);
        }
      }
      if (group.length >= 4) groups.push(group);
    }
  }
  return groups;
}

function clearGroups(groups) {
  let cleared = 0;
  for (const group of groups) {
    cleared += group.length;
    for (const [x, y] of group) board[y][x] = null;
  }
  score += cleared * SCORE_PER_PUYO * Math.max(1, chain);
  scoreEl.textContent = score;
  chainEl.textContent = chain;
}

function resolveBoard() {
  let localChain = 0;
  while (true) {
    const groups = findGroups();
    if (!groups.length) {
      if (!applyGravity()) break;
      continue;
    }
    localChain += 1;
    chain = localChain;
    clearGroups(groups);
    while (applyGravity()) {}
  }
  chain = 0;
  chainEl.textContent = chain;
}

function lockPiece() {
  placeCurrent();
  resolveBoard();
  spawn();
}

function move(dx) {
  const next = { ...current, x: current.x + dx };
  if (valid(next)) current = next;
}

function rotate() {
  const next = { ...current, rot: (current.rot + 1) % 4 };
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    const kicked = { ...next, x: next.x + kick };
    if (valid(kicked)) {
      current = kicked;
      return;
    }
  }
}

function drop() {
  const next = { ...current, y: current.y + 1 };
  if (valid(next)) {
    current = next;
    return true;
  }
  lockPiece();
  return false;
}

function hardDrop() {
  while (drop()) {}
}

function drawCell(ctx, x, y, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x * CELL + CELL / 2, y * CELL + CELL / 2, CELL * 0.42, 0, Math.PI * 2);
  ctx.fill();
}

function renderBoard() {
  boardCtx.clearRect(0, 0, boardCanvas.width, boardCanvas.height);
  boardCtx.fillStyle = '#101820';
  boardCtx.fillRect(0, 0, boardCanvas.width, boardCanvas.height);
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (board[y][x]) drawCell(boardCtx, x, y, board[y][x]);
    }
  }
  if (current && !gameOver) {
    for (const c of cellsFor(current)) {
      if (c.y >= 0) drawCell(boardCtx, c.x, c.y, c.color);
    }
  }
}

function renderNext() {
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  nextCtx.fillStyle = '#101820';
  nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
  const piece = nextPiece;
  const preview = [
    { x: 1, y: 1, color: piece.colors[0] },
    { x: 1, y: 2, color: piece.colors[1] }
  ];
  preview.forEach(({ x, y, color }) => drawCell(nextCtx, x, y, color));
}

function loop(timestamp) {
  if (!lastDrop) lastDrop = timestamp;
  const interval = softDrop ? SOFT_DROP_INTERVAL : DROP_INTERVAL;
  if (!gameOver && timestamp - lastDrop >= interval) {
    drop();
    lastDrop = timestamp;
  }
  renderBoard();
  renderNext();
  requestAnimationFrame(loop);
}

function reset() {
  board = emptyBoard();
  current = null;
  nextPiece = makePiece();
  score = 0;
  chain = 0;
  gameOver = false;
  lastDrop = 0;
  messageEl.classList.add('hidden');
  scoreEl.textContent = score;
  chainEl.textContent = chain;
  spawn();
}

window.addEventListener('keydown', (e) => {
  if (gameOver && e.key !== 'Enter') return;
  if (e.key === 'ArrowLeft') move(-1);
  if (e.key === 'ArrowRight') move(1);
  if (e.key === 'ArrowUp' || e.key === 'x' || e.key === 'X') rotate();
  if (e.key === 'ArrowDown') softDrop = true;
  if (e.key === ' ') { e.preventDefault(); hardDrop(); }
  if (e.key === 'r' || e.key === 'R') reset();
});
window.addEventListener('keyup', (e) => {
  if (e.key === 'ArrowDown') softDrop = false;
});
restartBtn.addEventListener('click', reset);

reset();
requestAnimationFrame(loop);
