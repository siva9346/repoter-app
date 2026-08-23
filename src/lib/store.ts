import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { computeReportStatus, type DailyReport, type MasterEntry, type MasterType, type Settings, type VisitRow } from './types';
import {
  pushMasterEntry,
  deleteMasterEntry,
  fetchMasters,
  submitReport,
  pushSalespersonProfile,
  isBackendConfigured,
} from './appsScript';
import { generateId } from './id';

interface ReporterState {
  hasHydrated: boolean;
  settings: Settings | null;
  masters: MasterEntry[];
  reports: DailyReport[];

  setHasHydrated: (v: boolean) => void;
  saveSettings: (s: Settings) => Promise<void>;

  addMaster: (type: MasterType, entry: { name: string; place: string; address: string }) => Promise<void>;
  removeMaster: (entry: MasterEntry) => Promise<void>;
  syncMastersFromRemote: () => Promise<void>;
  retryUnsyncedMasters: () => Promise<void>;

  saveDraft: (
    id: string,
    date: string,
    salesPerson: string,
    employeeId: string | undefined,
    rows: VisitRow[]
  ) => void;
  loadRemoteReport: (report: DailyReport) => void;
  submitVisitRow: (
    date: string,
    salesPerson: string,
    employeeId: string | undefined,
    row: VisitRow
  ) => Promise<'synced' | 'pending-sync'>;
  trySyncPendingReports: () => Promise<number>;
}

export const useReporterStore = create<ReporterState>()(
  persist(
    (set, get) => ({
      hasHydrated: false,
      settings: null,
      masters: [],
      reports: [],

      setHasHydrated: (v) => set({ hasHydrated: v }),

      saveSettings: async (s) => {
        set({ settings: s });
        if (isBackendConfigured()) {
          try {
            await pushSalespersonProfile(s);
          } catch {
            // profile stays saved locally even if the sync attempt fails;
            // it'll just push again next time Settings is saved
          }
        }
      },

      addMaster: async (type, entry) => {
        let synced = false;
        if (isBackendConfigured()) {
          try {
            await pushMasterEntry(type, entry);
            synced = true;
          } catch {
            synced = false;
          }
        }
        const newEntry: MasterEntry = { id: generateId(), ...entry, type, synced };
        set((state) => ({ masters: [...state.masters, newEntry] }));
      },

      removeMaster: async (entry) => {
        set((state) => ({ masters: state.masters.filter((m) => m.id !== entry.id) }));
        if (isBackendConfigured()) {
          try {
            await deleteMasterEntry(entry.type, entry.name);
          } catch {
            // stays removed locally even if the remote delete fails
          }
        }
      },

      syncMastersFromRemote: async () => {
        if (!isBackendConfigured()) return;
        const { customers, stayLocations } = await fetchMasters();
        set((state) => {
          const existingKeys = new Set(state.masters.map((m) => `${m.type}:${m.name}`));
          const additions: MasterEntry[] = [];
          customers.forEach((c) => {
            if (!existingKeys.has(`customer:${c.Name}`)) {
              additions.push({
                id: generateId(),
                name: c.Name,
                place: c.Place || '',
                address: c.Address || '',
                type: 'customer',
                synced: true,
              });
            }
          });
          stayLocations.forEach((s) => {
            if (!existingKeys.has(`stay:${s.Name}`)) {
              additions.push({
                id: generateId(),
                name: s.Name,
                place: s.Place || '',
                address: s.Address || '',
                type: 'stay',
                synced: true,
              });
            }
          });
          return additions.length ? { masters: [...state.masters, ...additions] } : {};
        });
      },

      retryUnsyncedMasters: async () => {
        if (!isBackendConfigured()) return;
        const unsynced = get().masters.filter((m) => !m.synced);
        for (const entry of unsynced) {
          try {
            await pushMasterEntry(entry.type, entry);
            set((state) => ({
              masters: state.masters.map((m) => (m.id === entry.id ? { ...m, synced: true } : m)),
            }));
          } catch {
            // remains unsynced, retried next time
          }
        }
      },

      saveDraft: (id, date, salesPerson, employeeId, rows) => {
        set((state) => {
          const existing = state.reports.find((r) => r.id === id);
          const now = Date.now();
          const updated: DailyReport = {
            id,
            date,
            salesPerson,
            employeeId,
            rows,
            status: computeReportStatus(rows),
            createdAt: existing?.createdAt ?? now,
            updatedAt: now,
            reportId: existing?.reportId,
          };
          return { reports: [...state.reports.filter((r) => r.id !== id), updated] };
        });
      },

      // Caches a report fetched from the sheet (e.g. one submitted from a
      // different device) so it can be reopened for editing here, exactly
      // like a report this device originally submitted.
      loadRemoteReport: (report) => {
        set((state) => ({ reports: [...state.reports.filter((r) => r.id !== report.id), report] }));
      },

      // Submits a single visit row the moment the salesperson finishes it,
      // rather than waiting for the whole day. Each call appends just that
      // row to the day's report (client and sheet both), so a shop visited
      // mid-morning reaches the backend immediately instead of sitting
      // around until the salesperson remembers to submit at day's end.
      submitVisitRow: async (date, salesPerson, employeeId, row) => {
        set((state) => {
          const existing = state.reports.find((r) => r.id === date);
          const rows = existing
            ? [...existing.rows.filter((r) => r.localId !== row.localId), row].sort((a, b) => a.sNo - b.sNo)
            : [row];
          const now = Date.now();
          const updated: DailyReport = {
            id: date,
            date,
            salesPerson,
            employeeId,
            rows,
            status: computeReportStatus(rows),
            createdAt: existing?.createdAt ?? now,
            updatedAt: now,
            reportId: existing?.reportId,
          };
          return { reports: [...state.reports.filter((r) => r.id !== date), updated] };
        });

        let result: 'synced' | 'pending-sync' = 'pending-sync';
        if (isBackendConfigured()) {
          try {
            const current = get().reports.find((r) => r.id === date);
            const singleRowReport: DailyReport = {
              id: date,
              date,
              salesPerson,
              employeeId,
              rows: [row],
              status: 'draft',
              createdAt: Date.now(),
              updatedAt: Date.now(),
              reportId: current?.reportId,
            };
            const res = await submitReport(singleRowReport);
            set((state) => {
              const rpt = state.reports.find((r) => r.id === date);
              if (!rpt) return {};
              const rows = rpt.rows.map((r) => (r.localId === row.localId ? { ...r, synced: true } : r));
              return {
                reports: state.reports.map((r) =>
                  r.id === date
                    ? { ...r, rows, reportId: res.reportId, status: computeReportStatus(rows), updatedAt: Date.now() }
                    : r
                ),
              };
            });
            result = 'synced';
          } catch {
            result = 'pending-sync';
          }
        }
        return result;
      },

      trySyncPendingReports: async () => {
        if (!isBackendConfigured()) return 0;
        let syncedCount = 0;
        for (const report of get().reports) {
          const unsynced = report.rows.filter((r) => r.submitted && !r.synced);
          if (unsynced.length === 0) continue;
          try {
            const payload: DailyReport = { ...report, rows: unsynced };
            const res = await submitReport(payload);
            set((state) => {
              const rpt = state.reports.find((r) => r.id === report.id);
              if (!rpt) return {};
              const unsyncedIds = new Set(unsynced.map((r) => r.localId));
              const rows = rpt.rows.map((r) => (unsyncedIds.has(r.localId) ? { ...r, synced: true } : r));
              return {
                reports: state.reports.map((r) =>
                  r.id === report.id
                    ? { ...r, rows, reportId: res.reportId, status: computeReportStatus(rows), updatedAt: Date.now() }
                    : r
                ),
              };
            });
            syncedCount += unsynced.length;
          } catch {
            // remains pending, retried next time
          }
        }
        return syncedCount;
      },
    }),
    {
      name: 'reporter-storage',
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
