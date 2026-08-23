import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { DailyReport } from './types';

function escapeHtml(value: string | number | undefined): string {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildHtml(report: DailyReport): string {
  const rowsHtml = report.rows
    .map((r) => {
      const feedback = [r.keyFeedback, r.comments].filter(Boolean).join(' — ');
      const isBus = r.travelMode === 'bus';
      const travelValue = isBus
        ? r.busFare != null
          ? `₹${r.busFare}`
          : ''
        : r.distanceKm != null
          ? `${r.distanceKm} KM`
          : '';
      return `
      <tr>
        <td class="sno">${r.sNo}</td>
        <td class="mode">${isBus ? 'Bus' : 'Bike'}</td>
        <td>${escapeHtml(r.departure)}</td>
        <td class="time">${escapeHtml(r.startTime)}</td>
        <td>${escapeHtml(r.arrival)}</td>
        <td class="time">${escapeHtml(r.arrivalTime)}</td>
        <td class="num">${travelValue}</td>
        <td>${escapeHtml(r.timeAtCustomer)}</td>
        <td>${escapeHtml(r.metWith)}${r.followUpRequired ? ' <span class="flag">Follow-up</span>' : ''}</td>
      </tr>
      <tr class="feedback-row">
        <td colspan="9"><span class="feedback-label">Key feedback:</span> ${escapeHtml(feedback) || '&nbsp;'}</td>
      </tr>`;
    })
    .join('');

  const totalKm = report.rows.filter((r) => r.travelMode !== 'bus').reduce((sum, r) => sum + (r.distanceKm || 0), 0);
  const totalFare = report.rows.filter((r) => r.travelMode === 'bus').reduce((sum, r) => sum + (r.busFare || 0), 0);

  return `
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: -apple-system, Roboto, Arial, sans-serif; padding: 24px; color: #1a1a1a; }
          h1 { font-size: 18px; margin-bottom: 4px; }
          .meta { font-size: 13px; color: #444; margin-bottom: 16px; }
          .meta strong { color: #000; }
          table { width: 100%; border-collapse: collapse; font-size: 10px; table-layout: fixed; }
          th, td { border: 1px solid #999; padding: 5px 6px; text-align: left; vertical-align: top; word-wrap: break-word; }
          th { background: #ffffff; color: #000000; font-weight: 700; border-bottom: 2px solid #1a1a1a; }
          col.sno { width: 4%; }
          col.mode { width: 6%; }
          col.time { width: 9%; }
          col.km { width: 7%; }
          .sno, .num, .mode { text-align: center; }
          .feedback-row td { background: #f4f6f8; }
          .feedback-label { font-style: italic; color: #555; margin-right: 4px; }
          .flag { display: inline-block; margin-left: 4px; padding: 1px 5px; border-radius: 3px; background: #fce8cc; font-size: 9px; }
          .summary { margin-top: 16px; font-size: 12px; }
          .summary div { margin-top: 2px; }
        </style>
      </head>
      <body>
        <h1>Daily Visit Report</h1>
        <div class="meta">
          <div><strong>Sales Person:</strong> ${escapeHtml(report.salesPerson)}</div>
          <div><strong>Date:</strong> ${escapeHtml(report.date)}</div>
        </div>
        <table>
          <colgroup>
            <col class="sno" /><col class="mode" /><col /><col class="time" /><col /><col class="time" />
            <col class="km" /><col /><col />
          </colgroup>
          <thead>
            <tr>
              <th>S.No</th><th>Mode</th><th>Departure</th><th>Time</th><th>Arrival</th><th>Time</th>
              <th>Distance / Fare</th><th>Time At Customer</th><th>Met With</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
        <div class="summary">
          <div><strong>${report.rows.length}</strong> visits</div>
          <div><strong>${totalKm.toFixed(1)} KM</strong> by bike</div>
          <div><strong>₹${totalFare.toFixed(2)}</strong> bus fare</div>
        </div>
      </body>
    </html>
  `;
}

export async function shareDailyReportPdf(report: DailyReport): Promise<void> {
  const html = buildHtml(report);
  const { uri } = await Print.printToFileAsync({ html, base64: false });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `Visit Report — ${report.date}`,
      UTI: 'com.adobe.pdf',
    });
  }
}
