import nodemailer from 'nodemailer';
import type { Logger } from 'pino';
import puppeteer from 'puppeteer';

import { ProjectReport } from '@/types';
import { ProjectComparisonReport } from './comparison/comparisonTypes';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

interface MetricChange {
  previous: number | null;
  current: number | null;
  delta: number | null;
  percentage?: number | null;
  unit: string;
}

const formatMetricValue = (
  value: number | null,
  unit: string
): string => {
  if (value === null) {
    return 'N/A';
  }

  return `${value}${unit}`;
};

const formatDelta = (
  delta: number | null,
  unit: string,
  percentage?: number | null
): string => {
  if (delta === null) {
    return 'N/A';
  }

  const deltaText = `${delta > 0 ? '+' : ''}${delta}${unit}`;

  if (percentage === null || percentage === undefined) {
    return deltaText;
  }

  return `${deltaText} (${percentage > 0 ? '+' : ''}${percentage}%)`;
};

const createSectionTitle = (
  doc: PDFKit.PDFDocument,
  title: string
): void => {
  doc
    .moveDown(1.2)
    .font('Helvetica-Bold')
    .fontSize(18)
    .fillColor('#0f172a')
    .text(title);

  doc
    .moveDown(0.3)
    .strokeColor('#cbd5e1')
    .lineWidth(1)
    .moveTo(doc.x, doc.y)
    .lineTo(550, doc.y)
    .stroke();

  doc.moveDown(0.8);
};

const createSubTitle = (
  doc: PDFKit.PDFDocument,
  title: string
): void => {
  doc
    .font('Helvetica-Bold')
    .fontSize(14)
    .fillColor('#111827')
    .text(title);

  doc.moveDown(0.4);
};

const createBodyText = (
  doc: PDFKit.PDFDocument,
  text: string
): void => {
  doc
    .font('Helvetica')
    .fontSize(10.5)
    .fillColor('#374151')
    .text(text, {
      lineGap: 2,
    });

  doc.moveDown(0.4);
};

const renderMetricBlock = (
  doc: PDFKit.PDFDocument,
  label: string,
  metric: MetricChange | undefined
): void => {
  if (!metric) {
    return;
  }

  const previous = formatMetricValue(
    metric.previous,
    metric.unit
  );

  const current = formatMetricValue(
    metric.current,
    metric.unit
  );

  const delta = formatDelta(
    metric.delta,
    metric.unit,
    metric.percentage
  );

  doc
    .font('Helvetica-Bold')
    .fontSize(11)
    .fillColor('#111827')
    .text(label);

  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor('#4b5563')
    .text(
      `Previous: ${previous} | Current: ${current} | Delta: ${delta}`
    );

  doc.moveDown(0.4);
};

const renderMarkdownLikeText = (
  doc: PDFKit.PDFDocument,
  text: string
): void => {
  const lines = text.split('\n');

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      doc.moveDown(0.3);
      continue;
    }

    if (line.startsWith('# ')) {
      doc
        .font('Helvetica-Bold')
        .fontSize(14)
        .fillColor('#111827')
        .text(line.replace('# ', ''));

      continue;
    }

    if (line.startsWith('## ')) {
      doc
        .font('Helvetica-Bold')
        .fontSize(12)
        .fillColor('#1f2937')
        .text(line.replace('## ', ''));

      continue;
    }

    if (line.startsWith('- ') || line.startsWith('* ')) {
      doc
        .font('Helvetica')
        .fontSize(10.5)
        .fillColor('#374151')
        .text(`• ${line.replace(/^[-*]\s+/, '')}`, {
          indent: 12,
        });

      continue;
    }

    doc
      .font('Helvetica')
      .fontSize(10.5)
      .fillColor('#374151')
      .text(line, {
        lineGap: 2,
      });
  }

  doc.moveDown(0.6);
};

const generatePdfReports = async (
  projectReport: ProjectReport,
  comparisonReport: ProjectComparisonReport
): Promise<{ filename: string; content: Buffer }[]> => {
  const pdfs: { filename: string; content: Buffer }[] = [];

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    for (const urlReport of comparisonReport.urls) {
      const runId = urlReport.historicalRuns?.[0]?.id;
      if (!runId) continue;

      const page = await browser.newPage();
      
      // Set viewport for a good desktop layout
      await page.setViewport({ width: 1200, height: 1600 });
      
      const targetUrl = `http://localhost:3000/audits/${runId}?export=pdf`;
      await page.goto(targetUrl, { waitUntil: 'networkidle0', timeout: 30000 });

      // Hide the agent prompts section and AI Engineering Summary
      await page.evaluate(() => {
        const agentSection = document.getElementById('agent-prompts-section');
        if (agentSection) agentSection.remove();
        
        // Find and remove AI Engineering Summary section
        const headings = document.querySelectorAll('h2');
        headings.forEach(h2 => {
          if (h2.textContent === 'AI Engineering Summary') {
            const section = h2.closest('div') || h2.parentElement;
            if (section) section.remove();
          }
        });

        // Remove href from all links to prevent clicking in PDF
        document.querySelectorAll('a').forEach(a => {
          a.removeAttribute('href');
          a.style.textDecoration = 'none'; // Optional: remove underline if they look too much like links
          a.style.color = 'inherit'; // Optional: remove link color
        });
      });

      // Generate PDF
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' }
      });

      // Convert Uint8Array to Buffer since puppeteer might return Uint8Array in newer versions
      const buffer = Buffer.isBuffer(pdfBuffer) ? pdfBuffer : Buffer.from(pdfBuffer);

      const filename = `${projectReport.projectTitle.replace(/\s+/g, '-').toLowerCase()}-${urlReport.pageType.replace(/\s+/g, '-').toLowerCase()}-report.pdf`;
      
      pdfs.push({ filename, content: buffer });
    }
  } finally {
    await browser.close();
  }

  return pdfs;
};

export const sendReportEmail = async (
  to: string,
  projectReport: ProjectReport,
  log: Logger,
  comparisonReport?: ProjectComparisonReport
): Promise<void> => {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    log.warn('SMTP_USER or SMTP_PASS is not configured.');
    return;
  }

  if (!comparisonReport) {
    log.warn('Comparison report not found. Email skipped.');
    return;
  }

  try {
    const pdfs = await generatePdfReports(projectReport, comparisonReport);
    
    if (pdfs.length === 0) {
      log.warn('No PDFs generated for email.');
      return;
    }

    const subject = `Weekly Performance Intelligence Digest: ${projectReport.projectTitle}`;

    const info = await transporter.sendMail({
      from: `"Lighthouse Monitoring" <${process.env.SMTP_USER}>`,
      to,
      subject,
      text: 'Attached is your complete Weekly Performance Intelligence PDF report.',
      attachments: pdfs.map(pdf => ({
        filename: pdf.filename,
        content: pdf.content,
        contentType: 'application/pdf',
      })),
    });

    log.info({ messageId: info.messageId, to }, 'Performance PDF report sent successfully');
  } catch (error: unknown) {
    log.error({ error, to }, 'Failed to send performance PDF report');
  }
};