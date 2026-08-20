import { useRef, useState } from 'react';
import { View } from 'react-native';
import { HelperText, TextInput } from 'react-native-paper';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';

interface VoiceTextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

// expo-speech-recognition's native module is compiled into a standalone
// build (a real installed app) but not into Expo Go — and even guarded
// references to it there crash past try/catch, since React Native's global
// error handler intercepts the missing-native-module error before JS-level
// handling runs. So the two implementations are split into separate
// components: the real one only ever mounts (and only ever touches the
// module) inside a standalone build, where it's actually present.
const speechRecognitionAvailable = Constants.executionEnvironment === ExecutionEnvironment.Standalone;

export default function VoiceTextField(props: VoiceTextFieldProps) {
  return speechRecognitionAvailable ? <VoiceCapableField {...props} /> : <DictationHintField {...props} />;
}

function DictationHintField({ label, value, onChange, placeholder }: VoiceTextFieldProps) {
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
      {showHint && (
        <HelperText type="info">
          Voice input is available in the installed app, not this preview — tap the mic on your keyboard to
          dictate here instead.
        </HelperText>
      )}
    </View>
  );
}

function VoiceCapableField({ label, value, onChange, placeholder }: VoiceTextFieldProps) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const baseTextRef = useRef('');

  useSpeechRecognitionEvent('start', () => setListening(true));
  useSpeechRecognitionEvent('end', () => setListening(false));
  useSpeechRecognitionEvent('result', (event) => {
    const transcript = event.results[0]?.transcript ?? '';
    onChange(baseTextRef.current ? `${baseTextRef.current} ${transcript}` : transcript);
  });
  useSpeechRecognitionEvent('error', (event) => {
    setListening(false);
    setError(event.message || 'Could not recognize speech.');
  });

  const startListening = async () => {
    setError(null);
    if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
      setError('Speech recognition is not available on this device.');
      return;
    }
    const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permission.granted) {
      setError('Microphone permission denied. Enable it in your phone Settings to use voice input.');
      return;
    }
    baseTextRef.current = value.trim();
    ExpoSpeechRecognitionModule.start({
      lang: 'en-US',
      interimResults: true,
      continuous: true,
    });
  };

  const stopListening = () => {
    ExpoSpeechRecognitionModule.stop();
  };

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
        right={
          <TextInput.Icon
            icon={listening ? 'stop-circle' : 'microphone'}
            color={listening ? '#c62828' : undefined}
            onPress={listening ? stopListening : startListening}
          />
        }
      />
      {listening && <HelperText type="info">Listening…</HelperText>}
      {error && <HelperText type="error">{error}</HelperText>}
    </View>
  );
}
