const header = document.querySelector('[data-header]');
const revealItems = document.querySelectorAll('.reveal');
const leaderboardCards = document.querySelector('[data-leaderboard-cards]');
const leaderboardBody = document.querySelector('[data-leaderboard-body]');
const sortButtons = document.querySelectorAll('[data-sort]');
const caseBoard = document.querySelector('[data-case-board]');
const caseModal = document.querySelector('[data-case-modal]');
const caseModalClose = document.querySelector('[data-case-modal-close]');
const caseModalTitle = document.querySelector('[data-case-modal-title]');
const caseModalSub = document.querySelector('[data-case-modal-sub]');
const caseList = document.querySelector('[data-case-list]');
const caseTitle = document.querySelector('[data-case-title]');
const caseSource = document.querySelector('[data-case-source]');
const caseChips = document.querySelector('[data-case-chips]');
const caseTask = document.querySelector('[data-case-task]');
const caseExpected = document.querySelector('[data-case-expected]');
const caseErrors = document.querySelector('[data-case-errors]');
const caseProcess = document.querySelector('[data-case-process]');
const caseModels = document.querySelector('[data-case-models]');
const caseTrajectory = document.querySelector('.case-trajectory');
const caseTrajectoryMeta = document.querySelector('[data-case-trajectory-meta]');
const caseRunTabs = document.querySelector('[data-case-run-tabs]');
const caseTrajectorySteps = document.querySelector('[data-case-trajectory-steps]');
const trajectoryStepKicker = document.querySelector('[data-trajectory-step-kicker]');
const trajectoryStepType = document.querySelector('[data-trajectory-step-type]');
const trajectoryStepTitle = document.querySelector('[data-trajectory-step-title]');
const trajectoryStepDetail = document.querySelector('[data-trajectory-step-detail]');
const trajectoryStepEvidence = document.querySelector('[data-trajectory-step-evidence]');
const trajectoryStepState = document.querySelector('[data-trajectory-step-state]');
const trajectoryStepSource = document.querySelector('[data-trajectory-step-source]');
const trajectoryPlay = document.querySelector('[data-trajectory-play]');
const trajectoryNext = document.querySelector('[data-trajectory-next]');
const trajectoryCounter = document.querySelector('[data-trajectory-counter]');
const trajectoryProgress = document.querySelector('[data-trajectory-progress]');

const leaderboardData = [
  { model: 'Kimi-k3', family: 'Moonshot AI', average: 73.67, pass: 29.55 },
  { model: 'GPT-5.6-sol', family: 'OpenAI', average: 73.61, pass: 31.27 },
  { model: 'GPT-5.5', family: 'OpenAI', average: 72.79, pass: 26.8 },
  { model: 'Seed-2.1-Pro', family: 'ByteDance Seed', average: 67.19, pass: 22.34 },
  { model: 'DeepSeek-V4-Pro', family: 'DeepSeek', average: 61.11, pass: 16.49 },
  { model: 'GLM-5.1', family: 'Zhipu AI', average: 60.79, pass: 16.49 },
  { model: 'Kimi-K2.6', family: 'Moonshot AI', average: 59.95, pass: 13.06 },
  { model: 'Qwen-3.6-Max', family: 'Alibaba Qwen', average: 59.46, pass: 15.12 },
  { model: 'Gemini-3.1-Pro', family: 'Google Gemini', average: 49.73, pass: 6.53 },
];

const caseModelData = leaderboardData.filter(
  (row) => !['Kimi-k3', 'GPT-5.6-sol', 'GLM-5.1'].includes(row.model)
);

const rankColors = ['#10447f', '#2065c8', '#28a8a0', '#8752bf', '#f59d4a', '#eeb94a', '#e65454', '#5a7898', '#7c6f64'];
const initialCaseId = new URLSearchParams(window.location.search).get('case');
let sortKey = 'average';
let activeCaseId = initialCaseId || 'hr-payroll-feishu';
let activeRunModel = 'GPT-5.5';
let activeTrajectoryStep = 0;
let isTrajectoryPlaying = false;
let trajectoryTimer = null;
const trajectoryIntervalMs = 950;

function feishuRun(score, result, trace = 'athlete_traj_merged.jsonl', judge = 'rubric_judges.json') {
  return { score, result, trace, judge };
}

function getCaseError(score, copy) {
  if (score === 0 && copy.zero) return copy.zero;
  if (score >= 0.95) return copy.full;
  if (score >= 0.75) return copy.strong;
  if (score >= 0.45) return copy.partial;
  return copy.weak;
}

function getRunState(score) {
  if (score === null) return 'Trace unavailable';
  if (score >= 0.95) return 'Passed the case-level judge';
  if (score >= 0.75) return 'Mostly complete with residual misses';
  if (score >= 0.45) return 'Partially complete';
  if (score === 0) return 'Failed judge verification';
  return 'Low-scoring artifact';
}

function resolveStageField(field, row, record, copy) {
  return typeof field === 'function' ? field(row, record, copy) : field;
}

function buildMissingTrajectory(row) {
  return [
    {
      kicker: 'Unavailable',
      title: 'No case-level trace block',
      detail: `${row.model} is present in the public leaderboard, but the qfgnGF case sheet does not include a per-case run block for this model.`,
      evidence: 'Feishu sheet qfgnGF contains no score/result/trajectory columns for this model on the selected case.',
      state: 'N/A',
    },
  ];
}

function getAttachedTrajectory(caseId, model) {
  return window.startupBenchCaseTraces?.[caseId]?.[model] || null;
}

function buildRunTrajectory(row, record, copy) {
  const attachedTrajectory = getAttachedTrajectory(copy.caseId, row.model);
  if (attachedTrajectory) return attachedTrajectory;

  return copy.trajectory.map((stage, index) => ({
    kicker: `Step ${index + 1}`,
    title: resolveStageField(stage.title, row, record, copy),
    detail: resolveStageField(stage.detail, row, record, copy),
    evidence: resolveStageField(stage.evidence, row, record, copy),
    state: resolveStageField(stage.state, row, record, copy),
  }));
}

function buildFeishuRuns(records, copy) {
  return caseModelData.map((row) => {
    const record = records[row.model];
    if (!record) {
      return {
        model: row.model,
        family: row.family,
        score: null,
        process: 'No case-level execution trace for this leaderboard model is included in Feishu sheet qfgnGF.',
        result: 'Not provided in qfgnGF.',
        error: 'No per-case judge score or failure point is available from the sheet.',
        trajectory: buildMissingTrajectory(row),
      };
    }

    return {
      model: row.model,
      family: row.family,
      score: record.score,
      process: `${copy.process} Trace: ${record.trace || 'not listed'}; judge: ${record.judge}.`,
      result: record.result,
      error: getCaseError(record.score, copy),
      trajectory: buildRunTrajectory(row, record, copy),
    };
  });
}

function getTrajectoryKind(step) {
  if (step.kind) {
    const kindMap = {
      user: { label: 'User', className: 'user' },
      assistant: { label: 'Assistant', className: 'assistant' },
      tool_call: { label: 'Tool Call', className: 'tool-call' },
      tool_result: { label: 'Tool Result', className: 'tool-result' },
      judge: { label: 'Judge', className: 'judge' },
      meta: { label: 'Meta', className: 'meta' },
    };
    if (kindMap[step.kind]) return kindMap[step.kind];
  }

  const title = `${step.title || ''} ${step.source || ''}`.toLowerCase();
  if (title.includes('tool call')) return { label: 'Tool Call', className: 'tool-call' };
  if (title.includes('tool result')) return { label: 'Tool Result', className: 'tool-result' };
  if (title.includes('user') || title.includes('task')) return { label: 'User', className: 'user' };
  if (title.includes('judge')) return { label: 'Judge', className: 'judge' };
  if (title.includes('metadata')) return { label: 'Meta', className: 'meta' };
  if (title.includes('assistant')) return { label: 'Assistant', className: 'assistant' };
  return { label: step.source || 'Event', className: 'event' };
}

const exampleCases = [
  {
    id: 'hr-payroll-feishu',
    title: 'HR Payroll And Talent Review Workbook',
    source: 'Feishu sheet qfgnGF | startUP-V1-002',
    domain: 'Business & Management',
    artifact: 'XLSX',
    failure: '34-rubric workbook grading',
    task:
      'As the HR director of Xingtu Information Technology, build a single 2024 payroll settlement and talent-review workbook from seven HR source sheets, including attendance cleaning, payroll details, performance calibration, talent matrix, department cost variance, and a management dashboard.',
    expected:
      'A 13-sheet XLSX in the required order, preserving the seven raw sheets and adding six analysis sheets with formula-driven payroll rows, tax calculations, talent-review outputs, dashboard KPIs, charts, filters, and cached values that the judge can verify.',
    errors: [
      'The judge checks exact workbook structure, including 13 sheets in a fixed order and 460-465 valid monthly payroll rows.',
      'Formula-backed values must match sampled payroll and tax checks, such as EMP001 January gross pay and December cumulative taxable income.',
      'Dashboard KPIs, charts, filters, formatting, and cached calculation states must remain verifiable after reopening the workbook.',
    ],
    process: [
      'Read the seven source sheets: roster, attendance, quarterly performance, salary adjustment, social insurance, tax rate, and department budget.',
      'Normalize employee IDs and month formats, then compute attendance deductions, overtime subsidy, payroll details, and cumulative tax fields.',
      'Generate performance calibration, nine-box talent review, department cost variance, and dashboard sheets as native Excel objects.',
      'Submit the XLSX and score it with rubric_judges.json against 34 case-specific rubric items.',
    ],
    runs: buildFeishuRuns({
      'GPT-5.5': feishuRun(1.0000, '星途信息2024年度薪酬汇算与人才盘点分析.xlsx'),
      'Seed-2.1-Pro': feishuRun(0.8037, '星途信息2024年度人事薪酬分析.xlsx', ''),
      'DeepSeek-V4-Pro': feishuRun(0.9252, '星途信息2024年度薪酬分析报告.xlsx'),
      'GLM-5.1': feishuRun(0.9252, '星途信息2024年度人事薪酬数据_分析完成.xlsx', 'cli_direct.jsonl'),
      'Kimi-K2.6': feishuRun(0.0000, '星途信息2024年度人事薪酬数据.xlsx'),
      'Qwen-3.6-Max': feishuRun(0.53271, '星途信息2024年度人事薪酬数据_分析完成.xlsx'),
      'Gemini-3.1-Pro': feishuRun(0.3832, '星途信息2024年度人事薪酬分析.xlsx'),
    }, {
      caseId: 'hr-payroll-feishu',
      trajectory: [
        {
          title: 'Task intake',
          detail: (row) => `${row.model} receives the HR director task and maps the requested output to a 13-sheet payroll and talent-review workbook.`,
          evidence: 'Prompt requires seven raw HR sheets plus six generated analysis/dashboard sheets.',
          state: 'Scope parsed',
        },
        {
          title: 'Data cleaning',
          detail: 'Normalize employee IDs, month formats, attendance records, salary-adjustment timing, social-insurance rates, and tax brackets before payroll calculation.',
          evidence: 'Rubric checks EMP-format normalization, monthly attendance rows, and valid payroll-row coverage.',
          state: 'Intermediate workbook state',
        },
        {
          title: 'Workbook assembly',
          detail: (row, record) => `${row.model} writes payroll detail, performance calibration, nine-box talent review, cost variance, dashboard KPIs, charts, filters, and formatting into ${record.result}.`,
          evidence: (row, record) => `Produced artifact: ${record.result}`,
          state: 'Artifact generated',
        },
        {
          title: 'Judge scoring',
          detail: (row, record) => `The artifact is evaluated by rubric_judges.json and receives ${formatCaseScore(record.score)} on this case.`,
          evidence: (row, record) => `Athlete trace: ${record.trace || 'not listed'}; judge file: ${record.judge}`,
          state: (row, record) => getRunState(record.score),
        },
        {
          title: 'Error localization',
          detail: (row, record, copy) => getCaseError(record.score, copy),
          evidence: 'Failure focus: sheet order, payroll-row count, cached formula values, KPI totals, charts, filters, and dashboard formatting.',
          state: (row, record) => (record.score >= 0.95 ? 'No visible failed point in qfgnGF' : 'Rubric misses remain'),
        },
      ],
      process: 'Built the payroll/talent-review workbook and handed the produced XLSX to the case judge.',
      full: 'No failed rubric item is visible in the case score; qfgnGF records a full 1.0000.',
      strong: 'Small gaps remain around exact cached values, dashboard verification, or workbook presentation checks.',
      partial: 'Core artifact is present, but formula-driven payroll rows, KPI checks, or sheet-level validation are incomplete.',
      weak: 'Major rubric misses remain in workbook completeness, calculation correctness, or judge-readable cached outputs.',
      zero: 'Judge score is 0.0000; the submitted workbook did not satisfy the case-level grading checks.',
    }),
  },
  {
    id: 'mall-operations-feishu',
    title: 'Shopping Mall Operating Review',
    source: 'Feishu sheet qfgnGF | startUP-V1-003',
    domain: 'Business & Management',
    artifact: 'XLSX',
    failure: 'Formula, pivot, and dashboard gaps',
    task:
      'As the operations GM of Jiahe Tiandi, produce a 2024 operating review and 2025 leasing-adjustment workbook for a 280,000 square-meter mall using eight source sheets covering tenants, sales, rent, traffic, membership, marketing, and peer benchmarks.',
    expected:
      'A single XLSX that preserves eight raw sheets and adds eight analysis/dashboard sheets for tenant cleaning, sales productivity, rent accounting, same-store sales growth, renewal risk, category mix, marketing ROI, and a management dashboard.',
    errors: [
      'The workbook must contain 16 sheets in the exact order while leaving the eight source sheets materially unchanged.',
      'Key calculations must use native Excel formulas, named ranges, pivots or pivot caches, charts, filters, and conditional formatting instead of static values.',
      'The dashboard needs KPI cards and formatting details that remain inspectable as native workbook objects.',
    ],
    process: [
      'Standardize 30 tenant IDs, floors, categories, contract data, monthly sales, rent bills, traffic, member consumption, marketing expenses, and peer metrics.',
      'Create sales productivity, rent, SSSG, renewal-risk, category-mix, marketing-ROI, and dashboard sheets without deleting the raw sheets.',
      'Check formulas, named ranges, pivot objects, charts, conditional formatting, sheet order, and KPI-card presentation.',
      'Submit the XLSX and score it with rubric_judges.json against 35 case-specific rubric items.',
    ],
    runs: buildFeishuRuns({
      'GPT-5.5': feishuRun(0.7429, '嘉禾天地购物中心2024年度经营复盘与2025招商调整分析.xlsx'),
      'Seed-2.1-Pro': feishuRun(0.8000, '嘉禾天地购物中心2024年度经营复盘.xlsx', ''),
      'DeepSeek-V4-Pro': feishuRun(0.5810, '嘉禾天地购物中心2024年度经营复盘分析.xlsx'),
      'GLM-5.1': feishuRun(0.7238, '嘉禾天地购物中心2024年度经营复盘分析.xlsx', 'cli_direct.jsonl'),
      'Kimi-K2.6': feishuRun(0.7238, '附件_嘉禾天地购物中心2024年度租户经营源数据.xlsx'),
      'Qwen-3.6-Max': feishuRun(0.67619, '嘉禾天地购物中心2024年度租户经营源数据.xlsx'),
      'Gemini-3.1-Pro': feishuRun(0.5524, '嘉禾天地2024年度经营复盘.xlsx / 嘉禾天地购物中心2024年度经营复盘.xlsx'),
    }, {
      caseId: 'mall-operations-feishu',
      trajectory: [
        {
          title: 'Task intake',
          detail: (row) => `${row.model} receives the mall GM task and maps the requested output to a 16-sheet operating review and leasing-adjustment workbook.`,
          evidence: 'Prompt requires eight preserved source sheets and eight new analysis/dashboard sheets.',
          state: 'Scope parsed',
        },
        {
          title: 'Tenant normalization',
          detail: 'Standardize tenant IDs, floors, category labels, contract fields, sales rows, rent bills, traffic records, membership data, and marketing costs.',
          evidence: 'Rubric checks raw-sheet preservation, tenant ID normalization, and cross-sheet consistency.',
          state: 'Data model assembled',
        },
        {
          title: 'Analysis build',
          detail: (row, record) => `${row.model} builds sales productivity, rent accounting, SSSG, renewal-risk, category-mix, marketing-ROI, and dashboard outputs in ${record.result}.`,
          evidence: (row, record) => `Produced artifact: ${record.result}`,
          state: 'Artifact generated',
        },
        {
          title: 'Native Excel checks',
          detail: 'The judge looks for formulas, named ranges, pivots or pivot caches, charts, filters, conditional formatting, and KPI-card styling rather than static tables only.',
          evidence: 'Rubric explicitly requires native Excel objects and workbook formatting checks.',
          state: 'Object-level validation',
        },
        {
          title: 'Judge scoring',
          detail: (row, record) => `rubric_judges.json scores the submitted workbook at ${formatCaseScore(record.score)}.`,
          evidence: (row, record) => `Athlete trace: ${record.trace || 'not listed'}; judge file: ${record.judge}`,
          state: (row, record) => getRunState(record.score),
        },
        {
          title: 'Error localization',
          detail: (row, record, copy) => getCaseError(record.score, copy),
          evidence: 'Failure focus: formula coverage, pivot/cache presence, source-sheet preservation, dashboard KPI cards, and visual formatting.',
          state: (row, record) => (record.score >= 0.95 ? 'No visible failed point in qfgnGF' : 'Rubric misses remain'),
        },
      ],
      process: 'Built the mall operating-review workbook and handed the produced XLSX to the case judge.',
      full: 'No failed rubric item is visible in the case score; the output is near-complete for this case.',
      strong: 'Most workbook structure is present, with remaining misses around native Excel objects or presentation details.',
      partial: 'The artifact is usable, but formula, pivot, dashboard, or source-preservation checks remain incomplete.',
      weak: 'Large parts of the workbook-level rubric are not satisfied, especially native Excel object or cross-sheet checks.',
    }),
  },
  {
    id: 'seismic-interpretation-feishu',
    title: 'Seismic Fault Interpretation',
    source: 'Feishu sheet qfgnGF | startUP-V1-005',
    domain: 'Engineering & Computer Science',
    artifact: 'DOCX + PNG',
    failure: 'Geoscience interpretation misses',
    task:
      'Interpret a 2D seismic time section for Line Z-2026-003, identify faults, horizons, unconformities, cutting relationships, tectonic phases, and flower structures, then deliver both an explanation report and an annotated seismic image.',
    expected:
      'A DOCX report plus PNG annotation that correctly marks the required faults and horizons, including right-dipping reverse fault F5, cutting relationships, phase assignments, two unconformities, and the negative flower structure.',
    errors: [
      'F5 must overlap the required CDP range [390, 520] and be long enough to count as a right-dipping reverse fault.',
      'The cutting matrix must include F4 cutting F3, F5 cutting F4, and F7 cutting F5, with phase assignment F1/F3/F4, F5/F2, and F6/F7.',
      'The report and annotated image must mark U1 near H3 at about 460 ms, U2 near H6 at about 890 ms, and the F6/F7 negative flower structure.',
    ],
    process: [
      'Read the seismic task brief, geological background, CDP/TWT coordinate constraints, and the input seismic image.',
      'Infer faults, horizons, unconformities, tectonic phases, and cutting relationships from reflection continuity and offsets.',
      'Produce the DOCX explanation report and PNG fault-annotation image.',
      'Submit both files and score them with rubric_judges.json against 11 case-specific rubric items.',
    ],
    runs: buildFeishuRuns({
      'GPT-5.5': feishuRun(0.3659, '地震剖面断层解释报告.docx / 地震剖面断层解释标注图.png'),
      'Seed-2.1-Pro': feishuRun(0.3659, '地震剖面断层解释报告.docx / 地震剖面断层解释标注图.png', ''),
      'DeepSeek-V4-Pro': feishuRun(0.2439, '地震剖面断层解释报告.docx / 地震剖面断层解释标注图.png'),
      'GLM-5.1': feishuRun(0.4390, 'startUP-V1-005_results.zip', 'cli_direct.jsonl'),
      'Kimi-K2.6': feishuRun(0.2439, '地震剖面断层解释报告.docx / 地震剖面断层解释标注图.png'),
      'Qwen-3.6-Max': feishuRun(0.243902, '地震剖面断层解释报告.docx / 地震剖面断层解释标注图.png'),
      'Gemini-3.1-Pro': feishuRun(0.1951, '地震剖面断层解释报告.docx / 地震剖面断层解释标注图.png'),
    }, {
      caseId: 'seismic-interpretation-feishu',
      trajectory: [
        {
          title: 'Task intake',
          detail: (row) => `${row.model} receives the Line Z-2026-003 seismic interpretation task and the required DOCX plus PNG deliverables.`,
          evidence: 'Prompt provides CDP range 100-600, TWT range 0-1500 ms, tectonic background, and interpretation targets.',
          state: 'Scope parsed',
        },
        {
          title: 'Image interpretation',
          detail: 'Infer reflector offsets, horizon continuity, fault dip direction, reverse/normal movement, flower-structure geometry, and unconformity positions.',
          evidence: 'Rubric checks F5, F4/F3/F5/F7 cutting relations, U1/U2, and the F6/F7 negative flower structure.',
          state: 'Geoscience reasoning',
        },
        {
          title: 'Report and annotation',
          detail: (row, record) => `${row.model} produces the requested interpretation files as ${record.result}.`,
          evidence: (row, record) => `Produced artifact: ${record.result}`,
          state: 'Artifact generated',
        },
        {
          title: 'Judge scoring',
          detail: (row, record) => `rubric_judges.json scores the submitted files at ${formatCaseScore(record.score)}.`,
          evidence: (row, record) => `Athlete trace: ${record.trace || 'not listed'}; judge file: ${record.judge}`,
          state: (row, record) => getRunState(record.score),
        },
        {
          title: 'Error localization',
          detail: (row, record, copy) => getCaseError(record.score, copy),
          evidence: 'Failure focus: right-dipping reverse fault F5, cutting matrix, tectonic phase assignment, U1/U2 placement, and negative flower annotation.',
          state: (row, record) => (record.score >= 0.95 ? 'No visible failed point in qfgnGF' : 'Rubric misses remain'),
        },
      ],
      process: 'Produced the seismic report and annotation files, then handed them to the case judge.',
      full: 'No failed rubric item is visible in the case score; the output is near-complete for this case.',
      strong: 'Most interpretation requirements are met, with remaining misses in exact geometry or annotation detail.',
      partial: 'Some files are generated, but fault geometry, cutting relations, or horizon/unconformity checks are incomplete.',
      weak: 'Major interpretation requirements are missed, especially F5, cutting relations, phase assignment, or U1/U2 annotation.',
    }),
  },
];

function updateHeader() {
  if (!header) return;
  header.classList.toggle('is-scrolled', window.scrollY > 12);
}

function formatScore(value) {
  return value.toFixed(2);
}

function formatCaseScore(value) {
  if (value === null || Number.isNaN(value)) return 'N/A';
  return value.toFixed(4);
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

function createCaseCard(example) {
  const isModalMode = caseBoard?.dataset.caseMode === 'modal';
  const article = document.createElement('article');
  article.className = 'case-card';
  article.classList.toggle('is-active', example.id === activeCaseId);
  if (isModalMode) {
    article.setAttribute('role', 'button');
    article.setAttribute('tabindex', '0');
  }

  const meta = document.createElement('span');
  meta.className = 'case-card-meta';
  meta.textContent = `${example.domain} / ${example.artifact}`;

  const title = document.createElement('h3');
  title.textContent = example.title;

  const failure = document.createElement('p');
  failure.textContent = example.failure;

  const scoredRuns = example.runs.filter((run) => run.score !== null && !Number.isNaN(run.score));
  const bestScore = scoredRuns.length ? Math.max(...scoredRuns.map((run) => run.score)) : null;
  const stats = document.createElement('div');
  stats.className = 'case-card-stats';
  stats.innerHTML = `
    <span><b>${example.runs.length}</b> model runs</span>
    <span><b>${formatCaseScore(bestScore)}</b> best score</span>
  `;

  const button = document.createElement('button');
  button.className = 'case-start';
  button.type = 'button';
  button.setAttribute('aria-pressed', String(example.id === activeCaseId));
  button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7L8 5Z" /></svg><span>Start</span>';
  button.addEventListener('click', () => {
    openCaseModal(example);
  });

  article.addEventListener('click', (event) => {
    if (!isModalMode || event.target.closest('button')) return;
    openCaseModal(example);
  });
  article.addEventListener('keydown', (event) => {
    if (!isModalMode || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    openCaseModal(example);
  });

  article.append(meta, title, failure, stats, button);
  return article;
}

function createChip(label) {
  const chip = document.createElement('span');
  chip.textContent = label;
  return chip;
}

function replaceTextList(node, tagName, items) {
  if (!node) return;
  node.replaceChildren(
    ...items.map((item) => {
      const child = document.createElement(tagName);
      child.textContent = item;
      return child;
    })
  );
}

function compactText(value, limit = 160) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= limit) return text;
  return `${text.slice(0, limit - 1).trim()}...`;
}

function getDefaultRun(example) {
  return example.runs.find((run) => run.score !== null) || example.runs[0];
}

function getActiveRun(example) {
  const selectedRun = example.runs.find((run) => run.model === activeRunModel);
  if (selectedRun) return selectedRun;
  const defaultRun = getDefaultRun(example);
  activeRunModel = defaultRun.model;
  return defaultRun;
}

function getActiveCase() {
  return exampleCases.find((example) => example.id === activeCaseId) || exampleCases[0];
}

function stopTrajectoryPlayback() {
  if (trajectoryTimer) window.clearInterval(trajectoryTimer);
  trajectoryTimer = null;
  isTrajectoryPlaying = false;
}

function openCaseModal(example) {
  if (!caseModal) return;
  stopTrajectoryPlayback();
  activeCaseId = example.id;
  activeRunModel = getDefaultRun(example).model;
  activeTrajectoryStep = 0;
  renderCases();
  caseModal.classList.add('is-open');
  document.body.classList.add('case-modal-open');
}

function closeCaseModal() {
  if (!caseModal) return;
  stopTrajectoryPlayback();
  caseModal.classList.remove('is-open');
  document.body.classList.remove('case-modal-open');
  renderCases();
}

function startTrajectoryPlayback() {
  stopTrajectoryPlayback();
  const activeCase = getActiveCase();
  const activeRun = getActiveRun(activeCase);
  const stepCount = activeRun.trajectory?.length || 0;
  if (stepCount <= 1) {
    renderTrajectory(activeCase);
    return;
  }

  if (activeTrajectoryStep >= stepCount - 1) activeTrajectoryStep = 0;
  isTrajectoryPlaying = true;
  renderTrajectory(activeCase);
  trajectoryTimer = window.setInterval(() => {
    const currentCase = getActiveCase();
    const currentRun = getActiveRun(currentCase);
    const currentStepCount = currentRun.trajectory?.length || 0;

    if (activeTrajectoryStep >= currentStepCount - 1) {
      stopTrajectoryPlayback();
      renderTrajectory(currentCase);
      return;
    }

    activeTrajectoryStep += 1;
    renderTrajectory(currentCase);
  }, trajectoryIntervalMs);
}

function toggleTrajectoryPlayback() {
  if (isTrajectoryPlaying) {
    stopTrajectoryPlayback();
    renderTrajectory(getActiveCase());
    return;
  }

  const activeCase = getActiveCase();
  const activeRun = getActiveRun(activeCase);
  const stepCount = activeRun.trajectory?.length || 0;
  if (stepCount <= 1) return;
  startTrajectoryPlayback();
}

function advanceTrajectory() {
  stopTrajectoryPlayback();
  const activeCase = getActiveCase();
  const activeRun = getActiveRun(activeCase);
  const stepCount = activeRun.trajectory?.length || 0;
  activeTrajectoryStep = stepCount ? Math.min(activeTrajectoryStep + 1, stepCount - 1) : 0;
  renderTrajectory(activeCase);
}

function createRunTab(run) {
  const button = document.createElement('button');
  button.className = 'case-run-tab';
  button.classList.toggle('is-active', run.model === activeRunModel);
  button.classList.toggle('is-muted', run.score === null);
  button.type = 'button';
  button.setAttribute('aria-pressed', String(run.model === activeRunModel));

  const label = document.createElement('strong');
  label.textContent = run.model;
  const meta = document.createElement('span');
  meta.textContent = `${run.family} / ${formatCaseScore(run.score)}`;
  button.append(label, meta);

  button.addEventListener('click', () => {
    stopTrajectoryPlayback();
    activeRunModel = run.model;
    activeTrajectoryStep = 0;
    renderCaseDetail(getActiveCase());
  });

  return button;
}

function createTrajectoryStep(step, index) {
  const item = document.createElement('li');
  const kind = getTrajectoryKind(step);
  const button = document.createElement('button');
  button.className = `trajectory-step-button ${kind.className}`;
  button.classList.toggle('is-active', index === activeTrajectoryStep);
  button.type = 'button';
  button.setAttribute('aria-pressed', String(index === activeTrajectoryStep));

  const kicker = document.createElement('span');
  kicker.textContent = step.kicker;
  const type = document.createElement('mark');
  type.textContent = kind.label;
  const title = document.createElement('strong');
  title.textContent = step.title;
  const preview = document.createElement('small');
  preview.textContent = compactText(step.detail, 150);
  const state = document.createElement('em');
  state.textContent = step.state;
  button.append(kicker, type, title, preview, state);

  button.addEventListener('click', () => {
    stopTrajectoryPlayback();
    activeTrajectoryStep = index;
    renderTrajectory(getActiveCase());
  });

  item.append(button);
  return item;
}

function keepActiveTrajectoryStepVisible() {
  if (!caseTrajectorySteps) return;
  const activeButton = caseTrajectorySteps.querySelector('.trajectory-step-button.is-active');
  if (!activeButton) return;

  const margin = 18;
  const containerRect = caseTrajectorySteps.getBoundingClientRect();
  const activeRect = activeButton.getBoundingClientRect();
  let nextScrollTop = caseTrajectorySteps.scrollTop;

  if (activeRect.top < containerRect.top + margin) {
    nextScrollTop += activeRect.top - containerRect.top - margin;
  } else if (activeRect.bottom > containerRect.bottom - margin) {
    nextScrollTop += activeRect.bottom - containerRect.bottom + margin;
  } else {
    return;
  }

  caseTrajectorySteps.scrollTo({
    top: Math.max(0, nextScrollTop),
    behavior: isTrajectoryPlaying ? 'smooth' : 'auto',
  });
}

function renderTrajectory(example) {
  if (
    !caseTrajectoryMeta ||
    !caseRunTabs ||
    !caseTrajectorySteps ||
    !trajectoryStepKicker ||
    !trajectoryStepType ||
    !trajectoryStepTitle ||
    !trajectoryStepDetail ||
    !trajectoryStepEvidence ||
    !trajectoryStepState ||
    !trajectoryStepSource ||
    !trajectoryPlay ||
    !trajectoryNext ||
    !trajectoryCounter ||
    !trajectoryProgress
  ) {
    return;
  }

  const activeRun = getActiveRun(example);
  const trajectory = activeRun.trajectory || [];
  activeTrajectoryStep = Math.min(activeTrajectoryStep, Math.max(trajectory.length - 1, 0));
  const activeStep = trajectory[activeTrajectoryStep];
  const progress = trajectory.length <= 1 ? 100 : (activeTrajectoryStep / (trajectory.length - 1)) * 100;
  const activeKind = activeStep ? getTrajectoryKind(activeStep) : { label: 'Event', className: 'event' };

  caseTrajectory?.classList.toggle('is-playing', isTrajectoryPlaying);
  caseTrajectoryMeta.textContent = `${activeRun.model} / ${trajectory.length} events / score ${formatCaseScore(activeRun.score)}`;
  trajectoryPlay.textContent = isTrajectoryPlaying ? 'Pause' : 'Play';
  trajectoryPlay.disabled = trajectory.length <= 1;
  trajectoryNext.disabled = trajectory.length <= 1 || activeTrajectoryStep >= trajectory.length - 1;
  trajectoryCounter.textContent = trajectory.length ? `Step ${activeTrajectoryStep + 1}/${trajectory.length}` : 'Step 0/0';
  trajectoryProgress.style.setProperty('--progress', `${progress}%`);
  caseRunTabs.replaceChildren(...example.runs.map(createRunTab));
  caseTrajectorySteps.replaceChildren(...trajectory.map(createTrajectoryStep));

  if (!activeStep) return;
  trajectoryStepKicker.textContent = activeStep.kicker;
  trajectoryStepType.textContent = activeKind.label;
  trajectoryStepType.className = `trajectory-kind ${activeKind.className}`;
  trajectoryStepTitle.textContent = activeStep.title;
  trajectoryStepDetail.textContent = activeStep.detail;
  trajectoryStepEvidence.textContent = activeStep.evidence;
  trajectoryStepState.textContent = activeStep.state;
  trajectoryStepSource.textContent = activeStep.source || activeKind.label;

  window.requestAnimationFrame(keepActiveTrajectoryStepVisible);
}

function createCaseModelField(label, text) {
  const field = document.createElement('div');
  field.className = 'case-model-field';
  const labelNode = document.createElement('span');
  labelNode.textContent = label;
  const valueNode = document.createElement('p');
  valueNode.textContent = text;
  field.append(labelNode, valueNode);
  return field;
}

function createCaseModelRow(run) {
  const row = document.createElement('article');
  const selectRun = () => {
    stopTrajectoryPlayback();
    activeRunModel = run.model;
    activeTrajectoryStep = 0;
    renderCaseDetail(getActiveCase());
  };

  row.className = 'case-model-row';
  row.classList.toggle('is-active', run.model === activeRunModel);
  row.setAttribute('role', 'button');
  row.setAttribute('tabindex', '0');
  row.setAttribute('aria-pressed', String(run.model === activeRunModel));
  row.addEventListener('click', selectRun);
  row.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    selectRun();
  });

  const model = document.createElement('div');
  model.className = 'case-model-identity';
  const modelName = document.createElement('strong');
  modelName.textContent = run.model;
  const family = document.createElement('span');
  family.textContent = run.family;
  model.append(modelName, family);

  const score = document.createElement('div');
  score.className = 'case-model-score';
  const scorePill = document.createElement('span');
  scorePill.className = 'case-score-pill';
  scorePill.classList.toggle('is-muted', run.score === null);
  scorePill.textContent = formatCaseScore(run.score);
  score.append(scorePill);

  row.append(
    model,
    score,
    createCaseModelField('Process', run.process),
    createCaseModelField('Result', run.result),
    createCaseModelField('Error point', run.error)
  );
  return row;
}

function renderCaseDetail(example) {
  if (!caseTitle || !caseSource || !caseChips || !caseTask || !caseExpected || !caseErrors || !caseProcess || !caseModels) return;
  if (caseModalTitle) caseModalTitle.textContent = example.title;
  if (caseModalSub) caseModalSub.textContent = `${example.source} / ${example.domain} / ${example.artifact}`;
  caseTitle.textContent = example.title;
  caseSource.textContent = example.source;
  caseChips.replaceChildren(createChip(example.domain), createChip(example.artifact), createChip(example.failure));
  caseTask.textContent = example.task;
  caseExpected.textContent = example.expected;
  replaceTextList(caseErrors, 'li', example.errors);
  replaceTextList(caseProcess, 'li', example.process);
  renderTrajectory(example);
  caseModels.replaceChildren(...example.runs.map(createCaseModelRow));
}

function renderCases() {
  if (!caseList) return;
  const activeCase = getActiveCase();
  activeCaseId = activeCase.id;
  caseList.replaceChildren(...exampleCases.map(createCaseCard));
  renderCaseDetail(activeCase);
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

trajectoryPlay?.addEventListener('click', toggleTrajectoryPlayback);
trajectoryNext?.addEventListener('click', advanceTrajectory);
caseModalClose?.addEventListener('click', closeCaseModal);
caseModal?.addEventListener('click', (event) => {
  if (event.target === caseModal) closeCaseModal();
});
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && caseModal?.classList.contains('is-open')) closeCaseModal();
});

updateHeader();
renderLeaderboard();
renderCases();
window.addEventListener('scroll', updateHeader, { passive: true });
