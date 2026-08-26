export interface Settings {
  salesPersonName: string;
  employeeId?: string;
  mobileNumber?: string;
}

export type MasterType = 'customer' | 'stay';

export interface MasterEntry {
  id: string;
  name: string;
  place: string;
  address: string;
  type: MasterType;
  synced: boolean;
}

export type TravelMode = 'bike' | 'bus';

export interface VisitRow {
  localId: string;
  sNo: number;
  travelMode: TravelMode;
  departure: string;
  startTime: string;
  departureLat?: number;
  departureLng?: number;
  arrival: string;
  arrivalTime: string;
  arrivalLat?: number;
  arrivalLng?: number;
  distanceKm?: number;
  // Only set when travelMode is 'bus' — a fare amount instead of a
  // GPS-derived distance, since there's no vehicle GPS to track.
  busFare?: number;
  timeAtCustomer: string;
  metWith: string;
  keyFeedback: string;
  comments: string;
  followUpRequired: boolean;
  // Set once the user taps "Submit Visit" on this row — locks it for
  // editing regardless of whether the network call actually succeeded.
  submitted: boolean;
  // Set once this row is confirmed saved on the server. A submitted row
  // that isn't yet synced is queued for background retry.
  synced: boolean;
}

export type ReportStatus = 'draft' | 'pending-sync' | 'synced';

export interface DailyReport {
  id: string;
  date: string;
  salesPerson: string;
  employeeId?: string;
  rows: VisitRow[];
  status: ReportStatus;
  createdAt: number;
  updatedAt: number;
  reportId?: string;
  // Optional fixed reimbursement for the day (food/incidentals), separate
  // from any per-visit travel cost — entered once per report, not derived.
  dailyAllowance?: number;
}

// Bike trips have no ticket to record, so their expense-sheet fare is
// calculated from distance instead of entered directly.
export const BIKE_FARE_PER_KM = 3.5;

export function emptyVisitRow(sNo: number, travelMode: TravelMode = 'bike'): VisitRow {
  return {
    localId: `${Date.now()}-${sNo}-${Math.random().toString(36).slice(2, 8)}`,
    sNo,
    travelMode,
    departure: '',
    startTime: '',
    arrival: '',
    arrivalTime: '',
    timeAtCustomer: '',
    metWith: '',
    keyFeedback: '',
    comments: '',
    followUpRequired: false,
    submitted: false,
    synced: false,
  };
}

export function computeReportStatus(rows: VisitRow[]): ReportStatus {
  const submittedRows = rows.filter((r) => r.submitted);
  if (submittedRows.length === 0) return 'draft';
  return submittedRows.every((r) => r.synced) ? 'synced' : 'pending-sync';
}
