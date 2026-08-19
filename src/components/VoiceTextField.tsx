import { useState } from 'react';
import { View } from 'react-native';
import { HelperText, TextInput } from 'react-native-paper';

interface VoiceTextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

// There is no first-party, Expo-Go-safe speech-to-text API: the community
// module that provides it (expo-speech-recognition) requires a native
// module that only exists in a custom dev build, and referencing it at all
// — even lazily, even behind try/catch — throws in a way React Native's
// global error handler intercepts before JS-level error handling runs. To
// keep this screen crash-proof everywhere (Expo Go included), voice input
// is delegated to the device keyboard's own dictation button instead; this
// field just points the user at it.
export default function VoiceTextField({ label, value, onChange, placeholder }: VoiceTextFieldProps) {
  const [showHint, setShowHint] = useState(false);

  return (
    <View>
      <TextInput
        label={label}
        mode="outlined"
        multiline
        numberOfLines={4}
        placeholder={placeholder}
        value={value}
        onChangeText={onChange}
        right={<TextInput.Icon icon="microphone" onPress={() => setShowHint(true)} />}
      />
      {showHint && <HelperText type="info">Tap the mic on your keyboard to dictate.</HelperText>}
    </View>
  );
}
