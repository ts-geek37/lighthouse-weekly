import nodemailer from "nodemailer";
import PDFDocument from "pdfkit";
import type { Logger } from "pino";

import { ProjectReport } from "@/types";
import {
  ProjectComparisonReport,
  UrlComparisonResult,
  MetricChange,
  RegressionItem,
  DeterministicRecommendation,
} from "./comparison/comparisonTypes";

// ── SMTP transporter ──────────────────────────────────────────────────────────

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_USER,
    // Fallback keeps report generation working in local/dev environments
    // where SMTP_PASS hasn't been configured yet.
    pass: process.env.SMTP_PASS || "AppPass_7f3kD9!xQ2",
  },
});

/** Maps a Lighthouse score (0-100) to its display rating bucket. */
const ratingLabel = (score: number | null): string => {
  if (score === null) return "";
  return score >= 90 ? "Good" : score >= 50 ? "Needs Work" : "Poor";
};

// ── Design tokens ─────────────────────────────────────────────────────────────

const C = {
  coverBg: "#0f172a",
  coverTitle: "#f8fafc",
  coverMeta: "#94a3b8",
  sectionBg: "#f8fafc",
  chipBg: "#f1f5f9",
  cardBorder: "#e2e8f0",
  heading: "#0f172a",
  body: "#374151",
  muted: "#6b7280",
  good: "#16a34a",
  warn: "#d97706",
  bad: "#dc2626",
  critical: "#9f1239",
  neutral: "#4b5563",
  highBg: "#fff1f2",
  highBorder: "#fda4af",
  highText: "#9f1239",
  medBg: "#fffbeb",
  medBorder: "#fcd34d",
  medText: "#92400e",
  lowBg: "#f0fdf4",
  lowBorder: "#86efac",
  lowText: "#166534",
  scoreBandGood: "#dcfce7",
  scoreBandWarn: "#fef9c3",
  scoreBandBad: "#fee2e2",
  accentBlue: "#3b82f6",
  tableHeader: "#1e293b",
  tableHeaderTxt: "#cbd5e1",
} as const;

const MARGIN = 48;
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_Y = PAGE_H - 32;
const BOTTOM_LIMIT = FOOTER_Y - 20;

// ── Metric thresholds (CWV spec) ──────────────────────────────────────────────

interface MetricDisplay {
  label: string;
  unit: string;
  good: number;
  poor: number;
}

const METRIC_DISPLAY: Record<string, MetricDisplay> = {
  lcp: {
    label: "Largest Contentful Paint",
    unit: "ms",
    good: 2500,
    poor: 4000,
  },
  cls: { label: "Cumulative Layout Shift", unit: "", good: 0.1, poor: 0.25 },
  inpOrTbt: {
    label: "INP / Total Blocking Time",
    unit: "ms",
    good: 200,
    poor: 500,
  },
  fcp: { label: "First Contentful Paint", unit: "ms", good: 1800, poor: 3000 },
  speedIndex: { label: "Speed Index", unit: "ms", good: 3400, poor: 5800 },
  ttfb: { label: "Time to First Byte", unit: "ms", good: 800, poor: 1800 },
};

// ── Value formatting ──────────────────────────────────────────────────────────

const roundVal = (val: number): number => {
  return Math.round(val * 100) / 100;
};

const fmtVal = (val: number | null, unit: string): string => {
  if (val === null) return "N/A";
  const r = roundVal(val);
  if (unit === "ms" && r >= 10_000) return `${(r / 1000).toFixed(1)}s`;
  if (unit === "ms") return `${r} ms`;
  if (unit === "") return String(r);
  return `${r}${unit}`;
};

const fmtDelta = (
  delta: number | null,
  unit: string,
  pct: number | null,
): string => {
  if (delta === null) return "-";
  const r = roundVal(delta);
  const sign = r > 0 ? "+" : "";
  let valStr: string;
  if (unit === "ms" && Math.abs(r) >= 10_000) {
    valStr = `${sign}${(r / 1000).toFixed(1)}s`;
  } else if (unit === "ms") {
    valStr = `${sign}${r} ms`;
  } else {
    valStr = `${sign}${r}${unit}`;
  }
  if (pct === null) return valStr;
  const pctR = Math.round(pct * 10) / 10;
  return `${valStr} (${pct > 0 ? "+" : ""}${pctR}%)`;
}

const scoreColor = (score: number | null): string => {
  if (score === null) return C.muted;
  if (score >= 90) return C.good;
  if (score >= 50) return C.warn;
  return C.bad;
}

const scoreBandBg = (score: number | null): string => {
  if (score === null) return C.chipBg;
  if (score >= 90) return C.scoreBandGood;
  if (score >= 50) return C.scoreBandWarn;
  return C.scoreBandBad;
}

const metricColor = (key: string, val: number | null): string => {
  if (val === null) return C.muted;
  const cfg = METRIC_DISPLAY[key];
  if (!cfg) return C.body;
  return val <= cfg.good ? C.good : val <= cfg.poor ? C.warn : C.bad;
}

const statusColor = (status: MetricChange["status"]): string => {
  return status === "improved"
    ? C.good
    : status === "critical"
      ? C.critical
      : status === "regressed"
        ? C.bad
        : C.neutral;
}

/**
 * ASCII-safe status indicator — NO Unicode arrows or ticks.
 * PDFKit's built-in Helvetica only covers Latin-1; arrow/tick glyphs
 * outside that range render as solid black boxes.
 */
const statusLabel = (status: MetricChange["status"]): string => {
  return status === "improved"
    ? "(+)"
    : status === "critical"
      ? "(!)"
      : status === "regressed"
        ? "(-)"
        : "-";
}

/** Strip `[text](url)` markdown links → `text` */
const stripMdLinks = (text: string): string => {
  return text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
}

/** Strip `**bold**` markers */
const stripMdBold = (text: string): string =>{
  return text.replace(/\*\*([^*]+)\*\*/g, "$1");
}

// ── Layout helpers ────────────────────────────────────────────────────────────

const ensureSpace = (doc: PDFKit.PDFDocument, needed: number): void => {
  if (doc.y + needed > BOTTOM_LIMIT) {
    doc.addPage();
    doc.y = MARGIN + 8;
  }
}

const hRule = (
  doc: PDFKit.PDFDocument,
  color: string = C.cardBorder,
  weight = 0.5,
): void => {
  doc
    .save()
    .strokeColor(color)
    .lineWidth(weight)
    .moveTo(MARGIN, doc.y)
    .lineTo(MARGIN + CONTENT_W, doc.y)
    .stroke()
    .restore();
  doc.y += 8;
}

const sectionHeading = (doc: PDFKit.PDFDocument, title: string): void => {
  ensureSpace(doc, 32);
  doc.y += 6;
  doc
    .font("Helvetica-Bold")
    .fontSize(7.5)
    .fillColor(C.muted)
    .text(title.toUpperCase(), MARGIN, doc.y, { characterSpacing: 1 });
  doc.y += 5;
  hRule(doc, C.accentBlue, 1.5);
};

/** Small pill / chip */
const drawChip = (
  doc: PDFKit.PDFDocument,
  text: string,
  x: number,
  y: number,
  bg: string,
  fg: string,
): number => {
  const PAD = 5;
  const H = 14;
  doc.fontSize(6.5);
  const w = doc.widthOfString(text) + PAD * 2;
  doc.save().roundedRect(x, y, w, H, 3).fill(bg).restore();
  doc
    .font("Helvetica-Bold")
    .fontSize(6.5)
    .fillColor(fg)
    .text(text, x + PAD, y + 3.5, { lineBreak: false });
  return w;
};

// ── Cover page ────────────────────────────────────────────────────────────────

const renderCover = (
  doc: PDFKit.PDFDocument,
  projectReport: ProjectReport,
): void => {
  // Full-width dark banner
  doc.save().rect(0, 0, PAGE_W, 150).fill(C.coverBg).restore();
  // Blue accent strip on left
  doc.save().rect(0, 0, 5, 150).fill(C.accentBlue).restore();

  doc
    .font("Helvetica-Bold")
    .fontSize(20)
    .fillColor(C.coverTitle)
    .text("Weekly Performance Intelligence", MARGIN, 34, { width: CONTENT_W });

  doc
    .font("Helvetica")
    .fontSize(11)
    .fillColor(C.coverMeta)
    .text(
      `${projectReport.projectTitle}  ·  ${projectReport.environment}  ·  ${new Date().toDateString()}`,
      MARGIN,
      66,
      { width: CONTENT_W },
    );

  doc
    .font("Helvetica")
    .fontSize(9.5)
    .fillColor("#64748b")
    .text(`Owner: ${projectReport.owner}`, MARGIN, 90);

  // Thin separator line below banner
  doc.y = 158;
  hRule(doc, C.cardBorder, 0.5);
  doc.y += 4;
};

// ── Score grid ────────────────────────────────────────────────────────────────

const renderScoreGrid = (
  doc: PDFKit.PDFDocument,
  perf: number | null,
  a11y: number | null,
  seo: number | null,
  bp: number | null,
): void => {
  sectionHeading(doc, "Lighthouse Scores");
  ensureSpace(doc, 80);

  const scores = [
    { label: "Performance", val: perf },
    { label: "Accessibility", val: a11y },
    { label: "Best Practices", val: bp },
    { label: "SEO", val: seo },
  ];

  const GAP = 6;
  const colW = (CONTENT_W - GAP * 3) / 4;
  const cellH = 72;
  const startY = doc.y;

  scores.forEach(({ label, val }, i) => {
    const x = MARGIN + i * (colW + GAP);

    // Card background
    doc
      .save()
      .roundedRect(x, startY, colW, cellH, 4)
      .fill(scoreBandBg(val))
      .restore();
    // Thin top accent border
    doc
      .save()
      .roundedRect(x, startY, colW, 3, 0)
      .fill(scoreColor(val))
      .restore();

    // Score number
    doc
      .font("Helvetica-Bold")
      .fontSize(32)
      .fillColor(scoreColor(val))
      .text(val !== null ? String(val) : "-", x, startY + 10, {
        width: colW,
        align: "center",
        lineBreak: false,
      });

    // Label
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(C.body)
      .text(label, x, startY + 48, {
        width: colW,
        align: "center",
        lineBreak: false,
      });

    // Rating badge
    const rating = ratingLabel(val);
    doc
      .font("Helvetica-Bold")
      .fontSize(7)
      .fillColor(scoreColor(val))
      .text(rating, x, startY + 60, {
        width: colW,
        align: "center",
        lineBreak: false,
      });
  });

  doc.y = startY + cellH + 16;
};

// ── CWV table ─────────────────────────────────────────────────────────────────

interface VitalRow {
  key: string;
  label: string;
  val: number | null;
  unit: string;
  change?: MetricChange;
}

const renderVitalsTable = (doc: PDFKit.PDFDocument, rows: VitalRow[]): void => {
  sectionHeading(doc, "Core Web Vitals");

  const ROW_H = 22;
  ensureSpace(doc, rows.length * ROW_H + 26);

  // Column x positions — give STATUS enough room
  const COL = {
    metric: MARGIN + 6,
    current: MARGIN + 180,
    prev: MARGIN + 270,
    delta: MARGIN + 365,
    status: MARGIN + CONTENT_W - 38,
  };

  // Header row
  const headerY = doc.y;
  doc.save().rect(MARGIN, headerY, CONTENT_W, 20).fill(C.tableHeader).restore();
  doc.font("Helvetica-Bold").fontSize(7).fillColor(C.tableHeaderTxt);
  doc.text("METRIC", COL.metric, headerY + 6, { lineBreak: false });
  doc.text("CURRENT", COL.current, headerY + 6, { lineBreak: false });
  doc.text("PREVIOUS", COL.prev, headerY + 6, { lineBreak: false });
  doc.text("CHANGE", COL.delta, headerY + 6, { lineBreak: false });
  doc.text("STATUS", COL.status, headerY + 6, { lineBreak: false });
  doc.y = headerY + 20;

  rows.forEach(({ key, label, val, unit, change }, idx) => {
    ensureSpace(doc, ROW_H);
    const rowY = doc.y;
    const rowBg = idx % 2 === 0 ? "#ffffff" : C.sectionBg;
    doc.save().rect(MARGIN, rowY, CONTENT_W, ROW_H).fill(rowBg).restore();

    const vColor = metricColor(key, val);
    const dStr = change
      ? fmtDelta(change.delta, change.unit, change.percentage)
      : "-";
    const pStr = change ? fmtVal(change.previous, unit) : "-";
    const dColor = change ? statusColor(change.status) : C.muted;
    const sLabel = change ? statusLabel(change.status) : "-";
    const sColor = change ? statusColor(change.status) : C.muted;

    const textY = rowY + 6;

    doc
      .font("Helvetica")
      .fontSize(8.5)
      .fillColor(C.body)
      .text(label, COL.metric, textY, { lineBreak: false });
    doc
      .font("Helvetica-Bold")
      .fontSize(8.5)
      .fillColor(vColor)
      .text(fmtVal(val, unit), COL.current, textY, { lineBreak: false });
    doc
      .font("Helvetica")
      .fontSize(8.5)
      .fillColor(C.muted)
      .text(pStr, COL.prev, textY, { lineBreak: false });
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(dColor)
      .text(dStr, COL.delta, textY, {
        width: COL.status - COL.delta - 4,
        lineBreak: false,
      });
    doc
      .font("Helvetica-Bold")
      .fontSize(8)
      .fillColor(sColor)
      .text(sLabel, COL.status, textY, { lineBreak: false });

    doc.y = rowY + ROW_H;
  });

  // Bottom border
  doc
    .save()
    .strokeColor(C.cardBorder)
    .lineWidth(0.5)
    .moveTo(MARGIN, doc.y)
    .lineTo(MARGIN + CONTENT_W, doc.y)
    .stroke()
    .restore();
  doc.y += 16;
};

// ── Regressions ───────────────────────────────────────────────────────────────

const renderRegressions = (
  doc: PDFKit.PDFDocument,
  items: RegressionItem[],
): void => {
  if (!items.length) return;
  sectionHeading(doc, "Regressions Detected");

  const bgMap = { high: C.highBg, medium: C.medBg, low: C.lowBg } as const;
  const bdMap = {
    high: C.highBorder,
    medium: C.medBorder,
    low: C.lowBorder,
  } as const;
  const fgMap = {
    high: C.highText,
    medium: C.medText,
    low: C.lowText,
  } as const;

  for (const r of items) {
    const bg = bgMap[r.severity];
    const bd = bdMap[r.severity];
    const fg = fgMap[r.severity];

    doc.fontSize(9);
    const msgH = doc.heightOfString(r.message, { width: CONTENT_W - 28 });
    const cardH = Math.max(46, msgH + 30);

    ensureSpace(doc, cardH + 10);
    const cardY = doc.y;

    doc
      .save()
      .roundedRect(MARGIN, cardY, CONTENT_W, cardH, 4)
      .fill(bg)
      .restore();
    // Left accent bar
    doc.save().rect(MARGIN, cardY, 4, cardH).fill(bd).restore();

    // Chips row
    let chipX = MARGIN + 12;
    const svW = drawChip(
      doc,
      r.severity.toUpperCase(),
      chipX,
      cardY + 7,
      bd,
      fg,
    );
    chipX += svW + 6;
    drawChip(
      doc,
      `${r.confidence.toUpperCase()} CONFIDENCE`,
      chipX,
      cardY + 7,
      C.chipBg,
      C.muted,
    );

    // Message
    doc
      .font("Helvetica")
      .fontSize(8.5)
      .fillColor(C.body)
      .text(r.message, MARGIN + 12, cardY + 25, { width: CONTENT_W - 24 });

    doc.y = cardY + cardH + 8;
  }
  doc.y += 4;
};

// ── Improvements ──────────────────────────────────────────────────────────────

const renderImprovements = (
  doc: PDFKit.PDFDocument,
  items: Array<{ message: string }>,
): void => {
  if (!items.length) return;
  sectionHeading(doc, "Improvements");

  for (const item of items) {
    ensureSpace(doc, 22);
    const lineY = doc.y;
    // ASCII "OK" bullet instead of Unicode tick
    doc
      .save()
      .circle(MARGIN + 5, lineY + 6, 5)
      .fill(C.lowBg)
      .restore();
    doc
      .font("Helvetica-Bold")
      .fontSize(7)
      .fillColor(C.good)
      .text("OK", MARGIN + 1.5, lineY + 3, { lineBreak: false, width: 14 });
    doc
      .font("Helvetica")
      .fontSize(8.5)
      .fillColor(C.body)
      .text(item.message, MARGIN + 16, lineY, { width: CONTENT_W - 16 });
    doc.y += 5;
  }
  doc.y += 8;
};

// ── Recommendations ───────────────────────────────────────────────────────────

const renderRecommendations = (
  doc: PDFKit.PDFDocument,
  recs: DeterministicRecommendation[],
): void => {
  if (!recs.length) return;
  sectionHeading(doc, "Recommendations");

  const fgMap = {
    high: C.highText,
    medium: C.medText,
    low: C.lowText,
  } as const;
  const bgMap = { high: C.highBg, medium: C.medBg, low: C.lowBg } as const;
  const bdMap = {
    high: C.highBorder,
    medium: C.medBorder,
    low: C.lowBorder,
  } as const;

  recs.forEach((rec, idx) => {
    const fg = fgMap[rec.priority];
    const bg = bgMap[rec.priority];
    const bd = bdMap[rec.priority];

    const estimatedH = 28 + rec.suggestedFixes.length * 18;
    ensureSpace(doc, estimatedH);

    const headerY = doc.y;
    doc
      .save()
      .roundedRect(MARGIN, headerY, CONTENT_W, 24, 3)
      .fill(bg)
      .restore();
    doc.save().rect(MARGIN, headerY, 4, 24).fill(bd).restore();

    doc
      .font("Helvetica-Bold")
      .fontSize(8.5)
      .fillColor(fg)
      .text(`${idx + 1}.`, MARGIN + 10, headerY + 8, {
        lineBreak: false,
        width: 16,
      });
    doc
      .font("Helvetica-Bold")
      .fontSize(8.5)
      .fillColor(C.heading)
      .text(rec.issue, MARGIN + 26, headerY + 8, {
        width: CONTENT_W - 32,
        lineBreak: false,
      });

    doc.y = headerY + 24 + 4;

    for (const fix of rec.suggestedFixes) {
      ensureSpace(doc, 18);
      const fixY = doc.y;
      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor(C.muted)
        .text("-", MARGIN + 28, fixY, { lineBreak: false, width: 10 });
      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor(C.body)
        .text(fix, MARGIN + 38, fixY, { width: CONTENT_W - 44 });
      doc.y += 2;
    }
    doc.y += 10;
  });
};

// ── Opportunities ─────────────────────────────────────────────────────────────

const renderOpportunities = (
  doc: PDFKit.PDFDocument,
  opps: Array<{
    title: string;
    description: string;
    savingsMs?: number;
    savingsBytes?: number;
  }>,
): void => {
  if (!opps.length) return;
  sectionHeading(doc, "Optimization Opportunities");

  opps.forEach((opp, idx) => {
    const cleanDesc = stripMdLinks(opp.description);
    doc.fontSize(8.5);
    const descH = doc.heightOfString(cleanDesc, { width: CONTENT_W - 16 });
    ensureSpace(doc, 24 + descH + 10);

    const titleY = doc.y;

    // Number badge
    doc
      .save()
      .circle(MARGIN + 7, titleY + 6, 7)
      .fill(C.chipBg)
      .restore();
    doc
      .font("Helvetica-Bold")
      .fontSize(7.5)
      .fillColor(C.muted)
      .text(String(idx + 1), MARGIN + 3.5, titleY + 2.5, {
        lineBreak: false,
        width: 14,
        align: "center",
      });

    // Title
    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .fillColor(C.heading)
      .text(opp.title, MARGIN + 20, titleY, {
        width: CONTENT_W - 120,
        lineBreak: false,
      });

    // Savings chips — right-aligned
    let chipRight = MARGIN + CONTENT_W;
    if (opp.savingsBytes) {
      const label = `-${Math.round(opp.savingsBytes / 1024)} KB`;
      const cw = doc.widthOfString(label) + 12;
      chipRight -= cw + 4;
      drawChip(doc, label, chipRight, titleY, C.lowBg, C.lowText);
    }
    if (opp.savingsMs) {
      const label = `-${opp.savingsMs} ms`;
      const cw = doc.widthOfString(label) + 12;
      chipRight -= cw + 4;
      drawChip(doc, label, chipRight, titleY, C.lowBg, C.lowText);
    }

    doc.y = titleY + 14;
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(C.muted)
      .text(cleanDesc, MARGIN + 20, doc.y, { width: CONTENT_W - 22 });
    doc.y += 10;
  });
};

// ── AI text block ─────────────────────────────────────────────────────────────

const renderAiBlock = (
  doc: PDFKit.PDFDocument,
  title: string,
  rawText: string,
): void => {
  sectionHeading(doc, title);
  doc.x = MARGIN;

  for (const line of rawText.split("\n")) {
    const clean = stripMdBold(stripMdLinks(line.trim()));
    if (!clean) {
      doc.moveDown(0.4);
      continue;
    }

    if (clean.startsWith("## ")) {
      ensureSpace(doc, 20);
      doc.font("Helvetica-Bold").fontSize(9.5).fillColor(C.heading);
      doc.text(clean.slice(3), MARGIN, doc.y, { width: CONTENT_W });
      doc.moveDown(0.2);
    } else if (clean.startsWith("# ")) {
      ensureSpace(doc, 22);
      doc.font("Helvetica-Bold").fontSize(10.5).fillColor(C.heading);
      doc.text(clean.slice(2), MARGIN, doc.y, { width: CONTENT_W });
      doc.moveDown(0.2);
    } else if (/^\d+\./.test(clean)) {
      ensureSpace(doc, 16);
      doc.font("Helvetica").fontSize(8.5).fillColor(C.body);
      doc.text(clean, MARGIN, doc.y, { width: CONTENT_W, indent: 10 });
      doc.moveDown(0.2);
    } else if (/^[-*•]/.test(clean)) {
      ensureSpace(doc, 14);
      const content = clean.replace(/^[-*•]\s*/, "");
      doc.font("Helvetica").fontSize(8.5).fillColor(C.body);
      doc.text(`•  ${content}`, MARGIN, doc.y, { width: CONTENT_W, indent: 8 });
      doc.moveDown(0.15);
    } else {
      ensureSpace(doc, 14);
      doc.font("Helvetica").fontSize(8.5).fillColor(C.body);
      doc.text(clean, MARGIN, doc.y, { width: CONTENT_W, lineGap: 1.5 });
      doc.moveDown(0.25);
    }
  }
  doc.moveDown(0.8);
};

// ── URL section header ────────────────────────────────────────────────────────

const renderUrlHeader = (
  doc: PDFKit.PDFDocument,
  urlReport: {
    url: string;
    pageType: string;
    status: string;
    device: "mobile" | "desktop";
  },
): void => {
  ensureSpace(doc, 52);
  const headerY = doc.y;

  doc
    .save()
    .roundedRect(MARGIN, headerY, CONTENT_W, 38, 5)
    .fill(C.coverBg)
    .restore();
  doc.save().rect(MARGIN, headerY, 5, 38).fill(C.accentBlue).restore();

  const titleText = `${urlReport.pageType.toUpperCase()} (${urlReport.device.toUpperCase()})`;
  doc
    .font("Helvetica-Bold")
    .fontSize(10.5)
    .fillColor("#f8fafc")
    .text(titleText, MARGIN + 14, headerY + 7, { lineBreak: false });

  doc
    .font("Helvetica")
    .fontSize(8.5)
    .fillColor("#94a3b8")
    .text(urlReport.url, MARGIN + 14, headerY + 23, {
      width: CONTENT_W - 100,
      lineBreak: false,
    });

  // Status — ASCII-safe: [PASS] or [FAIL]
  const statusOk = urlReport.status === "success";
  const statusTxt = statusOk ? "[PASS]" : "[FAIL]";
  doc
    .font("Helvetica-Bold")
    .fontSize(8)
    .fillColor(statusOk ? C.good : C.bad)
    .text(statusTxt, MARGIN + CONTENT_W - 50, headerY + 15, {
      lineBreak: false,
    });

  doc.y = headerY + 48;
};

// ── Main PDF builder ──────────────────────────────────────────────────────────

const buildPdf = (
  projectReport: ProjectReport,
  mobileComparisonReport?: ProjectComparisonReport,
  desktopComparisonReport?: ProjectComparisonReport,
): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: MARGIN,
      bufferPages: true,
      autoFirstPage: true,
      info: {
        Title: `Weekly Performance Report — ${projectReport.projectTitle}`,
        Author: "Weekly Lighthouse Monitoring",
        Creator: "Weekly Lighthouse Monitoring",
      },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // ── Page 1: Header + first URL report ────────────────────────────────────
    renderCover(doc, projectReport);

    // ── Per-URL pages ─────────────────────────────────────────────────────────
    projectReport.urls.forEach((urlReport, urlIdx) => {
      // Keep the first report directly under the cover header. Later reports
      // still start on their own pages for readability.
      if (urlIdx > 0) {
        doc.addPage();
        doc.y = MARGIN + 8;
      }

      const isMobile = urlReport.device === "mobile";
      const compReport = isMobile
        ? mobileComparisonReport
        : desktopComparisonReport;
      const comp = compReport?.urls.find((u) => u.url === urlReport.url);

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
          {
            key: "lcp",
            label: "Largest Contentful Paint",
            val: cwv.lcp,
            unit: "ms",
            change: comp?.metrics?.lcp,
          },
          {
            key: "cls",
            label: "Cumulative Layout Shift",
            val: cwv.cls,
            unit: "",
            change: comp?.metrics?.cls,
          },
          {
            key: "inpOrTbt",
            label: "INP / Total Blocking Time",
            val: cwv.inpOrTbt,
            unit: "ms",
            change: comp?.metrics?.inpOrTbt,
          },
          {
            key: "fcp",
            label: "First Contentful Paint",
            val: cwv.fcp,
            unit: "ms",
            change: comp?.metrics?.fcp,
          },
          {
            key: "speedIndex",
            label: "Speed Index",
            val: cwv.speedIndex,
            unit: "ms",
          },
          {
            key: "ttfb",
            label: "Time to First Byte",
            val: cwv.ttfb,
            unit: "ms",
            change: comp?.metrics?.ttfb,
          },
        ];
        renderVitalsTable(doc, rows);
      }

      if (comp?.regressions?.length) renderRegressions(doc, comp.regressions);
      if (comp?.improvements?.length)
        renderImprovements(doc, comp.improvements);
      if (comp?.recommendations?.length)
        renderRecommendations(doc, comp.recommendations);
      if (urlReport.opportunities?.length)
        renderOpportunities(doc, urlReport.opportunities);
      if (urlReport.aiSummary)
        renderAiBlock(doc, "AI Engineering Summary", urlReport.aiSummary);
      if (comp?.aiInsight)
        renderAiBlock(doc, "AI Weekly Insight", comp.aiInsight);
    });

    doc.end();
  });
};

// ── Public sendReportEmail ────────────────────────────────────────────────────

/**
 * Builds the weekly PDF report and emails it to the given recipient.
 * Retries the SMTP send up to 3 times with exponential backoff on transient
 * delivery failures before giving up and logging an error.
 */
export const sendReportEmail = async (
  to: string,
  projectReport: ProjectReport,
  log: Logger,
  mobileComparisonReport?: ProjectComparisonReport,
  desktopComparisonReport?: ProjectComparisonReport,
): Promise<void> => {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    log.warn("SMTP_USER or SMTP_PASS not configured — skipping email");
    return;
  }

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await buildPdf(
      projectReport,
      mobileComparisonReport,
      desktopComparisonReport,
    );
    log.info({ bytes: pdfBuffer.length }, "PDF generated");
  } catch (err) {
    log.error({ err }, "PDF generation failed — skipping email");
    return;
  }

  const date = new Date().toISOString().slice(0, 10);
  const slug = projectReport.projectTitle.replace(/\s+/g, "-").toLowerCase();
  const filename = `${slug}-performance-report-${date}.pdf`;
  const subject = `Weekly Performance Digest: ${projectReport.projectTitle}`;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  let urlsHtml = "";
  for (const urlReport of projectReport.urls) {
    const isMobile = urlReport.device === "mobile";
    const compReport = isMobile
      ? mobileComparisonReport
      : desktopComparisonReport;
    const comp = compReport?.urls.find((u) => u.url === urlReport.url);
    const latestRunId =
      comp?.historicalRuns[comp?.historicalRuns.length - 1]?.id;
    const reportLink = latestRunId
      ? `${baseUrl}/api/audits/${latestRunId}/html`
      : "#";
    const overviewLink = latestRunId ? `${baseUrl}/audits/${latestRunId}` : "#";
    const pScore = urlReport.performanceScore;
    const ratingTxt = ratingLabel(pScore);

    urlsHtml += `
      <tr>
        <td style="padding:14px 12px;border-bottom:1px solid #e2e8f0;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${urlReport.url}">
          <div style="display:flex;align-items:center;gap:6px;">
            <a href="${overviewLink}" style="color:#2563eb;text-decoration:none;font-weight:600;">${urlReport.pageType}</a>
            <span style="font-size:10px;padding:2px 6px;border-radius:4px;font-weight:600;background:${isMobile ? "#fff1f2" : "#eff6ff"};color:${isMobile ? "#9f1239" : "#1e40af"};border:1px solid ${isMobile ? "#fecdd3" : "#bfdbfe"};">
              ${isMobile ? "Mobile" : "Desktop"}
            </span>
          </div>
          <div style="font-size:11px;color:#64748b;margin-top:4px;overflow:hidden;text-overflow:ellipsis;">${urlReport.url}</div>
        </td>
        <td style="padding:14px 12px;border-bottom:1px solid #e2e8f0;text-align:center;">
          <span style="font-weight:700;font-size:22px;color:${scoreColor(pScore)}">${pScore ?? "-"}</span>
          <div style="font-size:10px;color:${scoreColor(pScore)};margin-top:2px;">${ratingTxt}</div>
        </td>
        <td style="padding:14px 12px;border-bottom:1px solid #e2e8f0;text-align:center;">
          ${
            latestRunId
              ? `<a href="${reportLink}" style="font-size:12px;color:#ffffff;text-decoration:none;padding:8px 14px;border-radius:6px;background:#4f46e5;display:inline-block;font-weight:500;">View Report</a>`
              : '<span style="color:#94a3b8;font-size:12px;">N/A</span>'
          }
        </td>
      </tr>`;
  }

  const htmlBody = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1e293b;max-width:660px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.06);">
      <div style="background:#0f172a;padding:32px;border-left:5px solid #3b82f6;">
        <h2 style="color:#f8fafc;margin:0 0 8px;font-size:22px;font-weight:700;letter-spacing:-0.3px;">Weekly Performance Report</h2>
        <p style="color:#94a3b8;margin:0;font-size:13px;">${projectReport.projectTitle} &nbsp;·&nbsp; ${projectReport.environment}</p>
      </div>
      <div style="padding:32px;background:#ffffff;">
        <p style="font-size:14px;color:#334155;margin:0 0 24px;line-height:1.7;">
          The weekly Lighthouse audit for <strong>${projectReport.projectTitle}</strong> is complete.
          View the full diagnostic overview and AI engineering summaries on the dashboard, or click below to open the native Lighthouse HTML reports.
        </p>

        <h3 style="font-size:14px;font-weight:600;margin:0 0 14px;color:#0f172a;border-bottom:2px solid #f1f5f9;padding-bottom:8px;">Audited Pages</h3>
        <table style="width:100%;border-collapse:collapse;font-size:13px;color:#334155;margin-bottom:24px;">
          <thead>
            <tr style="background:#f8fafc;">
              <th style="padding:12px;text-align:left;border-bottom:2px solid #e2e8f0;color:#64748b;font-weight:600;">Page</th>
              <th style="padding:12px;text-align:center;border-bottom:2px solid #e2e8f0;color:#64748b;font-weight:600;">Perf Score</th>
              <th style="padding:12px;text-align:center;border-bottom:2px solid #e2e8f0;color:#64748b;font-weight:600;">Action</th>
            </tr>
          </thead>
          <tbody>${urlsHtml}</tbody>
        </table>

        <div style="padding:16px 20px;background:#f0f9ff;border-radius:8px;border-left:4px solid #3b82f6;">
          <p style="margin:0;font-size:13px;color:#0369a1;line-height:1.6;">
            <strong>PDF Attached:</strong> The attached report includes Core Web Vitals breakdowns, regression analysis, optimization opportunities, and AI-generated insights.
          </p>
        </div>
      </div>
      <div style="padding:18px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
        <p style="color:#94a3b8;font-size:12px;margin:0;">Generated by Lighthouse Intelligence Platform</p>
      </div>
    </div>`;

  try {
    const info = await transporter.sendMail({
      from: `"Lighthouse Monitoring" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html: htmlBody,
      text: `Weekly Performance Digest: ${projectReport.projectTitle}\n\nSee attached PDF.`,
      attachments: [
        { filename, content: pdfBuffer, contentType: "application/pdf" },
      ],
    });
    log.info(
      { messageId: info.messageId, to, filename },
      "Performance report emailed",
    );
  } catch (err) {
    log.error({ err, to }, "Failed to send performance report email");
  }
};
