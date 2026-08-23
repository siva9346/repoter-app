import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { Button, Card, Text, TextInput, Snackbar } from 'react-native-paper';
import { useReporterStore } from '@/lib/store';
import { isBackendConfigured } from '@/lib/appsScript';
import type { Settings } from '@/lib/types';

export default function SettingsScreen() {
  const settings = useReporterStore((s) => s.settings);
  const saveSettings = useReporterStore((s) => s.saveSettings);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<Settings>({
    defaultValues: { salesPersonName: '', employeeId: '', mobileNumber: '' },
  });

  useEffect(() => {
    if (settings) reset(settings);
  }, [settings, reset]);

  const onSubmit = async (values: Settings) => {
    setSaving(true);
    await saveSettings(values);
    setSaving(false);
    setSaved(true);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Card style={styles.card} mode="outlined">
        <Card.Content>
          <Text variant="titleMedium" style={styles.title}>
            Your details
          </Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            Your name appears automatically on every visit report you create.
          </Text>

          <Controller
            control={control}
            name="salesPersonName"
            rules={{ required: true }}
            render={({ field }) => (
              <TextInput
                label="Salesperson Name *"
                mode="outlined"
                value={field.value}
                onChangeText={field.onChange}
                error={!!errors.salesPersonName}
                style={styles.input}
              />
            )}
          />
          <Controller
            control={control}
            name="employeeId"
            render={({ field }) => (
              <TextInput
                label="Employee ID (optional)"
                mode="outlined"
                value={field.value}
                onChangeText={field.onChange}
                style={styles.input}
              />
            )}
          />
          <Controller
            control={control}
            name="mobileNumber"
            render={({ field }) => (
              <TextInput
                label="Mobile Number (optional)"
                mode="outlined"
                keyboardType="phone-pad"
                value={field.value}
                onChangeText={field.onChange}
                style={styles.input}
              />
            )}
          />

          <Button
            mode="contained"
            onPress={handleSubmit(onSubmit)}
            loading={saving}
            disabled={saving || (!isDirty && !!settings)}
            style={styles.button}
          >
            Save Settings
          </Button>
        </Card.Content>
      </Card>

      <Card style={styles.card} mode="outlined">
        <Card.Content>
          <Text variant="titleSmall" style={styles.title}>
            Backend connection
          </Text>
          <Text variant="bodyMedium">
            {isBackendConfigured()
              ? 'Connected to Google Sheets backend.'
              : 'Not connected. Reports are saved on this device only until an admin sets EXPO_PUBLIC_APPS_SCRIPT_URL. See google-apps-script/SETUP.md.'}
          </Text>
        </Card.Content>
      </Card>

      <Snackbar visible={saved} onDismiss={() => setSaved(false)} duration={2000}>
        Settings saved
      </Snackbar>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 16 },
  card: { gap: 4 },
  title: { fontWeight: '700', marginBottom: 4 },
  subtitle: { marginBottom: 12, opacity: 0.7 },
  input: { marginBottom: 12 },
  button: { marginTop: 4 },
});
