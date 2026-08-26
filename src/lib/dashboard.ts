import { format } from 'date-fns';
import type { RemoteReportRow } from './appsScript';
import type { DailyReport } from './types';

// report.date and today() elsewhere in the app are local calendar dates
// (date-fns `format`), not UTC. `Date#toISOString` renders in UTC, which
// in timezones ahead of UTC (e.g. IST, +5:30) names the wrong calendar
// day for the first few hours after local midnight — bucket keys here
// must be derived the same local way or they silently drift by a day.
const localDateKey = (d: Date) => format(d, 'yyyy-MM-dd');

// `new Date('yyyy-MM-dd')` parses as UTC midnight, not local midnight —
// in timezones behind UTC that lands on the previous local day, throwing
// off the getDay()/getDate() arithmetic below. Build the Date from its
// local-time constructor instead so it always lands on the intended day.
function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export interface VisitRecord {
  date: string;
  salesPerson: string;
  arrival: string;
  distanceKm: number;
  followUpRequired: boolean;
}

export function fromRemoteRows(rows: RemoteReportRow[]): VisitRecord[] {
  return rows.map((r) => ({
    date: String(r.Date).slice(0, 10),
    salesPerson: r['Sales Person'],
    arrival: r.Arrival,
    distanceKm: Number(r['Distance KM']) || 0,
    followUpRequired: r['Follow Up Required'] === 'Yes',
  }));
}

export function fromLocalReports(reports: DailyReport[]): VisitRecord[] {
  const records: VisitRecord[] = [];
  for (const report of reports) {
    // Only rows the salesperson actually submitted count as a visit — a
    // half-filled row still being drafted shouldn't show up in stats.
    for (const row of report.rows.filter((r) => r.submitted)) {
      records.push({
        date: report.date,
        salesPerson: report.salesPerson,
        arrival: row.arrival,
        distanceKm: row.distanceKm || 0,
        followUpRequired: row.followUpRequired,
      });
    }
  }
  return records;
}

export function todayStats(records: VisitRecord[], today: string) {
  const todays = records.filter((r) => r.date === today);
  const distance = todays.reduce((sum, r) => sum + r.distanceKm, 0);
  const customers = new Set(todays.map((r) => r.arrival).filter(Boolean));
  const followUps = records.filter((r) => r.followUpRequired).length;
  return {
    visits: todays.length,
    distance: Math.round(distance * 10) / 10,
    customers: customers.size,
    followUps,
  };
}

export function dailySeries(records: VisitRecord[], days: number) {
  const result: { date: string; visits: number; distance: number }[] = [];
  const byDate = new Map<string, { visits: number; distance: number }>();
  for (const r of records) {
    const entry = byDate.get(r.date) || { visits: 0, distance: 0 };
    entry.visits += 1;
    entry.distance += r.distanceKm;
    byDate.set(r.date, entry);
  }
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = localDateKey(d);
    const entry = byDate.get(key) || { visits: 0, distance: 0 };
    result.push({ date: key.slice(5), visits: entry.visits, distance: Math.round(entry.distance * 10) / 10 });
  }
  return result;
}

export function weeklySeries(records: VisitRecord[], weeks: number) {
  const result: { week: string; visits: number; distance: number }[] = [];
  const byWeek = new Map<string, { visits: number; distance: number }>();
  for (const r of records) {
    const d = parseLocalDate(r.date);
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - d.getDay());
    const key = localDateKey(weekStart);
    const entry = byWeek.get(key) || { visits: 0, distance: 0 };
    entry.visits += 1;
    entry.distance += r.distanceKm;
    byWeek.set(key, entry);
  }
  const now = new Date();
  for (let i = weeks - 1; i >= 0; i--) {
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay() - i * 7);
    const key = localDateKey(weekStart);
    const entry = byWeek.get(key) || { visits: 0, distance: 0 };
    result.push({ week: key.slice(5), visits: entry.visits, distance: Math.round(entry.distance * 10) / 10 });
  }
  return result;
}
