import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { format } from 'date-fns';
import { Button, Card, Text } from 'react-native-paper';
import { BarChart } from 'react-native-gifted-charts';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useReporterStore } from '@/lib/store';
import { fetchDashboardData, isBackendConfigured } from '@/lib/appsScript';
import { fromLocalReports, fromRemoteRows, todayStats, dailySeries, weeklySeries, type VisitRecord } from '@/lib/dashboard';

const today = () => format(new Date(), 'yyyy-MM-dd');

function StatTile({ icon, label, value }: { icon: string; label: string; value: string | number }) {
  return (
    <Card style={styles.statCard} mode="outlined">
      <Card.Content style={styles.statContent}>
        <View style={styles.statIconWrap}>
          <MaterialCommunityIcons name={icon as never} size={20} color="#1565c0" />
        </View>
        <View style={styles.statTextWrap}>
          <Text variant="headlineSmall" style={styles.statValue} numberOfLines={1}>
            {value}
          </Text>
          <Text variant="bodySmall" style={styles.statLabel} numberOfLines={2}>
            {label}
          </Text>
        </View>
      </Card.Content>
    </Card>
  );
}

export default function DashboardScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const chartWidth = Math.max(width - 16 * 2 - 16 * 2 - 8, 200); // screen minus container + card padding
  const settings = useReporterStore((s) => s.settings);
  const reports = useReporterStore((s) => s.reports);
  const trySyncPendingReports = useReporterStore((s) => s.trySyncPendingReports);
  const [remoteRecords, setRemoteRecords] = useState<VisitRecord[]>([]);

  const localReports = useMemo(() => reports.filter((r) => r.status !== 'synced'), [reports]);

  useFocusEffect(
    useCallback(() => {
      trySyncPendingReports().catch(() => {});
      if (isBackendConfigured()) {
        fetchDashboardData()
          .then((rows) => setRemoteRecords(fromRemoteRows(rows)))
          .catch(() => {});
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  const records = useMemo(() => [...remoteRecords, ...fromLocalReports(localReports)], [remoteRecords, localReports]);
  const stats = useMemo(() => todayStats(records, today()), [records]);
  const daily = useMemo(() => dailySeries(records, 7), [records]);
  const weekly = useMemo(() => weeklySeries(records, 6), [records]);

  const dailyChartData = daily.map((d) => ({ value: d.visits, label: d.date }));
  const weeklyChartData = weekly.map((w) => ({ value: w.distance, label: w.week }));

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Card style={styles.welcomeCard}>
        <Card.Content>
          <Text variant="bodyMedium" style={styles.welcomeSubtitle}>
            Welcome back
          </Text>
          <Text variant="titleLarge" style={styles.welcomeName}>
            {settings?.salesPersonName || 'Salesperson'}
          </Text>
          <Button
            mode="contained"
            buttonColor="white"
            textColor="#1565c0"
            icon="plus"
            style={styles.newVisitButton}
            onPress={() => router.push('/new-visit')}
          >
            New Visit Report
          </Button>
        </Card.Content>
      </Card>

      <View style={styles.statsRow}>
        <StatTile icon="map-marker" label="Visits Today" value={stats.visits} />
        <StatTile icon="map-marker-distance" label="Distance (KM)" value={stats.distance} />
      </View>
      <View style={styles.statsRow}>
        <StatTile icon="account-group" label="Customers Visited" value={stats.customers} />
        <StatTile icon="calendar-refresh" label="Follow-ups Required" value={stats.followUps} />
      </View>

      <Card style={styles.card} mode="outlined">
        <Card.Content>
          <Text variant="titleSmall" style={styles.bold}>
            Weekly Summary — visits per day
          </Text>
          <BarChart
            data={dailyChartData}
            width={chartWidth}
            barWidth={18}
            spacing={18}
            roundedTop
            frontColor="#1565c0"
            yAxisThickness={0}
            xAxisThickness={1}
            noOfSections={4}
            height={160}
            initialSpacing={10}
            xAxisLabelTextStyle={styles.chartAxisLabel}
            yAxisTextStyle={styles.chartAxisLabel}
          />
        </Card.Content>
      </Card>

      <Card style={styles.card} mode="outlined">
        <Card.Content>
          <Text variant="titleSmall" style={styles.bold}>
            Monthly Summary — distance per week (KM)
          </Text>
          <BarChart
            data={weeklyChartData}
            width={chartWidth}
            barWidth={22}
            spacing={18}
            roundedTop
            frontColor="#00897b"
            yAxisThickness={0}
            xAxisThickness={1}
            noOfSections={4}
            height={160}
            initialSpacing={10}
            xAxisLabelTextStyle={styles.chartAxisLabel}
            yAxisTextStyle={styles.chartAxisLabel}
          />
        </Card.Content>
      </Card>

      {!isBackendConfigured() && (
        <Text variant="bodySmall" style={styles.footerNote}>
          Connect a Google Sheets backend in Settings to see company-wide totals.
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 16 },
  welcomeCard: { backgroundColor: '#1565c0', elevation: 0 },
  welcomeSubtitle: { color: 'white', opacity: 0.85 },
  welcomeName: { color: 'white', fontWeight: '700' },
  newVisitButton: { marginTop: 14, alignSelf: 'flex-start' },
  statsRow: { flexDirection: 'row', gap: 12 },
  statCard: { flex: 1 },
  statContent: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#D7E7FB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statTextWrap: { flex: 1, minWidth: 0 },
  statValue: { fontWeight: '700' },
  statLabel: { opacity: 0.65, flexShrink: 1 },
  card: { gap: 8 },
  bold: { fontWeight: '700', marginBottom: 8 },
  chartAxisLabel: { fontSize: 10 },
  footerNote: { textAlign: 'center', opacity: 0.6 },
});
