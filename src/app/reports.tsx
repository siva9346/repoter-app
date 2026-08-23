import { useCallback, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  Banner,
  Button,
  Card,
  Chip,
  DataTable,
  IconButton,
  Snackbar,
  Text,
  TextInput,
} from 'react-native-paper';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { useReporterStore } from '@/lib/store';
import { fetchReports, isBackendConfigured, type RemoteReportRow } from '@/lib/appsScript';
import { exportReportsToExcel } from '@/lib/export';

interface ReportGroup {
  key: string;
  date: string;
  salesPerson: string;
  rows: RemoteReportRow[];
}

function groupRows(rows: RemoteReportRow[]): ReportGroup[] {
  const map = new Map<string, ReportGroup>();
  for (const row of rows) {
    const key = `${row['Report Id']}-${row.Date}`;
    if (!map.has(key)) {
      map.set(key, { key, date: String(row.Date).slice(0, 10), salesPerson: row['Sales Person'], rows: [] });
    }
    map.get(key)!.rows.push(row);
  }
  return Array.from(map.values()).sort((a, b) => (a.date < b.date ? 1 : -1));
}

export default function ReportsScreen() {
  const router = useRouter();
  const reports = useReporterStore((s) => s.reports);
  const trySyncPendingReports = useReporterStore((s) => s.trySyncPendingReports);
  const localReports = useMemo(() => reports.filter((r) => r.status !== 'synced'), [reports]);

  const [date, setDate] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [remoteRows, setRemoteRows] = useState<RemoteReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [exportingGroup, setExportingGroup] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState('');

  const runSearch = useCallback(async () => {
    if (!isBackendConfigured()) {
      setError('Backend not configured — showing only reports saved on this device.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchReports({ date });
      setRemoteRows(rows);
    } catch {
      setError('Could not reach the backend. Showing on-device reports only.');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  useFocusEffect(
    useCallback(() => {
      trySyncPendingReports().catch(() => {});
      runSearch();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  const groups = useMemo(() => groupRows(remoteRows), [remoteRows]);

  const handleDateChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') setShowPicker(false);
    if (event.type === 'set' && selected) {
      setDate(format(selected, 'yyyy-MM-dd'));
    }
  };

  const handleExportGroup = async (group: ReportGroup) => {
    setExportingGroup(group.key);
    try {
      const safeName = group.salesPerson.replace(/[^a-z0-9]+/gi, '_');
      await exportReportsToExcel(group.rows, `${group.date}-${safeName}.xlsx`);
      setSnackbar('Export ready — check the share sheet.');
    } catch {
      setSnackbar('Could not export that report.');
    } finally {
      setExportingGroup(null);
    }
  };

  const handleEditGroup = (group: ReportGroup) => {
    router.push({ pathname: '/new-visit', params: { date: group.date } });
  };

  return (
    <View style={styles.flex}>
    <ScrollView contentContainerStyle={styles.container}>
      {localReports.length > 0 && (
        <Card style={styles.card} mode="outlined">
          <Card.Content style={styles.cardContent}>
            <Text variant="titleSmall" style={styles.bold}>
              On this device (not yet submitted)
            </Text>
            {localReports.map((r) => (
              <View key={r.id} style={styles.localRow}>
                <Text variant="bodyMedium">
                  {r.date} · {r.rows.length} visit{r.rows.length !== 1 ? 's' : ''}
                </Text>
                <View style={styles.localRowActions}>
                  <Chip compact style={r.status === 'pending-sync' ? styles.chipWarning : undefined}>
                    {r.status === 'pending-sync' ? 'Pending sync' : 'Draft'}
                  </Chip>
                  <Button compact onPress={() => router.push({ pathname: '/new-visit', params: { date: r.date } })}>
                    Open
                  </Button>
                </View>
              </View>
            ))}
          </Card.Content>
        </Card>
      )}

      <Card style={styles.card} mode="outlined">
        <Card.Content style={styles.cardContent}>
          <Text variant="titleSmall" style={styles.bold}>
            Search submitted reports
          </Text>
          <Pressable onPress={() => setShowPicker(true)}>
            <TextInput
              label="Date"
              mode="outlined"
              value={date}
              placeholder="Tap to choose a date"
              editable={false}
              pointerEvents="none"
              right={<TextInput.Icon icon="calendar" />}
            />
          </Pressable>
          {!!date && (
            <Button compact style={styles.clearDateButton} onPress={() => setDate('')}>
              Clear date filter
            </Button>
          )}
          {showPicker && (
            <DateTimePicker
              value={date ? new Date(`${date}T00:00:00`) : new Date()}
              mode="date"
              display="default"
              maximumDate={new Date()}
              onChange={handleDateChange}
            />
          )}
          <Button mode="contained" onPress={runSearch} loading={loading}>
            Search
          </Button>
        </Card.Content>
      </Card>

      {error && (
        <Banner visible style={styles.banner}>
          {error}
        </Banner>
      )}

      {groups.length === 0 && !loading && (
        <Text style={styles.emptyText}>No submitted reports found.</Text>
      )}

      {groups.map((group) => {
        const totalKm = group.rows
          .filter((r) => r['Travel Mode'] !== 'bus')
          .reduce((sum, r) => sum + (Number(r['Distance KM']) || 0), 0);
        const totalFare = group.rows
          .filter((r) => r['Travel Mode'] === 'bus')
          .reduce((sum, r) => sum + (Number(r['Bus Fare']) || 0), 0);
        const isExpanded = expanded === group.key;
        return (
          <Card key={group.key} style={styles.accordion} mode="outlined">
            {/* Edit/Download used to sit beside the title inside one flex
                row — even as JSX siblings, IconButton is itself built on
                TouchableRipple, and packed edge-to-edge with the title's
                own Pressable in the same row left enough ambiguity in
                Android's touch responder that taps on the small icons
                weren't reliably registering. Actions now live on their
                own row, entirely below the title's tap zone (not beside
                it), as bigger labeled buttons — no shared row, no
                shared edges, no ambiguity about which touchable a tap
                belongs to. */}
            <Pressable
              style={styles.groupHeaderMain}
              onPress={() => setExpanded(isExpanded ? null : group.key)}
            >
              <View style={styles.groupTitleRow}>
                <View style={styles.groupTitleText}>
                  <Text variant="titleSmall" style={styles.bold}>
                    {group.date} — {group.salesPerson}
                  </Text>
                  <Text variant="bodySmall" style={styles.groupSubtitle}>
                    {group.rows.length} visits · {totalKm.toFixed(1)} KM · ₹{totalFare.toFixed(2)} fare
                  </Text>
                </View>
                <IconButton icon={isExpanded ? 'chevron-up' : 'chevron-down'} size={22} style={styles.headerIcon} />
              </View>
            </Pressable>
            <View style={styles.groupActions}>
              <Button
                compact
                mode="outlined"
                icon="pencil-outline"
                onPress={() => handleEditGroup(group)}
                style={styles.groupActionButton}
              >
                Edit
              </Button>
              <Button
                compact
                mode="outlined"
                icon="download"
                loading={exportingGroup === group.key}
                onPress={() => handleExportGroup(group)}
                style={styles.groupActionButton}
              >
                Download
              </Button>
            </View>

            {isExpanded && (
              <ScrollView horizontal showsHorizontalScrollIndicator>
                <DataTable style={styles.table}>
                  <DataTable.Header style={styles.row}>
                    <Text style={[styles.cellText, styles.cellSno, styles.headerText]}>#</Text>
                    <Text style={[styles.cellText, styles.cellMode, styles.headerText]}>Mode</Text>
                    <Text style={[styles.cellText, styles.cellPlace, styles.headerText]}>Departure</Text>
                    <Text style={[styles.cellText, styles.cellPlace, styles.headerText]}>Arrival</Text>
                    <Text style={[styles.cellText, styles.cellNum, styles.headerText]}>KM/Fare</Text>
                    <Text style={[styles.cellText, styles.cellPlace, styles.headerText]}>Met With</Text>
                    <Text style={[styles.cellText, styles.cellFollowUp, styles.headerText]}>Follow-up</Text>
                  </DataTable.Header>
                  {group.rows.map((row, i) => {
                    const isBus = row['Travel Mode'] === 'bus';
                    return (
                      <View key={i} style={styles.row}>
                        <Text style={[styles.cellText, styles.cellSno]}>{row['S.No']}</Text>
                        <Text style={[styles.cellText, styles.cellMode]}>{isBus ? 'Bus' : 'Bike'}</Text>
                        <Text style={[styles.cellText, styles.cellPlace]} numberOfLines={1}>
                          {row.Departure}
                        </Text>
                        <Text style={[styles.cellText, styles.cellPlace]} numberOfLines={1}>
                          {row.Arrival}
                        </Text>
                        <Text style={[styles.cellText, styles.cellNum]}>
                          {isBus ? `₹${row['Bus Fare']}` : row['Distance KM']}
                        </Text>
                        <Text style={[styles.cellText, styles.cellPlace]} numberOfLines={1}>
                          {row['Met With']}
                        </Text>
                        <Text style={[styles.cellText, styles.cellFollowUp]}>
                          {row['Follow Up Required'] === 'Yes' ? 'Yes' : '—'}
                        </Text>
                      </View>
                    );
                  })}
                </DataTable>
              </ScrollView>
            )}
          </Card>
        );
      })}
    </ScrollView>
      <Snackbar visible={!!snackbar} onDismiss={() => setSnackbar('')} duration={3000}>
        {snackbar}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: 16, gap: 12 },
  card: {},
  cardContent: { gap: 12 },
  bold: { fontWeight: '700' },
  localRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  localRowActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chipWarning: { backgroundColor: '#ffe0b2' },
  clearDateButton: { alignSelf: 'flex-start', marginTop: -8 },
  banner: { borderRadius: 8 },
  emptyText: { textAlign: 'center', opacity: 0.6, paddingVertical: 32 },
  accordion: {
    backgroundColor: 'white',
    borderRadius: 10,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#E2E4E8',
  },
  groupHeaderMain: { paddingTop: 12, paddingHorizontal: 16 },
  groupTitleRow: { flexDirection: 'row', alignItems: 'center' },
  groupTitleText: { flex: 1 },
  groupSubtitle: { opacity: 0.6, marginTop: 2 },
  headerIcon: { margin: 0, marginRight: -8 },
  groupActions: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 12 },
  groupActionButton: { flex: 1 },
  // Fixed pixel widths (not flex) for every column, matched exactly
  // between the header row and each data row — inside a horizontally
  // scrolling container, flex-based widths don't have a stable parent
  // width to distribute against, which is what was throwing header and
  // cell columns out of alignment with each other.
  table: { minWidth: 544, paddingHorizontal: 8 },
  // DataTable.Header ships a default paddingHorizontal: 16 that our plain
  // View data rows don't have — zeroed here so both start at the same
  // x-offset and every column lines up between the header and the rows.
  row: {
    flexDirection: 'row',
    paddingHorizontal: 0,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF0F2',
  },
  cellText: { fontSize: 12, paddingHorizontal: 4, alignSelf: 'center' },
  headerText: { fontWeight: '700', opacity: 0.6, fontSize: 11, textTransform: 'uppercase' },
  cellSno: { width: 28, textAlign: 'center' },
  cellMode: { width: 44 },
  cellPlace: { width: 110 },
  cellNum: { width: 62, textAlign: 'right' },
  cellFollowUp: { width: 66, textAlign: 'center' },
});
