import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Body, Button, Card, Eyebrow, Field, Title } from '@/components/ui';
import { useStore } from '@/lib/store';
import { colors, space, type } from '@/lib/theme';

const recorderOptions = {
  ...RecordingPresets.HIGH_QUALITY,
  directory: 'document' as const,
};

export default function WalkScreen() {
  const { profile, appendCorpusNote, appendCorpusItem } = useStore();
  const [reply, setReply] = useState('');
  const [logged, setLogged] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const audioRecorder = useAudioRecorder(recorderOptions);
  const recorderState = useAudioRecorderState(audioRecorder);

  const prompt = useMemo(() => {
    const anti = profile.intake.antiGoals.trim();
    if (anti) {
      return `Quick check: still holding anti-goals — “${anti}” — or did that change?`;
    }
    return 'Quick check: what should we never do on your behalf this week?';
  }, [profile.intake.antiGoals]);

  const ensureMic = async () => {
    const status = await AudioModule.requestRecordingPermissionsAsync();
    if (!status.granted) {
      Alert.alert('Microphone needed', 'Walk voice notes need mic access.');
      return false;
    }
    await setAudioModeAsync({
      playsInSilentMode: true,
      allowsRecording: true,
    });
    return true;
  };

  const startRecording = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const ok = await ensureMic();
      if (!ok) return;
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
    } catch {
      Alert.alert('Could not start recording', 'Try again in a moment.');
    } finally {
      setBusy(false);
    }
  };

  const stopAndSendVoice = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await audioRecorder.stop();
      const uri = audioRecorder.uri;
      const durationMs = recorderState.durationMillis;
      if (!uri) {
        Alert.alert('No recording', 'Nothing was captured — try again.');
        return;
      }
      const caption = reply.trim() || 'Voice note for the team';
      await appendCorpusItem({
        kind: 'voice',
        text: caption,
        uri,
        durationMs,
      });
      setLogged(caption);
      setReply('');
    } catch {
      Alert.alert('Could not save voice note', 'Try again, or send text instead.');
    } finally {
      setBusy(false);
    }
  };

  const sendText = async () => {
    const text = reply.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      await appendCorpusNote(text);
      setLogged(text);
      setReply('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <Eyebrow>Walk mode</Eyebrow>
      <Title>One thing. Not a feed.</Title>
      <Card>
        <Text style={styles.label}>TEAM</Text>
        <Text style={styles.copy}>{prompt}</Text>
      </Card>
      <Field
        label="Caption or text reply"
        placeholder="e.g. Correct — no SaaS."
        value={reply}
        onChangeText={setReply}
      />
      <View style={styles.row}>
        {recorderState.isRecording ? (
          <Button
            label={busy ? 'Saving…' : 'Stop & send voice'}
            variant="danger"
            disabled={busy}
            onPress={() => {
              void stopAndSendVoice();
            }}
          />
        ) : (
          <Button
            label="Record voice note"
            variant="ghost"
            disabled={busy}
            onPress={() => {
              void startRecording();
            }}
          />
        )}
        <Button
          label="Send text"
          disabled={!reply.trim() || busy || recorderState.isRecording}
          onPress={() => {
            void sendText();
          }}
        />
      </View>
      {recorderState.isRecording ? (
        <Body>Recording… speak one correction, then stop.</Body>
      ) : null}
      {logged ? <Body>Logged into corpus: “{logged}”</Body> : null}
      <Body>Ambient coach energy. One item per walk. Voice is stored locally — no transcription yet.</Body>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.paper,
    padding: space.lg,
    gap: space.md,
  },
  label: { ...type.label, color: colors.accent },
  copy: { ...type.body, color: colors.ink },
  row: { gap: space.sm },
});
