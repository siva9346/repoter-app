import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useForm, useFieldArray } from 'react-hook-form';
import { useLocalSearchParams } from 'expo-router';
import { format } from 'date-fns';
import { Button, Card, SegmentedButtons, Snackbar, Text, TextInput } from 'react-native-paper';
import { useReporterStore } from '@/lib/store';
import { emptyVisitRow } from '@/lib/types';
import type { DailyReport, TravelMode } from '@/lib/types';
import type { ReportFormValues } from '@/lib/reportForm';
import { shareDailyReportPdf } from '@/lib/pdf';
import VisitRowCard from '@/components/VisitRowCard';

const todayStr = () => format(new Date(), 'yyyy-MM-dd');

export default function NewVisitScreen() {
  const params = useLocalSearchParams<{ date?: string }>();
  const settings = useReporterStore((s) => s.settings);
  const masters = useReporterStore((s) => s.masters);
  const reports = useReporterStore((s) => s.reports);
  const saveDraft = useReporterStore((s) => s.saveDraft);
  const submitVisitRow = useReporterStore((s) => s.submitVisitRow);
  const masterOptions = masters.map((m) => m.name).sort();

  const [date, setDate] = useState(() => params.date || todayStr());
  const [travelMode, setTravelMode] = useState<TravelMode>('bike');
  const [submittingIndex, setSubmittingIndex] = useState<number | null>(null);
  const [sharingPdf, setSharingPdf] = useState(false);
  const [snackbar, setSnackbar] = useState<{ visible: boolean; message: string }>({ visible: false, message: '' });
  const loadedForDate = useRef<string | null>(null);

  // "Open" on a report from the Reports screen navigates here with a date
  // param — without this, the form always defaulted back to today, so
  // opening a past pending report silently showed a blank current-day form.
  useEffect(() => {
    if (params.date && params.date !== date) {
      setDate(params.date);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.date]);

  const { control, watch, setValue, getValues, reset } = useForm<ReportFormValues>({
    defaultValues: { date, rows: [emptyVisitRow(1)] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'rows' });

  useEffect(() => {
    if (!settings) return;
    if (loadedForDate.current === date) return;
    loadedForDate.current = date;

    const existing = reports.find((r) => r.id === date);
    if (existing && existing.rows.length > 0) {
      reset({ date, rows: existing.rows });
      setTravelMode(existing.rows[0].travelMode);
    } else {
      reset({ date, rows: [emptyVisitRow(1, travelMode)] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, settings]);

  // Travel mode is a whole-day choice (a salesperson uses one vehicle for
  // the day, not a different one per stop), so changing it here applies to
  // every visit that isn't already submitted — submitted rows keep
  // whatever mode they were actually sent with.
  const handleTravelModeChange = (mode: TravelMode) => {
    setTravelMode(mode);
    getValues('rows').forEach((row, i) => {
      if (!row.submitted) {
        setValue(`rows.${i}.travelMode`, mode);
      }
    });
  };

  const watchedRows = watch('rows');
  useEffect(() => {
    if (!settings) return;
    const timeout = setTimeout(() => {
      saveDraft(date, date, settings.salesPersonName, settings.employeeId, watchedRows);
    }, 800);
    return () => clearTimeout(timeout);
  }, [watchedRows, date, settings, saveDraft]);

  const handleSubmitVisit = async (index: number) => {
    if (!settings?.salesPersonName) {
      setSnackbar({ visible: true, message: 'Please set your name in Settings first.' });
      return;
    }
    const row = getValues(`rows.${index}`);
    if (!row.departure || !row.arrival) {
      setSnackbar({ visible: true, message: 'Add a departure and arrival before submitting.' });
      return;
    }
    if (row.departure.trim().toLowerCase() === row.arrival.trim().toLowerCase()) {
      setSnackbar({ visible: true, message: "Departure and arrival can't be the same location." });
      return;
    }

    setSubmittingIndex(index);
    const result = await submitVisitRow(date, settings.salesPersonName, settings.employeeId, {
      ...row,
      sNo: index + 1,
      submitted: true,
    });
    setValue(`rows.${index}.submitted`, true);
    setValue(`rows.${index}.synced`, result === 'synced');
    setSubmittingIndex(null);

    setSnackbar({
      visible: true,
      message: result === 'synced' ? 'Visit submitted.' : "Saved on this device — will sync once you're back online.",
    });

    if (index === fields.length - 1) {
      append(emptyVisitRow(fields.length + 1, travelMode));
    }
  };

  const handleSharePdf = async () => {
    if (!settings?.salesPersonName) return;
    const report: DailyReport = {
      id: date,
      date,
      salesPerson: settings.salesPersonName,
      employeeId: settings.employeeId,
      rows: watchedRows.filter((r) => r.submitted),
      status: 'draft',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    if (report.rows.length === 0) {
      setSnackbar({ visible: true, message: 'Submit at least one visit before sharing a report.' });
      return;
    }
    setSharingPdf(true);
    try {
      await shareDailyReportPdf(report);
    } catch {
      setSnackbar({ visible: true, message: 'Could not create the PDF.' });
    } finally {
      setSharingPdf(false);
    }
  };

  if (settings && !settings.salesPersonName) {
    return (
      <View style={styles.centered}>
        <Text variant="bodyLarge" style={styles.centeredText}>
          Please enter your name in Settings before creating a report.
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Card style={styles.headerCard} mode="outlined">
          <Card.Content style={styles.headerRow}>
            <View>
              <Text variant="bodySmall">Sales Person</Text>
              <Text variant="titleMedium" style={styles.bold}>
                {settings?.salesPersonName || '—'}
              </Text>
            </View>
            <TextInput
              label="Date"
              mode="outlined"
              value={date}
              onChangeText={setDate}
              style={styles.dateInput}
              placeholder="YYYY-MM-DD"
            />
          </Card.Content>
          <Card.Content>
            <Text variant="bodySmall" style={styles.travelModeLabel}>
              Today&apos;s travel
            </Text>
            <SegmentedButtons
              value={travelMode}
              onValueChange={(v) => handleTravelModeChange(v as TravelMode)}
              buttons={[
                { value: 'bike', label: 'Bike', icon: 'motorbike' },
                { value: 'bus', label: 'Bus', icon: 'bus' },
              ]}
            />
          </Card.Content>
        </Card>

        <Text variant="bodySmall" style={styles.hint}>
          Submit each visit as soon as you finish it. When you're done for the day, share the full report as a PDF below.
        </Text>

        {fields.map((field, index) => (
          <VisitRowCard
            key={field.id}
            index={index}
            control={control}
            watch={watch}
            setValue={setValue}
            remove={() => remove(index)}
            canRemove={fields.length > 1}
            options={masterOptions}
            onSubmitVisit={handleSubmitVisit}
            submitting={submittingIndex === index}
          />
        ))}

        <Button mode="outlined" icon="plus" onPress={() => append(emptyVisitRow(fields.length + 1, travelMode))}>
          Add Visit
        </Button>

        <Button mode="contained" icon="file-pdf-box" onPress={handleSharePdf} loading={sharingPdf} disabled={sharingPdf}>
          Share Day&apos;s Report as PDF
        </Button>
      </ScrollView>

      <Snackbar
        visible={snackbar.visible}
        onDismiss={() => setSnackbar((s) => ({ ...s, visible: false }))}
        duration={4000}
      >
        {snackbar.message}
      </Snackbar>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: 16, gap: 16 },
  centered: { flex: 1, justifyContent: 'center', padding: 24 },
  centeredText: { textAlign: 'center' },
  headerCard: {},
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  travelModeLabel: { opacity: 0.7, marginBottom: 6 },
  bold: { fontWeight: '700' },
  dateInput: { width: 160 },
  hint: { opacity: 0.7, textAlign: 'center' },
});
