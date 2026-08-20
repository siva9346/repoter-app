import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Controller, type Control, type UseFormSetValue, type UseFormWatch } from 'react-hook-form';
import { Button, Card, Checkbox, Chip, Divider, HelperText, IconButton, Text, TextInput, useTheme } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import AutocompleteField from './AutocompleteField';
import VoiceTextField from './VoiceTextField';
import { getCurrentPosition, distanceKm } from '@/lib/distance';
import type { ReportFormValues } from '@/lib/reportForm';

interface VisitRowCardProps {
  index: number;
  control: Control<ReportFormValues>;
  watch: UseFormWatch<ReportFormValues>;
  setValue: UseFormSetValue<ReportFormValues>;
  remove: () => void;
  canRemove: boolean;
  options: string[];
  onSubmitVisit: (index: number) => void;
  submitting: boolean;
}

export default function VisitRowCard({
  index,
  control,
  watch,
  setValue,
  remove,
  canRemove,
  options,
  onSubmitVisit,
  submitting,
}: VisitRowCardProps) {
  const theme = useTheme();
  const [capturing, setCapturing] = useState<'departure' | 'arrival' | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);

  const row = watch(`rows.${index}`);
  const locked = row?.submitted ?? false;

  const captureDeparture = async () => {
    setGpsError(null);
    setCapturing('departure');
    try {
      const pos = await getCurrentPosition();
      // Only default the time on the *first* capture. Recapturing (to fix a
      // bad GPS fix, say) should update coordinates only — it must never
      // silently overwrite a time the salesperson already set or edited.
      if (!watch(`rows.${index}.startTime`)) {
        setValue(`rows.${index}.startTime`, new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      }
      setValue(`rows.${index}.departureLat`, pos.latitude);
      setValue(`rows.${index}.departureLng`, pos.longitude);
      recomputeDistance();
    } catch (err) {
      setGpsError(err instanceof Error ? err.message : 'Could not get GPS location');
    } finally {
      setCapturing(null);
    }
  };

  const captureArrival = async () => {
    setGpsError(null);
    setCapturing('arrival');
    try {
      const pos = await getCurrentPosition();
      if (!watch(`rows.${index}.arrivalTime`)) {
        setValue(`rows.${index}.arrivalTime`, new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      }
      setValue(`rows.${index}.arrivalLat`, pos.latitude);
      setValue(`rows.${index}.arrivalLng`, pos.longitude);
      recomputeDistance();
    } catch (err) {
      setGpsError(err instanceof Error ? err.message : 'Could not get GPS location');
    } finally {
      setCapturing(null);
    }
  };

  const recomputeDistance = () => {
    const current = watch(`rows.${index}`);
    if (
      current.departureLat != null &&
      current.departureLng != null &&
      current.arrivalLat != null &&
      current.arrivalLng != null
    ) {
      const km = distanceKm(
        { latitude: current.departureLat, longitude: current.departureLng },
        { latitude: current.arrivalLat, longitude: current.arrivalLng }
      );
      setValue(`rows.${index}.distanceKm`, km);
    }
  };

  const hasDeparture = row?.departureLat != null && row?.departureLng != null;
  const hasArrival = row?.arrivalLat != null && row?.arrivalLng != null;
  const sameLocation =
    !!row?.departure && !!row?.arrival && row.departure.trim().toLowerCase() === row.arrival.trim().toLowerCase();
  const canSubmit = !!row?.departure && !!row?.arrival && !sameLocation;

  return (
    <Card style={styles.card} mode="outlined">
      <Card.Content style={styles.content}>
        <View style={styles.headerRow}>
          <Text variant="titleMedium" style={styles.headerText}>
            Visit #{index + 1}
          </Text>
          <View style={styles.headerRight}>
            {locked && (
              <Chip
                compact
                icon={row.synced ? 'check-circle' : 'clock-outline'}
                style={row.synced ? styles.chipSynced : styles.chipPending}
                textStyle={styles.chipText}
              >
                {row.synced ? 'Submitted' : 'Pending sync'}
              </Chip>
            )}
            {canRemove && !locked && <IconButton icon="delete-outline" size={20} onPress={remove} />}
          </View>
        </View>

        <View pointerEvents={locked ? 'none' : 'auto'} style={[styles.fieldsContainer, locked && styles.lockedContent]}>
          <Text variant="labelSmall" style={styles.sectionLabel}>
            TRAVEL
          </Text>
          <Controller
            control={control}
            name={`rows.${index}.departure`}
            render={({ field }) => (
              <AutocompleteField
                label="Departure"
                value={field.value}
                onChangeText={field.onChange}
                options={options}
                excludeValue={row?.arrival}
              />
            )}
          />
          {!hasDeparture ? (
            <Button
              mode="contained"
              icon="crosshairs-gps"
              onPress={captureDeparture}
              loading={capturing === 'departure'}
              disabled={capturing !== null}
            >
              Start Travel
            </Button>
          ) : (
            <View style={styles.statusRow}>
              <MaterialCommunityIcons name="check-circle" size={16} color={theme.colors.secondary} />
              <Text variant="bodySmall" style={styles.statusLabel}>
                Departed at
              </Text>
              <Controller
                control={control}
                name={`rows.${index}.startTime`}
                render={({ field }) => (
                  <TextInput
                    mode="outlined"
                    dense
                    value={field.value}
                    onChangeText={field.onChange}
                    style={styles.timeInput}
                    contentStyle={styles.timeInputContent}
                  />
                )}
              />
              <IconButton
                icon="crosshairs-gps"
                size={16}
                mode="outlined"
                style={styles.recaptureButton}
                loading={capturing === 'departure'}
                disabled={capturing !== null}
                onPress={captureDeparture}
              />
            </View>
          )}

          <Controller
            control={control}
            name={`rows.${index}.arrival`}
            render={({ field }) => (
              <AutocompleteField
                label="Arrival"
                value={field.value}
                onChangeText={field.onChange}
                options={options}
                excludeValue={row?.departure}
                errorText={sameLocation ? "Arrival can't be the same as departure." : undefined}
              />
            )}
          />
          {!hasArrival ? (
            <Button
              mode="contained"
              icon="flag-checkered"
              onPress={captureArrival}
              loading={capturing === 'arrival'}
              disabled={capturing !== null || !hasDeparture}
            >
              Mark Arrival
            </Button>
          ) : (
            <View style={styles.statusRow}>
              <MaterialCommunityIcons name="check-circle" size={16} color={theme.colors.secondary} />
              <Text variant="bodySmall" style={styles.statusLabel}>
                Arrived at
              </Text>
              <Controller
                control={control}
                name={`rows.${index}.arrivalTime`}
                render={({ field }) => (
                  <TextInput
                    mode="outlined"
                    dense
                    value={field.value}
                    onChangeText={field.onChange}
                    style={styles.timeInput}
                    contentStyle={styles.timeInputContent}
                  />
                )}
              />
              <IconButton
                icon="flag-checkered"
                size={16}
                mode="outlined"
                style={styles.recaptureButton}
                loading={capturing === 'arrival'}
                disabled={capturing !== null}
                onPress={captureArrival}
              />
            </View>
          )}

          {gpsError && <HelperText type="error">{gpsError}</HelperText>}

          <View style={styles.distanceRow}>
            <MaterialCommunityIcons name="map-marker-distance" size={16} color={theme.colors.onSurfaceVariant} />
            <Text variant="bodyMedium" style={styles.distanceText}>
              {row?.distanceKm != null ? `${row.distanceKm} KM` : 'Capture departure & arrival to calculate distance'}
            </Text>
          </View>

          <Divider style={styles.divider} />

          <Text variant="labelSmall" style={styles.sectionLabel}>
            VISIT DETAILS
          </Text>
          <Controller
            control={control}
            name={`rows.${index}.timeAtCustomer`}
            render={({ field }) => (
              <TextInput
                label="Time At Customer"
                mode="outlined"
                placeholder="e.g. 30 mins"
                value={field.value}
                onChangeText={field.onChange}
              />
            )}
          />
          <Controller
            control={control}
            name={`rows.${index}.metWith`}
            render={({ field }) => (
              <TextInput label="Met With" mode="outlined" value={field.value} onChangeText={field.onChange} />
            )}
          />
          <Controller
            control={control}
            name={`rows.${index}.keyFeedback`}
            render={({ field }) => (
              <VoiceTextField
                label="Key Feedback"
                value={field.value}
                onChange={field.onChange}
                placeholder="Type, or tap the mic to record feedback"
              />
            )}
          />
          <Controller
            control={control}
            name={`rows.${index}.comments`}
            render={({ field }) => (
              <TextInput label="Comments" mode="outlined" multiline value={field.value} onChangeText={field.onChange} />
            )}
          />
          <Controller
            control={control}
            name={`rows.${index}.followUpRequired`}
            render={({ field }) => (
              <Checkbox.Item
                label="Follow-up required"
                status={field.value ? 'checked' : 'unchecked'}
                onPress={() => field.onChange(!field.value)}
                style={styles.checkbox}
              />
            )}
          />
        </View>

        {!locked && (
          <Button
            mode="contained"
            icon="send"
            onPress={() => onSubmitVisit(index)}
            loading={submitting}
            disabled={!canSubmit || submitting}
          >
            Submit Visit
          </Button>
        )}
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 4 },
  content: { gap: 14 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerText: { fontWeight: '700' },
  sectionLabel: { opacity: 0.55, letterSpacing: 0.8, fontWeight: '700', marginTop: 2 },
  fieldsContainer: { gap: 12 },
  lockedContent: { opacity: 0.6 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusLabel: { opacity: 0.8 },
  timeInput: { flex: 1, height: 36 },
  timeInputContent: { fontSize: 12 },
  recaptureButton: { margin: 0 },
  chip: { alignSelf: 'flex-start' },
  chipSynced: { backgroundColor: '#D5F0EB' },
  chipPending: { backgroundColor: '#FCE8CC' },
  chipText: { fontSize: 11 },
  distanceRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  distanceText: { fontWeight: '600' },
  divider: { marginVertical: 2 },
  checkbox: { paddingHorizontal: 0 },
});
