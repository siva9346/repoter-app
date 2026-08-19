import { useEffect, useMemo, useRef, useState, type ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';
import AutocompleteInput from 'react-native-autocomplete-input';
import { HelperText, List, TextInput } from 'react-native-paper';

interface AutocompleteFieldProps {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  options: string[];
  /** Hide this value from suggestions (e.g. don't offer the departure as an arrival option). */
  excludeValue?: string;
  errorText?: string;
}

export default function AutocompleteField({
  label,
  value,
  onChangeText,
  options,
  excludeValue,
  errorText,
}: AutocompleteFieldProps) {
  const [focused, setFocused] = useState(false);
  const blurTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (blurTimeout.current) clearTimeout(blurTimeout.current);
    };
  }, []);

  const handleFocus = () => {
    if (blurTimeout.current) clearTimeout(blurTimeout.current);
    setFocused(true);
  };

  const handleBlur = () => {
    // Delay hiding so a tap on a suggestion (which blurs the input first)
    // still has time to register before the list unmounts.
    blurTimeout.current = setTimeout(() => setFocused(false), 150);
  };

  const availableOptions = useMemo(() => {
    const exclude = excludeValue?.trim().toLowerCase();
    if (!exclude) return options;
    return options.filter((o) => o.trim().toLowerCase() !== exclude);
  }, [options, excludeValue]);

  const suggestions = useMemo(() => {
    if (!focused) return [];
    if (!value) return availableOptions.slice(0, 8);
    const q = value.toLowerCase();
    return availableOptions.filter((o) => o.toLowerCase().includes(q) && o.toLowerCase() !== q).slice(0, 8);
  }, [focused, value, availableOptions]);

  const selectOption = (option: string) => {
    if (blurTimeout.current) clearTimeout(blurTimeout.current);
    setFocused(false);
    onChangeText(option);
  };

  return (
    <View style={styles.container}>
      <AutocompleteInput
        data={suggestions}
        value={value}
        onChangeText={onChangeText}
        onFocus={handleFocus}
        onBlur={handleBlur}
        hideResults={suggestions.length === 0}
        // The library wraps the input in its own bordered box by default,
        // which doubles up with react-native-paper's own outline (drawn by
        // the TextInput itself) into a visible "double border" around the
        // field. Strip the library's border entirely — Paper draws the
        // only outline we want.
        inputContainerStyle={styles.inputContainer}
        listContainerStyle={styles.listContainer}
        renderTextInput={({ style: _forcedStyle, ...props }) => (
          // The library also force-injects its own `style` (white
          // background, fixed 40px height, 3px padding) onto every text
          // input it renders — dropped here so Paper's TextInput falls
          // back to the same theme background/height as every other field
          // on the form instead of standing out as a mismatched white box.
          //
          // Separately, react-native-autocomplete-input's TextInputProps
          // use RN's newer ColorValue types for a couple of style props;
          // react-native-paper's TextInput narrows those to `string`.
          // Functionally compatible — cast away the mismatch rather than
          // hand-picking props to drop.
          <TextInput
            {...(props as ComponentProps<typeof TextInput>)}
            label={label}
            mode="outlined"
            error={!!errorText}
          />
        )}
        // The suggestion list is capped at 8 items, so a virtualized
        // FlatList buys nothing — and this field lives inside the New
        // Visit screen's ScrollView, where a same-orientation FlatList
        // triggers React Native's "VirtualizedLists should never be
        // nested" warning. A plain mapped View avoids that entirely.
        renderResultList={() => (
          <View style={styles.resultList}>
            {suggestions.map((item) => (
              <List.Item key={item} title={item} onPress={() => selectOption(item)} />
            ))}
          </View>
        )}
      />
      {!!errorText && <HelperText type="error">{errorText}</HelperText>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { zIndex: 10 },
  inputContainer: { borderWidth: 0, marginBottom: 0 },
  listContainer: { elevation: 4 },
  resultList: {},
});
