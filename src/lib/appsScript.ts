import type { DailyReport, MasterType, Settings, TravelMode, VisitRow } from './types';

const APPS_SCRIPT_URL = process.env.EXPO_PUBLIC_APPS_SCRIPT_URL || '';

export function isBackendConfigured(): boolean {
  return APPS_SCRIPT_URL.length > 0;
}

async function get<T>(params: Record<string, string>): Promise<T> {
  if (!isBackendConfigured()) throw new Error('Backend not configured');
  const url = new URL(APPS_SCRIPT_URL);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), { method: 'GET' });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}

// Apps Script Web Apps don't support CORS preflight (OPTIONS), so POST
// bodies are sent as text/plain to keep the request "simple" and
// preflight-free. The script still JSON.parses the raw body.
async function post<T>(payload: Record<string, unknown>): Promise<T> {
  if (!isBackendConfigured()) throw new Error('Backend not configured');
  const res = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}

export interface RemoteMasterRecord {
  Name: string;
  Place: string;
  Address: string;
}

interface MastersResponse {
  ok: boolean;
  customers?: RemoteMasterRecord[];
  stayLocations?: RemoteMasterRecord[];
}

export async function fetchMasters(): Promise<{
  customers: RemoteMasterRecord[];
  stayLocations: RemoteMasterRecord[];
}> {
  const data = await get<MastersResponse>({ action: 'masters' });
  return { customers: data.customers || [], stayLocations: data.stayLocations || [] };
}

export async function pushMasterEntry(
  type: MasterType,
  entry: { name: string; place: string; address: string }
): Promise<void> {
  const action = type === 'customer' ? 'addCustomer' : 'addStayLocation';
  const key = type === 'customer' ? 'customer' : 'stayLocation';
  await post({ action, [key]: entry });
}

export async function deleteMasterEntry(type: MasterType, name: string): Promise<void> {
  const action = type === 'customer' ? 'deleteCustomer' : 'deleteStayLocation';
  await post({ action, name });
}

export async function pushSalespersonProfile(settings: Settings): Promise<void> {
  await post({ action: 'saveSalesperson', settings });
}

interface SubmitReportResponse {
  ok: boolean;
  reportId?: string;
  error?: string;
}

export async function submitReport(report: DailyReport): Promise<{ reportId: string }> {
  const data = await post<SubmitReportResponse>({
    action: 'submitReport',
    reportId: report.reportId,
    date: report.date,
    salesPerson: report.salesPerson,
    employeeId: report.employeeId,
    rows: report.rows.map((r) => ({
      sNo: r.sNo,
      travelMode: r.travelMode,
      departure: r.departure,
      startTime: r.startTime,
      arrival: r.arrival,
      arrivalTime: r.arrivalTime,
      distanceKm: r.distanceKm,
      busFare: r.busFare,
      timeAtCustomer: r.timeAtCustomer,
      metWith: r.metWith,
      keyFeedback: r.keyFeedback,
      comments: r.comments,
      followUpRequired: r.followUpRequired,
      departureLat: r.departureLat,
      departureLng: r.departureLng,
      arrivalLat: r.arrivalLat,
      arrivalLng: r.arrivalLng,
    })),
  });
  if (!data.ok || !data.reportId) throw new Error(data.error || 'Submit failed');
  return { reportId: data.reportId };
}

export interface RemoteReportRow {
  'Report Id': string;
  Date: string;
  'Sales Person': string;
  'Employee Id': string;
  'S.No': number;
  'Travel Mode': string;
  Departure: string;
  'Start Time': string;
  Arrival: string;
  'Arrival Time': string;
  'Distance KM': number;
  'Bus Fare': number;
  'Time At Customer': string;
  'Met With': string;
  'Key Feedback': string;
  Comments: string;
  'Follow Up Required': string;
  'Departure Latitude': number;
  'Departure Longitude': number;
  'Arrival Latitude': number;
  'Arrival Longitude': number;
  'Submitted At': string;
}

interface ReportsResponse {
  ok: boolean;
  reports?: RemoteReportRow[];
}

export async function fetchReports(filters: {
  date?: string;
  salesPerson?: string;
  customer?: string;
}): Promise<RemoteReportRow[]> {
  const params: Record<string, string> = { action: 'reports' };
  if (filters.date) params.date = filters.date;
  if (filters.salesPerson) params.salesPerson = filters.salesPerson;
  if (filters.customer) params.customer = filters.customer;
  const data = await get<ReportsResponse>(params);
  return data.reports || [];
}

export async function fetchDashboardData(): Promise<RemoteReportRow[]> {
  const data = await get<ReportsResponse>({ action: 'dashboard' });
  return data.reports || [];
}

// Lets New Visit hydrate a day's form from the sheet when it isn't cached
// locally — e.g. a report submitted from a different device, or a fresh
// install. Rows come back already submitted/synced since they exist on
// the server.
export function remoteRowsToVisitRows(rows: RemoteReportRow[]): VisitRow[] {
  return rows
    .slice()
    .sort((a, b) => Number(a['S.No']) - Number(b['S.No']))
    .map((r) => ({
      localId: `${r['Report Id']}-${r['S.No']}`,
      sNo: Number(r['S.No']),
      travelMode: (r['Travel Mode'] === 'bus' ? 'bus' : 'bike') as TravelMode,
      departure: r.Departure || '',
      startTime: r['Start Time'] || '',
      departureLat: r['Departure Latitude'] || undefined,
      departureLng: r['Departure Longitude'] || undefined,
      arrival: r.Arrival || '',
      arrivalTime: r['Arrival Time'] || '',
      arrivalLat: r['Arrival Latitude'] || undefined,
      arrivalLng: r['Arrival Longitude'] || undefined,
      distanceKm: r['Distance KM'] || undefined,
      busFare: r['Bus Fare'] || undefined,
      timeAtCustomer: r['Time At Customer'] || '',
      metWith: r['Met With'] || '',
      keyFeedback: r['Key Feedback'] || '',
      comments: r.Comments || '',
      followUpRequired: r['Follow Up Required'] === 'Yes',
      submitted: true,
      synced: true,
    }));
}
