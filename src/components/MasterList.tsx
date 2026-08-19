import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Button, Chip, Dialog, FAB, IconButton, List, Portal, Text, TextInput } from 'react-native-paper';
import { useForm, Controller } from 'react-hook-form';
import { useReporterStore } from '@/lib/store';
import type { MasterEntry, MasterType } from '@/lib/types';

interface FormValues {
  name: string;
  place: string;
  address: string;
}

export default function MasterList({ type, label }: { type: MasterType; label: string }) {
  const [open, setOpen] = useState(false);
  const masters = useReporterStore((s) => s.masters);
  const addMaster = useReporterStore((s) => s.addMaster);
  const removeMaster = useReporterStore((s) => s.removeMaster);
  const entries = masters.filter((m) => m.type === type).sort((a, b) => a.name.localeCompare(b.name));

  const { control, handleSubmit, reset } = useForm<FormValues>({
    defaultValues: { name: '', place: '', address: '' },
  });

  const onSubmit = async (values: FormValues) => {
    await addMaster(type, values);
    reset();
    setOpen(false);
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={entries}
        keyExtractor={(item) => item.id}
        contentContainerStyle={entries.length === 0 && styles.emptyContainer}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No {label.toLowerCase()} yet. Tap + to add one.</Text>
        }
        renderItem={({ item }: { item: MasterEntry }) => (
          <List.Item
            title={() => (
              <View style={styles.titleRow}>
                <Text>{item.name}</Text>
                {!item.synced && <Chip compact textStyle={styles.chipText}>pending sync</Chip>}
              </View>
            )}
            description={[item.place, item.address].filter(Boolean).join(' · ')}
            right={(props) => (
              <IconButton {...props} icon="delete-outline" onPress={() => removeMaster(item)} />
            )}
          />
        )}
      />

      <FAB icon="plus" style={styles.fab} onPress={() => setOpen(true)} />

      <Portal>
        <Dialog visible={open} onDismiss={() => setOpen(false)}>
          <Dialog.Title>Add {label}</Dialog.Title>
          <Dialog.Content style={styles.dialogContent}>
            <Controller
              control={control}
              name="name"
              rules={{ required: true }}
              render={({ field }) => (
                <TextInput
                  label={`${label} Name *`}
                  mode="outlined"
                  value={field.value}
                  onChangeText={field.onChange}
                />
              )}
            />
            <Controller
              control={control}
              name="place"
              render={({ field }) => (
                <TextInput label="Place" mode="outlined" value={field.value} onChangeText={field.onChange} />
              )}
            />
            <Controller
              control={control}
              name="address"
              render={({ field }) => (
                <TextInput
                  label="Address"
                  mode="outlined"
                  multiline
                  value={field.value}
                  onChangeText={field.onChange}
                />
              )}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setOpen(false)}>Cancel</Button>
            <Button onPress={handleSubmit(onSubmit)}>Save</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  emptyContainer: { flexGrow: 1, justifyContent: 'center' },
  emptyText: { textAlign: 'center', opacity: 0.6, paddingVertical: 32 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chipText: { fontSize: 10 },
  fab: { position: 'absolute', right: 16, bottom: 16 },
  dialogContent: { gap: 12 },
});
