import type { MonthlyReport } from './monthlyPerformance';
import { WEEKLY_METRICS } from './weeklyKpi';

/** Lightweight browser PDF creator, using standard built-in Helvetica fonts.
 * No network access, third-party document service, or external script required. */
type Page = string[];
const ascii = (value: unknown): string => String(value ?? '')
  .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[\u2018\u2019]/g, "'").replace(/[\u2013\u2014]/g, '-')
  .replace(/[\u2022]/g, '-').replace(/[^\x20-\x7E]/g, '?');
const escapePdf = (value: unknown): string =>
  ascii(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
const f = (n: number) => Number(n.toFixed(2)).toString();
const rating = (n: number | null) => n == null ? 'Not assessed' : n.toFixed(2) + ' / 5';
const pct = (n: number | null) => n == null ? 'N/A' : n.toFixed(1) + '%';
const avg = (n: number | null) => n == null ? 'N/A' : n.toFixed(2);

function text(width: number, x: number, y: number, content: string, fontSize = 10, bold = false, color = '#242424') {
  const rgb = color.slice(1).match(/.{2}/g)?.map((v) => parseInt(v, 16) / 255) || [0, 0, 0];
  return f(rgb[0]) + ' ' + f(rgb[1]) + ' ' + f(rgb[2]) +
    ' rg BT /' + (bold ? 'F2' : 'F1') + ' ' + fontSize + ' Tf 1 0 0 1 ' +
    f(x) + ' ' + f(y) + ' Tm (' + escapePdf(content) + ') Tj ET';
}
const rect = (x: number, y: number, w: number, h: number, hex: string) => {
  const rgb = hex.slice(1).match(/.{2}/g)?.map((v) => parseInt(v, 16) / 255) || [0, 0, 0];
  return f(rgb[0]) + ' ' + f(rgb[1]) + ' ' + f(rgb[2]) + ' rg ' +
    f(x) + ' ' + f(y) + ' ' + f(w) + ' ' + f(h) + ' re f';
};

/** Conservative wrapping for standard PDF Helvetica, with clipping avoided. */
function wrap(value: string, maxChars: number): string[] {
  const lines: string[] = [];
  const limit = Math.max(8, maxChars);
  const raw = ascii(value).split(/\r?\n/);
  for (const paragraph of raw) {
    if (!paragraph) { lines.push(''); continue; }
    let current = '';
    for (const word of paragraph.split(/\s+/)) {
      let pending = word;
      if (current && current.length + 1 + pending.length > limit) {
        lines.push(current);
        current = '';
      }
      while (pending.length > limit) {
        if (current) { lines.push(current); current = ''; }
        lines.push(pending.slice(0, limit));
        pending = pending.slice(limit);
      }
      if (pending) current = current ? current + ' ' + pending : pending;
    }
    lines.push(current);
  }
  return lines;
}
type PDFWriter = {
  section: (heading: string) => void;
  line: (content: string, fontSize?: number, bold?: boolean, color?: string, indent?: number) => void;
  detail: (label: string, value: string) => void;
  breakPage: () => void;
  getPages: () => Page[];
};
function writer(report: MonthlyReport): PDFWriter {
  const pages: Page[] = [];
  let page: Page = [];
  let y = 766;
  let pageNumber = 0;
  const pageHeader = () => {
    page = [];
    pageNumber++;
    page.push(rect(0, 785, 595, 57, '#43152f'));
    page.push(rect(0, 777, 595, 8, '#d43f8f'));
    page.push(text(595, 42, 807, 'DAG ESPORTS  /  MONTHLY PERFORMANCE', 15, true, '#ffffff'));
    page.push(text(595, 42, 790, report.team + '  |  ' + report.label, 9, false, '#f6d5e6'));
    page.push(text(595, 42, 24, 'Management report  -  ' + report.month +
      '  |  Generated ' + report.generatedAt.slice(0, 10), 8, false, '#646464'));
    page.push(text(595, 518, 24, 'Page ' + pageNumber, 8, true, '#646464'));
    pages.push(page);
    y = 758;
  };
  const requireSpace = (needed: number) => { if (y - needed < 50) pageHeader(); };
  pageHeader();
  return {
    section(heading) {
      requireSpace(36);
      y -= 13;
      page.push(rect(42, y - 9, 511, 24, '#f7e8f0'));
      page.push(text(595, 51, y - 2, heading.toUpperCase(), 11, true, '#661743'));
      y -= 29;
    },
    line(content, fontSize = 10, bold = false, color = '#333333', indent = 0) {
      const width = 510 - indent;
      const rows = wrap(content, Math.floor(width / (fontSize * 0.51)));
      for (const line of rows) {
        requireSpace(fontSize + 6);
        page.push(text(595, 46 + indent, y, line, fontSize, bold, color));
        y -= fontSize + 4;
      }
    },
    detail(label, value) {
      requireSpace(22);
      page.push(text(595, 49, y, label, 9, true, '#606060'));
      page.push(text(595, 251, y, value, 10, true, '#262626'));
      y -= 21;
    },
    breakPage: pageHeader,
    getPages: () => pages,
  };
}
const utf8 = (input: string) => new TextEncoder().encode(input);
function buildPdf(pages: Page[]): Blob {
  const objects: string[] = [];
  const add = (value: string) => { objects.push(value); return objects.length; };
  const rootId = add('');
  const pagesId = add('');
  const regular = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const bold = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  const pageIds: number[] = [];
  for (const commands of pages) {
    const stream = commands.join('\n');
    const streamBytes = utf8(stream);
    const contentId = add('<< /Length ' + streamBytes.length + ' >>\nstream\n' + stream + '\nendstream');
    const pageId = add('<< /Type /Page /Parent ' + pagesId +
      ' 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ' + regular +
      ' 0 R /F2 ' + bold + ' 0 R >> >> /Contents ' + contentId + ' 0 R >>');
    pageIds.push(pageId);
  }
  objects[rootId - 1] = '<< /Type /Catalog /Pages ' + pagesId + ' 0 R >>';
  objects[pagesId - 1] = '<< /Type /Pages /Kids [' + pageIds.map((id) => id + ' 0 R').join(' ') +
    '] /Count ' + pageIds.length + ' >>';

  const chunks: Uint8Array[] = [utf8('%PDF-1.4\n% DAG Esports Report\n')];
  const offsets: number[] = [0];
  let pos = chunks[0].length;
  for (let i = 0; i < objects.length; i++) {
    offsets.push(pos);
    const part = utf8((i + 1) + ' 0 obj\n' + objects[i] + '\nendobj\n');
    chunks.push(part);
    pos += part.length;
  }
  const xrefOffset = pos;
  let xref = 'xref\n0 ' + (objects.length + 1) + '\n0000000000 65535 f \n';
  for (const offset of offsets.slice(1)) xref += String(offset).padStart(10, '0') + ' 00000 n \n';
  xref += 'trailer\n<< /Size ' + (objects.length + 1) + ' /Root ' + rootId +
    ' 0 R >>\nstartxref\n' + xrefOffset + '\n%%EOF';
  chunks.push(utf8(xref));
  const merged = new Uint8Array(chunks.reduce((sum, item) => sum + item.length, 0));
  let cursor = 0;
  for (const chunk of chunks) { merged.set(chunk, cursor); cursor += chunk.length; }
  return new Blob([merged.buffer as ArrayBuffer], { type: 'application/pdf' });
}

export function monthlyReportPdf(report: MonthlyReport): Blob {
  const doc = writer(report);
  doc.section('Monthly overview');
  doc.detail('Team', report.team);
  doc.detail('Reporting period', report.label);
  doc.detail('Completed matches', String(report.totals.completed));
  doc.detail('Wins / Losses / Draws',
    report.totals.wins + ' / ' + report.totals.losses + ' / ' + report.totals.draws);
  doc.detail('Players in roster', String(report.totals.players));
  doc.detail('Rated assessments', String(report.totals.assessments));
  doc.detail('Team coach KPI', rating(report.totals.coachAvg));
  doc.detail('Avg player attendance', pct(report.totals.avgAttendancePct));
  doc.detail('Avg player overall score', rating(report.totals.overall));
  doc.line('KPI scores reflect only played assessments with all six valid 1-5 ratings.', 9);
  doc.line('Overall = 70% coach KPI + 30% attendance score (1-5). Missing ratings remain unassessed.', 9);
  doc.line('Attendance = played + benched; absent/unrecorded do not count. Only completed matches.', 9);

  doc.section('Player performance');
  if (report.players.length === 0) doc.line('No players found in the selected team roster.');
  for (const player of report.players) {
    doc.line(player.ign + (player.fullName ? '  (' + player.fullName + ')' : '') +
      '  |  ' + (player.role || 'Player'), 10, true, '#6d1e51');
    doc.line('Matches: ' + report.totals.completed + '  |  Played: ' + player.played +
      '  |  Bench: ' + player.benched + '  |  Absent: ' + player.absent +
      '  |  Not recorded: ' + player.unrecorded, 9, false, '#444444', 8);
    doc.line('Attendance: ' + pct(player.attendancePct) +
      '  |  Fully rated: ' + player.rated +
      '  |  Coach KPI: ' + rating(player.coachAvg) +
      '  |  Overall: ' + rating(player.overall), 9, false, '#444444', 8);
    doc.line(WEEKLY_METRICS.map(({ key, label }) =>
      label + ' ' + avg(player.metrics[key])).join('   |   '), 8, false, '#5e5e5e', 8);
    doc.line(' ', 4);
  }

  doc.section('Completed match results');
  if (!report.matches.length) doc.line('No completed matches in this calendar month.');
  for (const match of report.matches) {
    const result = match.result || 'Not confirmed';
    doc.line(match.match_date.slice(0, 10) + '  |  ' + match.opponent_name +
      '  |  ' + (match.match_type || 'Match'), 10, true, '#5e1642');
    doc.line('DAG ' + (match.dag_score ?? '-') + ' - ' + (match.opponent_score ?? '-') +
      ' Opponent  |  ' + result + '  |  Rated players: ' + match.ratedPlayers +
      '  |  Match KPI: ' + rating(match.averageKpi), 9, false, '#444444', 8);
    doc.line(' ', 4);
  }

  doc.section('Weekly coach reports');
  doc.line('A report is assigned to the month of its Monday week-start date.', 9);
  if (!report.weeklyReports.length) doc.line('No weekly coach comments were saved with a week-start date in this month.');
  for (const note of report.weeklyReports) {
    doc.line(note.ign + '  |  Week of ' + note.week_start, 10, true, '#5e1642');
    doc.line('Comment: ' + (note.coach_comment || 'No comment'), 9, false, '#444444', 8);
    doc.line('Improvements: ' + (note.improvements || 'No goals'), 9, false, '#444444', 8);
    doc.line(' ', 4);
  }
  doc.section('Data and privacy notes');
  doc.line('Only completed matches and latest match/player assessment records are counted.', 9);
  doc.line('Roster reflects current membership; historical departed players may be omitted.', 9);
  doc.line('No exact date of birth, location, MLBB account identifiers or private absence reasons are exported.', 9);
  doc.line('Data is generated on demand from Supabase; missing ratings or missing attendance are not estimates.', 9);
  return buildPdf(doc.getPages());
}
