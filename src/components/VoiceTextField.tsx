import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { HelperText, TextInput } from 'react-native-paper';
import type {
  ExpoSpeechRecognitionModule as ExpoSpeechRecognitionModuleType,
  ExpoSpeechRecognitionResultEvent,
  ExpoSpeechRecognitionErrorEvent,
} from 'expo-speech-recognition';

interface VoiceTextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

type Listener = { remove: () => void };

// IMPORTANT: never statically `import ... from 'expo-speech-recognition'`
// at the top of this file. Its native module is compiled into a real
// installed build but is absent in Expo Go and some dev clients, and
// merely *importing* the package evaluates code that calls
// requireNativeModule() at module-load time — which throws immediately,
// crashing this whole screen, regardless of whether any component here
// actually renders the speech-recognition UI. Every reference to the
// module below goes through a dynamic import() inside an event handler,
// so the crash (if the module truly isn't there) surfaces only as a
// caught error when the user taps the mic — never on screen load.
export default function VoiceTextField({ label, value, onChange, placeholder }: VoiceTextFieldProps) {
  const [listening, setListening] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const baseTextRef = useRef('');
  const listenersRef = useRef<Listener[]>([]);

  useEffect(() => {
    return () => {
      listenersRef.current.forEach((l) => l.remove());
    };
  }, []);

  const startListening = async () => {
    setHint(null);
    try {
      const mod = await import('expo-speech-recognition');
      const ExpoSpeechRecognitionModule = mod.ExpoSpeechRecognitionModule as typeof ExpoSpeechRecognitionModuleType;

      if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
        setHint('Speech recognition is not available on this device. Try the mic on your keyboard instead.');
        return;
      }
      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!permission.granted) {
        setHint('Microphone permission denied. Enable it in your phone Settings to use voice input.');
        return;
      }

      baseTextRef.current = value.trim();
      const onResult = ExpoSpeechRecognitionModule.addListener('result', (event: ExpoSpeechRecognitionResultEvent) => {
        const transcript = event.results[0]?.transcript ?? '';
        onChange(baseTextRef.current ? `${baseTextRef.current} ${transcript}` : transcript);
      });
      const onEnd = ExpoSpeechRecognitionModule.addListener('end', () => setListening(false));
      const onError = ExpoSpeechRecognitionModule.addListener('error', (event: ExpoSpeechRecognitionErrorEvent) => {
        setListening(false);
        setHint(event.message || 'Could not recognize speech.');
      });
      listenersRef.current = [onResult, onEnd, onError];

      ExpoSpeechRecognitionModule.start({ lang: 'en-US', interimResults: true, continuous: true });
      setListening(true);
    } catch {
      setHint('Voice input needs the installed app (not this dev preview) — tap the mic on your keyboard to dictate instead.');
      setListening(false);
    }
  };

  const stopListening = async () => {
    try {
      const mod = await import('expo-speech-recognition');
      mod.ExpoSpeechRecognitionModule.stop();
    } catch {
      // nothing to stop if it never started
    }
    setListening(false);
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
      {hint && <HelperText type="info">{hint}</HelperText>}
    </View>
  );
}
