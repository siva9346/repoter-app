import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SegmentedButtons } from 'react-native-paper';
import { useFocusEffect } from 'expo-router';
import MasterList from '@/components/MasterList';
import { useReporterStore } from '@/lib/store';

export default function MastersScreen() {
  const [tab, setTab] = useState<'customer' | 'stay'>('customer');
  const syncMastersFromRemote = useReporterStore((s) => s.syncMastersFromRemote);
  const retryUnsyncedMasters = useReporterStore((s) => s.retryUnsyncedMasters);

  useFocusEffect(
    useCallback(() => {
      syncMastersFromRemote().catch(() => {});
      retryUnsyncedMasters().catch(() => {});
    }, [syncMastersFromRemote, retryUnsyncedMasters])
  );

  return (
    <View style={styles.container}>
      <SegmentedButtons
        value={tab}
        onValueChange={(v) => setTab(v as 'customer' | 'stay')}
        style={styles.segmented}
        buttons={[
          { value: 'customer', label: 'Customers' },
          { value: 'stay', label: 'Stay Locations' },
        ]}
      />
      {tab === 'customer' ? (
        <MasterList type="customer" label="Customer" />
      ) : (
        <MasterList type="stay" label="Stay Location" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 16 },
  segmented: { marginBottom: 4 },
});
