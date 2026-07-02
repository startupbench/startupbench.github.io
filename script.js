const header = document.querySelector('[data-header]');
const revealItems = document.querySelectorAll('.reveal');
const leaderboardCards = document.querySelector('[data-leaderboard-cards]');
const leaderboardBody = document.querySelector('[data-leaderboard-body]');
const sortButtons = document.querySelectorAll('[data-sort]');

const leaderboardData = [
  { model: 'GPT-5.5', family: 'OpenAI', average: 72.96, pass: 26.8 },
  { model: 'Seed-2.1', family: 'ByteDance Seed', average: 69.55, pass: 23.71 },
  { model: 'Claude-4.1', family: 'Anthropic', average: 69.25, pass: 20.62 },
  { model: 'GLM-5.1', family: 'Zhipu AI', average: 62.45, pass: 18.56 },
  { model: 'Kimi-2.6', family: 'Moonshot AI', average: 57.55, pass: 14.43 },
  { model: 'Qwen-3.6', family: 'Alibaba Qwen', average: 57.4, pass: 12.37 },
  { model: 'DeepSeek-v4', family: 'DeepSeek', average: 56.8, pass: 12.37 },
  { model: 'Gemini-3.1', family: 'Google Gemini', average: 48.38, pass: 6.19 },
];

const rankColors = ['#10447f', '#2065c8', '#28a8a0', '#8752bf', '#f59d4a', '#eeb94a', '#e65454', '#5a7898'];
let sortKey = 'average';

function updateHeader() {
  if (!header) return;
  header.classList.toggle('is-scrolled', window.scrollY > 12);
}

function formatScore(value) {
  return value.toFixed(2);
}

function getGap(row) {
  return row.average - row.pass;
}

function getSortValue(row) {
  if (sortKey === 'gap') return getGap(row);
  return row[sortKey];
}

function getSortedLeaderboard() {
  return [...leaderboardData].sort((a, b) => {
    const primary = getSortValue(b) - getSortValue(a);
    if (primary !== 0) return primary;
    return b.average - a.average;
  });
}

function createScoreBar(label, value, variant = '') {
  const wrapper = document.createElement('div');
  wrapper.className = `score-bar ${variant}`.trim();

  const labelNode = document.createElement('span');
  labelNode.textContent = label;

  const track = document.createElement('span');
  track.className = 'score-track';

  const fill = document.createElement('span');
  fill.className = 'score-fill';
  fill.style.setProperty('--value', `${value}%`);

  const valueNode = document.createElement('span');
  valueNode.textContent = formatScore(value);

  track.append(fill);
  wrapper.append(labelNode, track, valueNode);
  return wrapper;
}

function createRankRow(row, index) {
  const article = document.createElement('article');
  article.className = 'rank-row';
  article.style.setProperty('--rank-color', rankColors[index % rankColors.length]);

  const rank = document.createElement('span');
  rank.className = 'rank-number';
  rank.textContent = index + 1;

  const model = document.createElement('div');
  model.className = 'rank-model';
  const modelName = document.createElement('strong');
  modelName.textContent = row.model;
  const family = document.createElement('span');
  family.textContent = row.family;
  model.append(modelName, family);

  const bars = document.createElement('div');
  bars.className = 'score-bars';
  bars.append(createScoreBar('Average', row.average), createScoreBar('Pass@1', row.pass, 'pass'));

  const gap = document.createElement('span');
  gap.className = 'gap-pill';
  gap.textContent = formatScore(getGap(row));
  gap.setAttribute('aria-label', `${formatScore(getGap(row))} point gap between average score and pass at one`);

  article.append(rank, model, bars, gap);
  return article;
}

function createTableRow(row, index) {
  const tr = document.createElement('tr');
  const cells = [index + 1, '', formatScore(row.average), formatScore(row.pass), formatScore(getGap(row))];

  for (const value of cells) {
    const td = document.createElement('td');
    if (value !== '') td.textContent = value;
    tr.append(td);
  }

  const modelCell = tr.children[1];
  const modelName = document.createElement('strong');
  modelName.textContent = row.model;
  const family = document.createElement('span');
  family.textContent = row.family;
  modelCell.append(modelName, family);

  return tr;
}

function renderLeaderboard() {
  if (!leaderboardCards || !leaderboardBody) return;
  const rows = getSortedLeaderboard();
  leaderboardCards.replaceChildren(...rows.map(createRankRow));
  leaderboardBody.replaceChildren(...rows.map(createTableRow));
}

function updateSortButtons(activeButton) {
  for (const button of sortButtons) {
    const isActive = button === activeButton;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  }
}

const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    }
  },
  { threshold: 0.14 }
);

for (const item of revealItems) observer.observe(item);

for (const button of sortButtons) {
  button.addEventListener('click', () => {
    sortKey = button.dataset.sort || 'average';
    updateSortButtons(button);
    renderLeaderboard();
  });
}

updateHeader();
renderLeaderboard();
window.addEventListener('scroll', updateHeader, { passive: true });
