import nodemailer from 'nodemailer';
import PDFDocument from 'pdfkit';
import type { Logger } from 'pino';

import { ProjectReport } from '@/types';
import {
  ProjectComparisonReport,
  UrlComparisonResult,
  MetricChange,
  RegressionItem,
  DeterministicRecommendation,
} from './comparison/comparisonTypes';

// ── SMTP transporter ──────────────────────────────────────────────────────────
// SMTP_PASS must be a Gmail App Password (Google Account → Security → App Passwords).
// Plain account passwords are rejected by Google.

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// ── Design tokens ─────────────────────────────────────────────────────────────

const C = {
  coverBg:      '#0f172a',
  coverTitle:   '#f8fafc',
  coverMeta:    '#94a3b8',
  sectionBg:    '#f8fafc',
  chipBg:       '#f1f5f9',
  cardBorder:   '#e2e8f0',
  heading:      '#0f172a',
  body:         '#374151',
  muted:        '#6b7280',
  good:         '#16a34a',
  warn:         '#d97706',
  bad:          '#dc2626',
  critical:     '#9f1239',
  neutral:      '#4b5563',
  highBg:       '#fff1f2',
  highBorder:   '#fda4af',
  highText:     '#9f1239',
  medBg:        '#fffbeb',
  medBorder:    '#fcd34d',
  medText:      '#92400e',
  lowBg:        '#f0fdf4',
  lowBorder:    '#86efac',
  lowText:      '#166534',
  scoreBandGood:'#dcfce7',
  scoreBandWarn:'#fef9c3',
  scoreBandBad: '#fee2e2',
} as const;

const MARGIN       = 48;
const PAGE_W       = 595.28;
const PAGE_H       = 841.89;
const CONTENT_W    = PAGE_W - MARGIN * 2;
const FOOTER_Y     = PAGE_H - 28;
const BOTTOM_LIMIT = FOOTER_Y - 16;

// ── Metric thresholds (CWV spec) ──────────────────────────────────────────────

interface MetricDisplay { label: string; unit: string; good: number; poor: number; }

const METRIC_DISPLAY: Record<string, MetricDisplay> = {
  lcp:        { label: 'Largest Contentful Paint', unit: 'ms', good: 2500,  poor: 4000  },
  cls:        { label: 'Cumulative Layout Shift',  unit: '',   good: 0.1,   poor: 0.25  },
  inpOrTbt:   { label: 'INP / Total Blocking Time',unit: 'ms', good: 200,   poor: 500   },
  fcp:        { label: 'First Contentful Paint',   unit: 'ms', good: 1800,  poor: 3000  },
  speedIndex: { label: 'Speed Index',              unit: 'ms', good: 3400,  poor: 5800  },
  ttfb:       { label: 'Time to First Byte',       unit: 'ms', good: 800,   poor: 1800  },
};

// ── Value formatting ──────────────────────────────────────────────────────────

function roundVal(val: number): number {
  return Math.round(val * 100) / 100;
}

/**
 * Format a metric value for display.
 * - Rounds to 2dp to eliminate floating-point garbage (2233.4999... → 2233.50)
 * - Auto-converts to seconds when ≥ 10 000ms (33476ms → 33.5s)
 * - CLS has no unit suffix
 */
function fmtVal(val: number | null, unit: string): string {
  if (val === null) return 'N/A';
  const r = roundVal(val);
  if (unit === 'ms' && r >= 10_000) return `${(r / 1000).toFixed(1)}s`;
  if (unit === 'ms') return `${r} ms`;
  if (unit === '') return String(r);
  return `${r}${unit}`;
}

/**
 * Format a delta value.
 * Keeps sign explicit (+/-), converts large ms to seconds, appends % in parens.
 * Delta and percentage are on the same line — no mid-value line breaks.
 */
function fmtDelta(delta: number | null, unit: string, pct: number | null): string {
  if (delta === null) return '—';
  const r    = roundVal(delta);
  const sign = r > 0 ? '+' : '';
  let valStr: string;
  if (unit === 'ms' && Math.abs(r) >= 10_000) {
    valStr = `${sign}${(r / 1000).toFixed(1)}s`;
  } else if (unit === 'ms') {
    valStr = `${sign}${r} ms`;
  } else {
    valStr = `${sign}${r}${unit}`;
  }
  if (pct === null) return valStr;
  const pctR = Math.round(pct * 10) / 10;
  return `${valStr} (${pct > 0 ? '+' : ''}${pctR}%)`;
}

function scoreColor(score: number | null): string {
  if (score === null) return C.muted;
  if (score >= 90) return C.good;
  if (score >= 50) return C.warn;
  return C.bad;
}

function scoreBandBg(score: number | null): string {
  if (score === null) return C.chipBg;
  if (score >= 90) return C.scoreBandGood;
  if (score >= 50) return C.scoreBandWarn;
  return C.scoreBandBad;
}

function metricColor(key: string, val: number | null): string {
  if (val === null) return C.muted;
  const cfg = METRIC_DISPLAY[key];
  if (!cfg) return C.body;
  return val <= cfg.good ? C.good : val <= cfg.poor ? C.warn : C.bad;
}

function statusColor(status: MetricChange['status']): string {
  return status === 'improved' ? C.good
    : status === 'critical'   ? C.critical
    : status === 'regressed'  ? C.bad
    : C.neutral;
}

function statusArrow(status: MetricChange['status']): string {
  return status === 'improved' ? '▲' : status === 'critical' ? '▼▼' : status === 'regressed' ? '▼' : '—';
}

/** Strip `[text](url)` markdown links → `text` for clean PDF output. */
function stripMdLinks(text: string): string {
  return text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
}

/** Strip `**bold**` markers. */
function stripMdBold(text: string): string {
  return text.replace(/\*\*([^*]+)\*\*/g, '$1');
}

// ── Layout helpers ────────────────────────────────────────────────────────────

function ensureSpace(doc: PDFKit.PDFDocument, needed: number): void {
  if (doc.y + needed > BOTTOM_LIMIT) {
    doc.addPage();
    doc.y = MARGIN + 8;
  }
}

function hRule(doc: PDFKit.PDFDocument, color: string = C.cardBorder, weight = 0.5): void {
  doc.save()
    .strokeColor(color).lineWidth(weight)
    .moveTo(MARGIN, doc.y).lineTo(MARGIN + CONTENT_W, doc.y)
    .stroke().restore();
  doc.y += 10;
}

function sectionHeading(doc: PDFKit.PDFDocument, title: string): void {
  ensureSpace(doc, 30);
  doc.y += 4;
  doc.font('Helvetica-Bold').fontSize(8).fillColor(C.muted)
    .text(title.toUpperCase(), MARGIN, doc.y, { characterSpacing: 0.7 });
  doc.y += 5;
  hRule(doc, '#cbd5e1', 1);
}

/** Small pill / chip: fills a rect then writes text inside. */
function drawChip(
  doc: PDFKit.PDFDocument,
  text: string,
  x: number,
  y: number,
  bg: string,
  fg: string,
): number {
  const PAD = 5;
  const H   = 14;
  doc.fontSize(7);
  const w = doc.widthOfString(text) + PAD * 2;
  doc.save().rect(x, y, w, H).fill(bg).restore();
  doc.font('Helvetica-Bold').fontSize(7).fillColor(fg)
    .text(text, x + PAD, y + 3.5, { lineBreak: false });
  return w; // return chip width so caller can chain them
}

// ── Cover ──────────────────────────────────────────────────────────────────────

function renderCover(doc: PDFKit.PDFDocument, projectReport: ProjectReport): void {
  doc.save().rect(0, 0, PAGE_W, 130).fill(C.coverBg).restore();
  doc.save().rect(0, 0, 4, 130).fill('#3b82f6').restore();

  doc.font('Helvetica-Bold').fontSize(18).fillColor(C.coverTitle)
    .text('Weekly Performance Intelligence', MARGIN, 30, { width: CONTENT_W });

  doc.font('Helvetica').fontSize(10).fillColor(C.coverMeta)
    .text(
      `${projectReport.projectTitle}  ·  ${projectReport.environment}  ·  ${new Date().toDateString()}`,
      MARGIN, 58,
    );

  doc.font('Helvetica').fontSize(9).fillColor('#64748b')
    .text(`Owner: ${projectReport.owner}`, MARGIN, 78);

  doc.y = 148;
}

// ── Score grid ──────────────────────────────────────────────────────────────────

function renderScoreGrid(
  doc: PDFKit.PDFDocument,
  perf: number | null,
  a11y: number | null,
  seo:  number | null,
  bp:   number | null,
): void {
  sectionHeading(doc, 'Lighthouse Scores');
  ensureSpace(doc, 72);

  const scores = [
    { label: 'Performance',    val: perf },
    { label: 'Accessibility',  val: a11y },
    { label: 'SEO',            val: seo  },
    { label: 'Best Practices', val: bp   },
  ];

  const colW   = CONTENT_W / 4;
  const cellH  = 68;
  const PAD    = 4;
  const startY = doc.y;

  scores.forEach(({ label, val }, i) => {
    const x = MARGIN + i * colW + PAD;
    const w = colW - PAD * 2;

    doc.save().rect(x, startY, w, cellH).fill(scoreBandBg(val)).restore();

    doc.font('Helvetica-Bold').fontSize(30).fillColor(scoreColor(val))
      .text(val !== null ? String(val) : '—', x, startY + 6, { width: w, align: 'center', lineBreak: false });

    doc.font('Helvetica').fontSize(8).fillColor(C.body)
      .text(label, x, startY + 44, { width: w, align: 'center', lineBreak: false });

    const rating = val === null ? '' : val >= 90 ? 'Good' : val >= 50 ? 'Needs work' : 'Poor';
    doc.font('Helvetica').fontSize(7).fillColor(scoreColor(val))
      .text(rating, x, startY + 56, { width: w, align: 'center', lineBreak: false });
  });

  doc.y = startY + cellH + 14;
}

// ── CWV table ───────────────────────────────────────────────────────────────────

interface VitalRow {
  key:    string;
  label:  string;
  val:    number | null;
  unit:   string;
  change?: MetricChange;
}

function renderVitalsTable(doc: PDFKit.PDFDocument, rows: VitalRow[]): void {
  sectionHeading(doc, 'Core Web Vitals');
  ensureSpace(doc, rows.length * 22 + 26);

  // Column x positions
  const COL = {
    metric:  MARGIN,
    current: MARGIN + 130,
    prev:    MARGIN + 220,
    delta:   MARGIN + 310,
    status:  MARGIN + CONTENT_W - 52,
  };

  // Header row
  doc.save().rect(MARGIN, doc.y, CONTENT_W, 18).fill(C.chipBg).restore();
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor(C.muted);
  (['METRIC', 'CURRENT', 'PREVIOUS', 'CHANGE', 'STATUS'] as const).forEach((h, i) => {
    const xs = [COL.metric + 6, COL.current, COL.prev, COL.delta, COL.status];
    doc.text(h, xs[i], doc.y + 5, { lineBreak: false });
  });
  doc.y += 18;

  rows.forEach(({ key, label, val, unit, change }, idx) => {
    ensureSpace(doc, 22);
    const rowY  = doc.y;
    const rowBg = idx % 2 === 0 ? '#ffffff' : C.sectionBg;
    doc.save().rect(MARGIN, rowY, CONTENT_W, 20).fill(rowBg).restore();

    const vColor = metricColor(key, val);
    const dStr   = change ? fmtDelta(change.delta, change.unit, change.percentage) : '—';
    const pStr   = change ? fmtVal(change.previous, unit) : '—';
    const dColor = change ? statusColor(change.status) : C.muted;
    const arrow  = change ? statusArrow(change.status) : '—';
    const aColor = change ? statusColor(change.status) : C.muted;

    doc.font('Helvetica').fontSize(8.5).fillColor(C.body)
      .text(label, COL.metric + 6, rowY + 6, { lineBreak: false });
    doc.font('Helvetica-Bold').fontSize(9).fillColor(vColor)
      .text(fmtVal(val, unit), COL.current, rowY + 6, { lineBreak: false });
    doc.font('Helvetica').fontSize(8.5).fillColor(C.muted)
      .text(pStr, COL.prev, rowY + 6, { lineBreak: false });
    doc.font('Helvetica').fontSize(8.5).fillColor(dColor)
      .text(dStr, COL.delta, rowY + 6, { width: COL.status - COL.delta - 6, lineBreak: false });
    doc.font('Helvetica-Bold').fontSize(9).fillColor(aColor)
      .text(arrow, COL.status, rowY + 6, { lineBreak: false });

    doc.y = rowY + 20;
  });

  doc.save().strokeColor(C.cardBorder).lineWidth(0.5)
    .moveTo(MARGIN, doc.y).lineTo(MARGIN + CONTENT_W, doc.y).stroke().restore();
  doc.y += 14;
}

// ── Regressions ──────────────────────────────────────────────────────────────

function renderRegressions(doc: PDFKit.PDFDocument, items: RegressionItem[]): void {
  if (!items.length) return;
  sectionHeading(doc, 'Regressions Detected');

  const bgMap  = { high: C.highBg,     medium: C.medBg,     low: C.lowBg     } as const;
  const bdMap  = { high: C.highBorder, medium: C.medBorder, low: C.lowBorder } as const;
  const fgMap  = { high: C.highText,   medium: C.medText,   low: C.lowText   } as const;

  for (const r of items) {
    const bg = bgMap[r.severity];
    const bd = bdMap[r.severity];
    const fg = fgMap[r.severity];

    doc.fontSize(9);
    const msgH  = doc.heightOfString(r.message, { width: CONTENT_W - 24 });
    const cardH = Math.max(40, msgH + 26);

    ensureSpace(doc, cardH + 8);
    const cardY = doc.y;

    doc.save().rect(MARGIN, cardY, CONTENT_W, cardH).fill(bg).restore();
    doc.save().rect(MARGIN, cardY, 3, cardH).fill(bd).restore();

    // Chips
    let chipX = MARGIN + 10;
    const svW = drawChip(doc, r.severity.toUpperCase(), chipX, cardY + 6, bd, fg);
    chipX += svW + 5;
    drawChip(doc, `${r.confidence.toUpperCase()} CONFIDENCE`, chipX, cardY + 6, C.chipBg, C.muted);

    doc.font('Helvetica').fontSize(9).fillColor(C.body)
      .text(r.message, MARGIN + 10, cardY + 23, { width: CONTENT_W - 20 });

    doc.y = cardY + cardH + 6;
  }

  doc.y += 4;
}

// ── Improvements ─────────────────────────────────────────────────────────────

function renderImprovements(doc: PDFKit.PDFDocument, items: Array<{ message: string }>): void {
  if (!items.length) return;
  sectionHeading(doc, 'Improvements');

  for (const item of items) {
    ensureSpace(doc, 20);
    const lineY = doc.y;
    doc.font('Helvetica-Bold').fontSize(9).fillColor(C.good)
      .text('✓', MARGIN, lineY, { lineBreak: false, width: 14 });
    doc.font('Helvetica').fontSize(9).fillColor(C.body)
      .text(item.message, MARGIN + 16, lineY, { width: CONTENT_W - 16 });
    doc.y += 4;
  }
  doc.y += 6;
}

// ── Recommendations ───────────────────────────────────────────────────────────

function renderRecommendations(doc: PDFKit.PDFDocument, recs: DeterministicRecommendation[]): void {
  if (!recs.length) return;
  sectionHeading(doc, 'Recommendations');

  const fgMap = { high: C.highText, medium: C.medText, low: C.lowText } as const;
  const bgMap = { high: C.highBg,   medium: C.medBg,   low: C.lowBg   } as const;

  recs.forEach((rec, idx) => {
    const fg = fgMap[rec.priority];
    const bg = bgMap[rec.priority];

    ensureSpace(doc, 28 + rec.suggestedFixes.length * 16);

    // Issue header
    doc.save().rect(MARGIN, doc.y, CONTENT_W, 22).fill(bg).restore();
    const headerY = doc.y;
    doc.font('Helvetica-Bold').fontSize(9).fillColor(fg)
      .text(`${idx + 1}.`, MARGIN + 8, headerY + 7, { lineBreak: false, width: 18 });
    doc.fillColor(C.heading)
      .text(rec.issue, MARGIN + 26, headerY + 7, { width: CONTENT_W - 32, lineBreak: false });
    doc.y = headerY + 22 + 4;

    // Fix bullets
    for (const fix of rec.suggestedFixes) {
      ensureSpace(doc, 18);
      const fixY = doc.y;
      doc.font('Helvetica').fontSize(8).fillColor(C.muted)
        .text('·', MARGIN + 24, fixY, { lineBreak: false, width: 10 });
      doc.font('Helvetica').fontSize(8.5).fillColor(C.body)
        .text(fix, MARGIN + 34, fixY, { width: CONTENT_W - 40 });
      doc.y += 2;
    }

    doc.y += 10;
  });
}

// ── Opportunities ─────────────────────────────────────────────────────────────

function renderOpportunities(doc: PDFKit.PDFDocument, opps: Array<{
  title: string;
  description: string;
  savingsMs?: number;
  savingsBytes?: number;
}>): void {
  if (!opps.length) return;
  sectionHeading(doc, 'Optimization Opportunities');

  opps.forEach((opp, idx) => {
    const cleanDesc = stripMdLinks(opp.description);

    doc.fontSize(8.5);
    const descH = doc.heightOfString(cleanDesc, { width: CONTENT_W - 16 });
    ensureSpace(doc, 22 + descH + 8);

    const titleY = doc.y;

    // Title
    doc.font('Helvetica-Bold').fontSize(9).fillColor(C.heading)
      .text(`${idx + 1}.  ${opp.title}`, MARGIN, titleY, { width: CONTENT_W - 100, lineBreak: false });

    // Savings chips — right-aligned
    let chipRight = MARGIN + CONTENT_W;
    if (opp.savingsBytes) {
      const label = `−${Math.round(opp.savingsBytes / 1024)} KB`;
      const cw    = doc.widthOfString(label) + 12;
      chipRight  -= cw + 4;
      drawChip(doc, label, chipRight, titleY, C.lowBg, C.lowText);
    }
    if (opp.savingsMs) {
      const label = `−${opp.savingsMs} ms`;
      const cw    = doc.widthOfString(label) + 12;
      chipRight  -= cw + 4;
      drawChip(doc, label, chipRight, titleY, C.lowBg, C.lowText);
    }

    doc.y = titleY + 14;
    doc.font('Helvetica').fontSize(8.5).fillColor(C.muted)
      .text(cleanDesc, MARGIN + 14, doc.y, { width: CONTENT_W - 16 });
    doc.y += 10;
  });
}

// ── AI text block (summary / insight) ─────────────────────────────────────────

function renderAiBlock(doc: PDFKit.PDFDocument, title: string, rawText: string): void {
  sectionHeading(doc, title);

  for (const line of rawText.split('\n')) {
    const clean = stripMdBold(stripMdLinks(line.trim()));
    if (!clean) { doc.y += 4; continue; }

    ensureSpace(doc, 18);

    if (clean.startsWith('## ')) {
      doc.font('Helvetica-Bold').fontSize(9.5).fillColor(C.heading)
        .text(clean.slice(3), MARGIN, doc.y, { width: CONTENT_W });
      doc.y += 2;
    } else if (clean.startsWith('# ')) {
      doc.font('Helvetica-Bold').fontSize(10.5).fillColor(C.heading)
        .text(clean.slice(2), MARGIN, doc.y, { width: CONTENT_W });
      doc.y += 2;
    } else if (/^\d+\./.test(clean)) {
      doc.font('Helvetica').fontSize(9).fillColor(C.body)
        .text(clean, MARGIN + 8, doc.y, { width: CONTENT_W - 8 });
      doc.y += 2;
    } else if (/^[-*•]/.test(clean)) {
      const content = clean.replace(/^[-*•]\s*/, '');
      doc.font('Helvetica').fontSize(8.5).fillColor(C.muted)
        .text('•', MARGIN + 8, doc.y, { lineBreak: false, width: 10 });
      doc.font('Helvetica').fontSize(8.5).fillColor(C.body)
        .text(`  ${content}`, MARGIN + 18, doc.y, { width: CONTENT_W - 22 });
      doc.y += 2;
    } else {
      doc.font('Helvetica').fontSize(9).fillColor(C.body)
        .text(clean, MARGIN, doc.y, { width: CONTENT_W, lineGap: 1.5 });
      doc.y += 3;
    }
  }

  doc.y += 8;
}

// ── URL section header ────────────────────────────────────────────────────────

function renderUrlHeader(
  doc: PDFKit.PDFDocument,
  urlReport: { url: string; pageType: string; status: string },
): void {
  ensureSpace(doc, 50);

  doc.save().rect(MARGIN, doc.y, CONTENT_W, 32).fill(C.coverBg).restore();
  doc.save().rect(MARGIN, doc.y, 3, 32).fill('#3b82f6').restore();

  const headerY = doc.y;

  doc.font('Helvetica-Bold').fontSize(10).fillColor('#f8fafc')
    .text(urlReport.pageType.toUpperCase(), MARGIN + 12, headerY + 5, { lineBreak: false });
  doc.font('Helvetica').fontSize(9).fillColor('#94a3b8')
    .text(`  —  ${urlReport.url}`, { continued: false, lineBreak: false });

  const statusOk  = urlReport.status === 'success';
  doc.font('Helvetica').fontSize(7.5).fillColor(statusOk ? C.good : C.bad)
    .text(statusOk ? '✓ Audit passed' : '✗ Audit failed', MARGIN + 12, headerY + 20);

  doc.y = headerY + 40;
}

// ── Page footers ──────────────────────────────────────────────────────────────

function stampFooters(doc: PDFKit.PDFDocument, projectTitle: string): void {
  const range = (doc as any).bufferedPageRange() as { start: number; count: number };
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    doc.save().strokeColor(C.cardBorder).lineWidth(0.5)
      .moveTo(MARGIN, FOOTER_Y - 8)
      .lineTo(MARGIN + CONTENT_W, FOOTER_Y - 8)
      .stroke().restore();
    doc.font('Helvetica').fontSize(7.5).fillColor(C.muted)
      .text(
        `${projectTitle}  ·  Weekly Lighthouse Monitoring  ·  Page ${i + 1} of ${range.count}`,
        MARGIN, FOOTER_Y,
        { width: CONTENT_W, align: 'center' },
      );
  }
}

// ── Main PDF builder ──────────────────────────────────────────────────────────

function buildPdf(
  projectReport: ProjectReport,
  comparisonReport: ProjectComparisonReport,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size:          'A4',
      margin:        MARGIN,
      bufferPages:   true,
      autoFirstPage: true,
      info: {
        Title:   `Weekly Performance Report — ${projectReport.projectTitle}`,
        Author:  'Weekly Lighthouse Monitoring',
        Creator: 'Weekly Lighthouse Monitoring',
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data',  (c: Buffer) => chunks.push(c));
    doc.on('end',   () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    renderCover(doc, projectReport);

    const urlComparisons = new Map<string, UrlComparisonResult>(
      comparisonReport.urls.map((u) => [u.url, u]),
    );

    for (const urlReport of projectReport.urls) {
      const comp = urlComparisons.get(urlReport.url);

      renderUrlHeader(doc, urlReport);

      renderScoreGrid(
        doc,
        urlReport.performanceScore,
        urlReport.accessibilityScore,
        urlReport.seoScore,
        urlReport.bestPracticesScore,
      );

      const cwv = urlReport.coreWebVitals;
      if (cwv) {
        const rows: VitalRow[] = [
          { key: 'lcp',        label: 'Largest Contentful Paint',  val: cwv.lcp,        unit: 'ms', change: comp?.metrics?.lcp },
          { key: 'cls',        label: 'Cumulative Layout Shift',   val: cwv.cls,        unit: '',   change: comp?.metrics?.cls },
          { key: 'inpOrTbt',   label: 'INP / Total Blocking Time', val: cwv.inpOrTbt,   unit: 'ms', change: comp?.metrics?.inpOrTbt },
          { key: 'fcp',        label: 'First Contentful Paint',    val: cwv.fcp,        unit: 'ms', change: comp?.metrics?.fcp },
          { key: 'speedIndex', label: 'Speed Index',               val: cwv.speedIndex, unit: 'ms' },
          { key: 'ttfb',       label: 'Time to First Byte',        val: cwv.ttfb,       unit: 'ms', change: comp?.metrics?.ttfb },
        ];
        renderVitalsTable(doc, rows);
      }

      if (comp?.regressions?.length)     renderRegressions(doc, comp.regressions);
      if (comp?.improvements?.length)    renderImprovements(doc, comp.improvements);
      if (comp?.recommendations?.length) renderRecommendations(doc, comp.recommendations);
      if (urlReport.opportunities?.length) renderOpportunities(doc, urlReport.opportunities);
      if (urlReport.aiSummary)  renderAiBlock(doc, 'AI Engineering Summary', urlReport.aiSummary);
      if (comp?.aiInsight)      renderAiBlock(doc, 'AI Weekly Insight', comp.aiInsight);

      const isLast = urlReport === projectReport.urls[projectReport.urls.length - 1];
      if (!isLast) doc.addPage();
    }

    stampFooters(doc, projectReport.projectTitle);
    doc.end();
  });
}

// ── Public sendReportEmail ────────────────────────────────────────────────────

export const sendReportEmail = async (
  to: string,
  projectReport: ProjectReport,
  log: Logger,
  comparisonReport?: ProjectComparisonReport,
): Promise<void> => {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    log.warn('SMTP_USER or SMTP_PASS not configured — skipping email');
    return;
  }

  if (!comparisonReport) {
    log.warn('No comparison report — skipping email');
    return;
  }

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await buildPdf(projectReport, comparisonReport);
    log.info({ bytes: pdfBuffer.length }, 'PDF generated');
  } catch (err) {
    log.error({ err }, 'PDF generation failed — skipping email');
    return;
  }

  const date     = new Date().toISOString().slice(0, 10);
  const slug     = projectReport.projectTitle.replace(/\s+/g, '-').toLowerCase();
  const filename = `${slug}-performance-report-${date}.pdf`;
  const subject  = `Weekly Performance Digest: ${projectReport.projectTitle}`;

  const htmlBody = `
    <div style="font-family:-apple-system,sans-serif;color:#1e293b;max-width:560px;margin:0 auto;">
      <div style="background:#0f172a;padding:28px 32px;border-left:4px solid #3b82f6;">
        <h2 style="color:#f8fafc;margin:0 0 6px;font-size:18px;">Weekly Performance Report</h2>
        <p style="color:#94a3b8;margin:0;font-size:13px;">${projectReport.projectTitle} · ${projectReport.environment}</p>
      </div>
      <div style="padding:24px 32px;background:#f8fafc;">
        <table style="width:100%;border-collapse:collapse;font-size:13px;color:#374151;">
          <tr><td style="padding:5px 0;color:#6b7280;">Project</td>     <td style="padding:5px 0;font-weight:600;">${projectReport.projectTitle}</td></tr>
          <tr><td style="padding:5px 0;color:#6b7280;">Environment</td> <td style="padding:5px 0;">${projectReport.environment}</td></tr>
          <tr><td style="padding:5px 0;color:#6b7280;">Owner</td>       <td style="padding:5px 0;">${projectReport.owner}</td></tr>
          <tr><td style="padding:5px 0;color:#6b7280;">Date</td>        <td style="padding:5px 0;">${new Date().toDateString()}</td></tr>
          <tr><td style="padding:5px 0;color:#6b7280;">URLs audited</td><td style="padding:5px 0;">${projectReport.urls.length}</td></tr>
        </table>
        <p style="font-size:13px;color:#374151;margin:16px 0 0;">Full performance intelligence report attached as PDF.</p>
      </div>
      <div style="padding:14px 32px;border-top:1px solid #e2e8f0;">
        <p style="color:#94a3b8;font-size:11px;margin:0;">Generated by Weekly Lighthouse Monitoring</p>
      </div>
    </div>`;

  try {
    const info = await transporter.sendMail({
      from:    `"Lighthouse Monitoring" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html:    htmlBody,
      text:    `Weekly Performance Digest: ${projectReport.projectTitle}\n\nSee attached PDF.`,
      attachments: [{ filename, content: pdfBuffer, contentType: 'application/pdf' }],
    });
    log.info({ messageId: info.messageId, to, filename }, 'Performance report emailed');
  } catch (err) {
    log.error({ err, to }, 'Failed to send performance report email');
  }
};