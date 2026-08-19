import writeXlsxFile from 'write-excel-file/universal';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import type { RemoteReportRow } from './appsScript';

const COLUMNS = [
  { value: 'Date', width: 12 },
  { value: 'Sales Person', width: 18 },
  { value: 'S.No', width: 6 },
  { value: 'Departure', width: 18 },
  { value: 'Start Time', width: 10 },
  { value: 'Arrival', width: 18 },
  { value: 'Arrival Time', width: 10 },
  { value: 'Distance KM', width: 12 },
  { value: 'Time At Customer', width: 16 },
  { value: 'Met With', width: 16 },
  { value: 'Key Feedback', width: 40 },
  { value: 'Comments', width: 30 },
  { value: 'Follow Up Required', width: 14 },
] as const;

const KEYS: (keyof RemoteReportRow)[] = [
  'Date',
  'Sales Person',
  'S.No',
  'Departure',
  'Start Time',
  'Arrival',
  'Arrival Time',
  'Distance KM',
  'Time At Customer',
  'Met With',
  'Key Feedback',
  'Comments',
  'Follow Up Required',
];

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1] ?? '');
    };
    reader.readAsDataURL(blob);
  });
}

export async function exportReportsToExcel(
  rows: RemoteReportRow[],
  filename = 'sales-reports.xlsx'
): Promise<void> {
  const headerRow = COLUMNS.map((c) => ({ value: c.value, fontWeight: 'bold' as const }));
  const dataRows = rows.map((row) => KEYS.map((key) => ({ value: row[key] ?? '' })));

  const { toBlob } = await writeXlsxFile([headerRow, ...dataRows], {
    columns: COLUMNS.map((c) => ({ width: c.width })),
  });
  const blob = await toBlob();
  const base64 = await blobToBase64(blob);

  const fileUri = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(fileUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri, {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      dialogTitle: 'Export Sales Reports',
      UTI: 'org.openxmlformats.spreadsheetml.sheet',
    });
  }
}
