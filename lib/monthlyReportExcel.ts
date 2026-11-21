import { WEEKLY_METRICS } from './weeklyKpi';
import type { MonthlyReport } from './monthlyPerformance';

/** Minimal standards-compliant XLSX writer. Files are generated locally in the browser,
 * with no dependency, external upload or third-party reporting service. */
type Cell = string | number | null;
type Sheet = { name: string; rows: Cell[][]; widths: number[]; headerRow?: number; scoreColumns?: number[]; percentColumns?: number[] };
const utf8 = (text: string) => new TextEncoder().encode(text);
const xmlEscape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
const colLetter = (index: number) => {
  let value = index + 1;
  let letters = '';
  while (value > 0) {
    value -= 1;
    letters = String.fromCharCode(65 + value % 26) + letters;
    value = Math.floor(value / 26);
  }
  return letters;
};
const display = (value: number | null): Cell => value === null ? 'Not assessed' : value;
const percent = (value: number | null): Cell => value === null ? 'N/A' : value / 100;
const score = (value: number | null): Cell => value === null ? 'Not assessed' : value;

function worksheetXml(sheet: Sheet): string {
  const maxCol = Math.max(sheet.widths.length, ...sheet.rows.map((row) => row.length));
  const maxRow = Math.max(1, sheet.rows.length);
  const columnWidths = sheet.widths.map((width, index) =>
    '<col min="' + (index + 1) + '" max="' + (index + 1) + '" width="' + Math.max(7, Math.min(width, 55)) + '" customWidth="1"/>'
  ).join('');
  const rows = sheet.rows.map((row, rowIndex) => {
    const rowNumber = rowIndex + 1;
    const isTitle = rowNumber === 1;
    const isHeader = rowNumber === sheet.headerRow;
    const cells = row.map((value, colIndex) => {
      if (value === null || value === '') return '';
      const ref = colLetter(colIndex) + rowNumber;
      const style = isTitle ? 2 : isHeader ? 1 :
        sheet.scoreColumns?.includes(colIndex) && typeof value === 'number' ? 3 :
        sheet.percentColumns?.includes(colIndex) && typeof value === 'number' ? 4 : 0;
      // Inline strings are never evaluated as Excel formulas (including =, +, - or @).
      if (typeof value === 'number' && Number.isFinite(value)) {
        return '<c r="' + ref + '" s="' + style + '" t="n"><v>' + value + '</v></c>';
      }
      return '<c r="' + ref + '" s="' + style + '" t="inlineStr"><is><t xml:space="preserve">' +
        xmlEscape(String(value)) + '</t></is></c>';
    }).join('');
    const height = isTitle ? ' ht="31" customHeight="1"' : isHeader ? ' ht="25" customHeight="1"' : '';
    return '<row r="' + rowNumber + '"' + height + '>' + cells + '</row>';
  }).join('');
  const freeze = sheet.headerRow
    ? '<pane ySplit="' + sheet.headerRow + '" topLeftCell="A' + (sheet.headerRow + 1) +
      '" activePane="bottomLeft" state="frozen"/>'
    : '';
  const filter = sheet.headerRow && sheet.rows.length > sheet.headerRow
    ? '<autoFilter ref="A' + sheet.headerRow + ':' + colLetter(maxCol - 1) + maxRow + '"/>'
    : '';
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<dimension ref="A1:' + colLetter(maxCol - 1) + maxRow + '"/>' +
    '<sheetViews><sheetView workbookViewId="0">' + freeze + '</sheetView></sheetViews>' +
    '<sheetFormatPr defaultRowHeight="17"/><cols>' + columnWidths + '</cols>' +
    '<sheetData>' + rows + '</sheetData>' + filter + '</worksheet>';
}

const stylesXml = '<?xml version="1.0" encoding="UTF-8"?>' +
  '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
  '<fonts count="3">' +
  '<font><sz val="11"/><color rgb="FF202020"/><name val="Calibri"/></font>' +
  '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>' +
  '<font><b/><sz val="17"/><color rgb="FF9F2266"/><name val="Calibri"/></font>' +
  '</fonts><fills count="3">' +
  '<fill><patternFill patternType="none"/></fill>' +
  '<fill><patternFill patternType="gray125"/></fill>' +
  '<fill><patternFill patternType="solid"><fgColor rgb="FF65133E"/><bgColor indexed="64"/></patternFill></fill>' +
  '</fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="5">' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFill="1" applyFont="1"/>' +
  '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
  '<xf numFmtId="2" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
  '<xf numFmtId="10" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
  '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';

let crcTable: Uint32Array | null = null;
function crc32(bytes: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) c = c & 1 ? (0xEDB88320 ^ (c >>> 1)) : c >>> 1;
      crcTable[i] = c >>> 0;
    }
  }
  let crc = 0xFFFFFFFF;
  for (const b of bytes) crc = crcTable[(crc ^ b) & 255] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
function le16(buffer: Uint8Array, position: number, value: number) {
  buffer[position] = value & 255;
  buffer[position + 1] = value >>> 8 & 255;
}
function le32(buffer: Uint8Array, position: number, value: number) {
  le16(buffer, position, value);
  le16(buffer, position + 2, value >>> 16);
}
function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) { out.set(part, offset); offset += part.length; }
  return out;
}

function zipStore(entries: { path: string; data: Uint8Array }[]): Uint8Array {
  const locals: Uint8Array[] = [];
  const directory: Uint8Array[] = [];
  let offset = 0;
  for (const file of entries) {
    const name = utf8(file.path);
    const crc = crc32(file.data);
    const local = new Uint8Array(30 + name.length);
    le32(local, 0, 0x04034B50);
    le16(local, 4, 20); le16(local, 6, 0x0800); // ZIP 2.0; UTF-8 file names
    le16(local, 8, 0); // stored, not compressed
    le32(local, 14, crc); le32(local, 18, file.data.length); le32(local, 22, file.data.length);
    le16(local, 26, name.length);
    local.set(name, 30);
    locals.push(local, file.data);

    const central = new Uint8Array(46 + name.length);
    le32(central, 0, 0x02014B50);
    le16(central, 4, 20); le16(central, 6, 20); le16(central, 8, 0x0800);
    le32(central, 16, crc); le32(central, 20, file.data.length); le32(central, 24, file.data.length);
    le16(central, 28, name.length); le32(central, 42, offset);
    central.set(name, 46);
    directory.push(central);
    offset += local.length + file.data.length;
  }
  const directoryBytes = concat(directory);
  const end = new Uint8Array(22);
  le32(end, 0, 0x06054B50);
  le16(end, 8, entries.length); le16(end, 10, entries.length);
  le32(end, 12, directoryBytes.length); le32(end, 16, offset);
  return concat([...locals, directoryBytes, end]);
}

export function monthlyReportExcel(report: MonthlyReport): Blob {
  const name = report.team + ' / ' + report.label;
  const title = ['DAG Esports - Monthly Performance Report'];
  const summary: Cell[][] = [
    title,
    ['Team', report.team],
    ['Month', report.label],
    ['Generated (UTC)', report.generatedAt.slice(0, 19).replace('T', ' ')],
    [],
    ['MONTHLY OVERVIEW', 'Value'],
    ['Completed matches', report.totals.completed],
    ['Wins', report.totals.wins],
    ['Losses', report.totals.losses],
    ['Draws', report.totals.draws],
    ['Roster players (excludes staff)', report.totals.players],
    ['Fully scored player assessments', report.totals.assessments],
    ['Team coach KPI / 5', display(report.totals.coachAvg)],
    ['Average player attendance', percent(report.totals.avgAttendancePct)],
    ['Average player overall / 5', display(report.totals.overall)],
    [],
    ['SCORING AND ATTENDANCE NOTES'],
    ['Only completed matches inside the selected calendar month are included.'],
    ['Player participation = Played + Benched; absent and unrecorded are not attended.'],
    ['Attendance is based on completed matches, not only evaluated matches.'],
    ['KPI = six rated categories: Mechanics 20%, Macro 25%, Communication 15%, Role Execution 20%, Discipline 10%, Hero Pool 10%.'],
    ['Overall = Coach KPI 70% + attendance score 30%; attendance score = 1 + 4 x attendance fraction.'],
    ['A player without all six valid ratings receives Not assessed, never a fabricated zero.'],
    ['If no matches were completed in this month, attendance is N/A.'],
    ['Weekly narrative entries are listed by the week-start date falling in this month.'],
    ['Private DOB, MLBB IDs, absence reasons and match coaching notes are not exported.'],
  ];
  const headers = ['IGN', 'Full Name', 'Role', 'Completed Matches', 'Played', 'Benched',
    'Absent', 'No Record', 'Attended', 'Attendance %', 'Rated Matches', 'Coach KPI / 5',
    'Overall / 5', ...WEEKLY_METRICS.map((metric) => metric.label + ' / 5')];
  const players: Cell[][] = [
    ['DAG Esports - Player Performance'], ['Team / Month', name],
    ['Missing/partial ratings do not count as a scored assessment.'], [],
    headers,
    ...report.players.map((p) => [
      p.ign, p.fullName, p.role, report.totals.completed, p.played, p.benched, p.absent,
      p.unrecorded, p.attended, percent(p.attendancePct), p.rated, score(p.coachAvg),
      score(p.overall), ...WEEKLY_METRICS.map(({ key }) => score(p.metrics[key])),
    ]),
  ];
  const matchRows: Cell[][] = [
    ['DAG Esports - Completed Match Log'], ['Team / Month', name],
    ['Only completed matches are included.'], [],
    ['Date', 'Opponent', 'Match Type', 'DAG Score', 'Opponent Score', 'Result', 'Rated Players', 'Average KPI / 5'],
    ...report.matches.map((match) => [
      match.match_date.slice(0, 10), match.opponent_name, match.match_type || '',
      match.dag_score ?? 'N/A', match.opponent_score ?? 'N/A', match.result || '',
      match.ratedPlayers, display(match.averageKpi),
    ]),
  ];
  const reportRows: Cell[][] = [
    ['DAG Esports - Weekly Coaching Notes'], ['Team / Month', name],
    ['Weeks included when their Monday start date is within the selected month.'], [],
    ['Player IGN', 'Week Starting', 'Coach Comment', 'Improvement Goals'],
    ...report.weeklyReports.map((r) => [r.ign, r.week_start, r.coach_comment || '', r.improvements || '']),
  ];
  const sheets: Sheet[] = [
    { name: 'Overview', rows: summary, widths: [47, 32], scoreColumns: [1], percentColumns: [1] },
    { name: 'Players', rows: players, widths: [20, 31, 18, 19, 13, 13, 13, 13, 14, 17, 19, 18, 17, 17, 17, 18, 20, 20, 18], headerRow: 5, scoreColumns: [11, 12, 13, 14, 15, 16, 17, 18], percentColumns: [9] },
    { name: 'Matches', rows: matchRows, widths: [17, 32, 22, 17, 18, 16, 19, 22], headerRow: 5, scoreColumns: [7] },
    { name: 'Weekly Reports', rows: reportRows, widths: [21, 18, 52, 52], headerRow: 5 },
  ];

  const namespace = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const relNs = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const relationships = 'http://schemas.openxmlformats.org/package/2006/relationships';
  const workbook = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<workbook xmlns="' + namespace + '" xmlns:r="' + relNs + '"><sheets>' +
    sheets.map((sheet, i) => '<sheet name="' + xmlEscape(sheet.name) +
      '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>').join('') +
    '</sheets></workbook>';
  const workbookRels = '<?xml version="1.0" encoding="UTF-8"?>' +
    '<Relationships xmlns="' + relationships + '">' +
    sheets.map((sheet, i) => '<Relationship Id="rId' + (i + 1) +
      '" Type="' + relNs + '/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>').join('') +
    '<Relationship Id="rId' + (sheets.length + 1) + '" Type="' + relNs +
      '/styles" Target="styles.xml"/></Relationships>';
  const rootRels = '<?xml version="1.0" encoding="UTF-8"?>' +
    '<Relationships xmlns="' + relationships + '"><Relationship Id="rId1" Type="' +
    relNs + '/officeDocument" Target="xl/workbook.xml"/></Relationships>';
  const contentTypes = '<?xml version="1.0" encoding="UTF-8"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
    sheets.map((sheet, i) => '<Override PartName="/xl/worksheets/sheet' + (i + 1) +
      '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('') +
    '</Types>';
  const files = [
    { path: '[Content_Types].xml', data: utf8(contentTypes) },
    { path: '_rels/.rels', data: utf8(rootRels) },
    { path: 'xl/workbook.xml', data: utf8(workbook) },
    { path: 'xl/_rels/workbook.xml.rels', data: utf8(workbookRels) },
    { path: 'xl/styles.xml', data: utf8(stylesXml) },
    ...sheets.map((sheet, i) => ({ path: 'xl/worksheets/sheet' + (i + 1) + '.xml', data: utf8(worksheetXml(sheet)) })),
  ];
  const bytes = zipStore(files);
  return new Blob([bytes.buffer as ArrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
