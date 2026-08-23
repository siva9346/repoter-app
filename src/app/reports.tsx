import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  Banner,
  Button,
  Card,
  Chip,
  DataTable,
  List,
  Text,
  TextInput,
} from 'react-native-paper';
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
  const [salesPerson, setSalesPerson] = useState('');
  const [customer, setCustomer] = useState('');
  const [remoteRows, setRemoteRows] = useState<RemoteReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const runSearch = useCallback(async () => {
    if (!isBackendConfigured()) {
      setError('Backend not configured — showing only reports saved on this device.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchReports({ date, salesPerson, customer });
      setRemoteRows(rows);
    } catch {
      setError('Could not reach the backend. Showing on-device reports only.');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, salesPerson, customer]);

  useFocusEffect(
    useCallback(() => {
      trySyncPendingReports().catch(() => {});
      runSearch();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  const groups = useMemo(() => groupRows(remoteRows), [remoteRows]);

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportReportsToExcel(remoteRows);
    } catch {
      setError('Could not export to Excel.');
    } finally {
      setExporting(false);
    }
  };

  return (
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
          <View style={styles.searchRow}>
            <TextInput
              label="Date (YYYY-MM-DD)"
              mode="outlined"
              value={date}
              onChangeText={setDate}
              style={styles.flexInput}
            />
            <TextInput
              label="Salesperson"
              mode="outlined"
              value={salesPerson}
              onChangeText={setSalesPerson}
              style={styles.flexInput}
            />
          </View>
          <TextInput
            label="Customer name"
            mode="outlined"
            placeholder="View visit history for a customer"
            value={customer}
            onChangeText={setCustomer}
          />
          <View style={styles.searchRow}>
            <Button mode="contained" onPress={runSearch} loading={loading} style={styles.flexInput}>
              Search
            </Button>
            <Button
              mode="outlined"
              icon="download"
              onPress={handleExport}
              loading={exporting}
              disabled={remoteRows.length === 0}
            >
              Export
            </Button>
          </View>
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
        return (
          <List.Accordion
            key={group.key}
            title={`${group.date} — ${group.salesPerson}`}
            description={`${group.rows.length} visits · ${totalKm.toFixed(1)} KM · ₹${totalFare.toFixed(2)} fare`}
            expanded={expanded === group.key}
            onPress={() => setExpanded(expanded === group.key ? null : group.key)}
            style={styles.accordion}
          >
            <ScrollView horizontal>
              <DataTable style={styles.table}>
                <DataTable.Header>
                  <DataTable.Title style={styles.col}>#</DataTable.Title>
                  <DataTable.Title style={styles.col}>Mode</DataTable.Title>
                  <DataTable.Title style={styles.colWide}>Departure</DataTable.Title>
                  <DataTable.Title style={styles.colWide}>Arrival</DataTable.Title>
                  <DataTable.Title style={styles.col}>KM / Fare</DataTable.Title>
                  <DataTable.Title style={styles.colWide}>Met With</DataTable.Title>
                  <DataTable.Title style={styles.col}>Follow-up</DataTable.Title>
                </DataTable.Header>
                {group.rows.map((row, i) => {
                  const isBus = row['Travel Mode'] === 'bus';
                  return (
                    <DataTable.Row key={i}>
                      <DataTable.Cell style={styles.col}>{row['S.No']}</DataTable.Cell>
                      <DataTable.Cell style={styles.col}>{isBus ? 'Bus' : 'Bike'}</DataTable.Cell>
                      <DataTable.Cell style={styles.colWide}>{row.Departure}</DataTable.Cell>
                      <DataTable.Cell style={styles.colWide}>{row.Arrival}</DataTable.Cell>
                      <DataTable.Cell style={styles.col}>
                        {isBus ? `₹${row['Bus Fare']}` : row['Distance KM']}
                      </DataTable.Cell>
                      <DataTable.Cell style={styles.colWide}>{row['Met With']}</DataTable.Cell>
                      <DataTable.Cell style={styles.col}>
                        {row['Follow Up Required'] === 'Yes' ? 'Yes' : ''}
                      </DataTable.Cell>
                    </DataTable.Row>
                  );
                })}
              </DataTable>
            </ScrollView>
          </List.Accordion>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  card: {},
  cardContent: { gap: 12 },
  bold: { fontWeight: '700' },
  localRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  localRowActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chipWarning: { backgroundColor: '#ffe0b2' },
  searchRow: { flexDirection: 'row', gap: 12 },
  flexInput: { flex: 1 },
  banner: { borderRadius: 8 },
  emptyText: { textAlign: 'center', opacity: 0.6, paddingVertical: 32 },
  accordion: {
    backgroundColor: 'white',
    borderRadius: 10,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#E2E4E8',
  },
  table: { minWidth: 500 },
  col: { flex: 0.6 },
  colWide: { flex: 1.4 },
});
