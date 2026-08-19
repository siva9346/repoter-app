import { MD3LightTheme } from 'react-native-paper';

// A deliberate, fully-specified MD3 palette. Paper's MD3LightTheme ships a
// complete tonal palette generated from a default violet seed color —
// spreading it and only overriding primary/secondary/background leaves
// surface, surfaceVariant, outline, and every elevation level on that
// leftover violet, which is what made cards, chips, and button fills look
// faintly (and inconsistently) purple no matter what brand color was set.
// Every token below is explicit so nothing bleeds through.
const theme = {
  ...MD3LightTheme,
  roundness: 10,
  colors: {
    ...MD3LightTheme.colors,

    primary: '#1565C0',
    onPrimary: '#FFFFFF',
    primaryContainer: '#D7E7FB',
    onPrimaryContainer: '#0B3C71',

    secondary: '#00897B',
    onSecondary: '#FFFFFF',
    secondaryContainer: '#D5F0EB',
    onSecondaryContainer: '#00352F',

    tertiary: '#6B5DD3',
    onTertiary: '#FFFFFF',
    tertiaryContainer: '#E7E2FB',
    onTertiaryContainer: '#241A5C',

    error: '#B3261E',
    onError: '#FFFFFF',
    errorContainer: '#F9DEDC',
    onErrorContainer: '#410E0B',

    background: '#F6F7F9',
    onBackground: '#1B1B1F',

    surface: '#FFFFFF',
    onSurface: '#1B1B1F',
    surfaceVariant: '#EDEFF2',
    onSurfaceVariant: '#44474A',
    surfaceDisabled: 'rgba(27,27,31,0.12)',
    onSurfaceDisabled: 'rgba(27,27,31,0.38)',

    outline: '#C9CDD2',
    outlineVariant: '#E2E4E8',

    shadow: '#000000',
    scrim: '#000000',
    backdrop: 'rgba(45,49,55,0.4)',

    inverseSurface: '#2F3033',
    inverseOnSurface: '#F1F0F4',
    inversePrimary: '#9FCBFA',

    elevation: {
      level0: 'transparent',
      level1: '#FCFCFD',
      level2: '#F8F9FA',
      level3: '#F3F5F6',
      level4: '#F1F3F5',
      level5: '#EEF1F3',
    },
  },
};

export default theme;
