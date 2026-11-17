import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Mark } from '@/components/Marks';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Body, Button, Card, Field } from '@/components/ui';
import { useStore } from '@/lib/store';
import { colors, space, type } from '@/lib/theme';
import { pickWalkPrompt } from '@/lib/walk';

const PHOTO = require('../../../assets/onboarding/step-direction.jpg');

const recorderOptions = {
  ...RecordingPresets.HIGH_QUALITY,
  directory: 'document' as const,
};

export default function WalkScreen() {
  const { profile, huddle, sendDialogue, sendWalkVoice } = useStore();
  const [reply, setReply] = useState('');
  const [logged, setLogged] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const audioRecorder = useAudioRecorder(recorderOptions);
  const recorderState = useAudioRecorderState(audioRecorder);

  const prompt = useMemo(
    () => pickWalkPrompt(huddle, profile.intake),
    [huddle, profile.intake]
  );

  const ensureMic = async () => {
    const status = await AudioModule.requestRecordingPermissionsAsync();
    if (!status.granted) {
      Alert.alert('Microphone needed', 'Voice replies need mic access.');
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
      await sendWalkVoice({ uri, caption, durationMs });
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
      await sendDialogue(text);
      setLogged(text);
      setReply('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={8}
      >
        <ScrollView
          contentContainerStyle={styles.wrap}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          <ScreenHeader
            eyebrow="Reply"
            title="Send a quick reply"
            lead="One short update — text or voice. It goes in your taste file and steers overnight. Same thread as Questions."
            mark="walk"
            photo={PHOTO}
            photoCaption="One reply. Keep moving."
          />
          <Card accent>
            <View style={styles.promptHead}>
              <Mark name="ask" size={18} />
              <Text style={styles.label}>Today’s prompt</Text>
            </View>
            <Text style={styles.copy}>{prompt}</Text>
          </Card>
          <Field
            label="Quick reply"
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
            <Body>Recording… say the one fix, then stop.</Body>
          ) : null}
          {logged ? (
            <Card>
              <Text style={styles.label}>Saved</Text>
              <Body>“{logged}” — saved under Questions and your notes.</Body>
              <Button
                label="See it in Questions"
                onPress={() => router.navigate('/(tabs)/dialogue')}
              />
              <Button
                label="Back to Briefing"
                variant="ghost"
                onPress={() => router.navigate('/(tabs)/huddle')}
              />
            </Card>
          ) : (
            <Button
              label="Back to Briefing"
              variant="ghost"
              onPress={() => router.navigate('/(tabs)/huddle')}
            />
          )}
          <Body>Voice stays on your phone for now — no auto-transcript yet.</Body>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  flex: { flex: 1 },
  wrap: {
    padding: space.lg,
    gap: space.md,
    paddingBottom: space.xxl,
  },
  promptHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  label: { ...type.label, color: colors.ink },
  copy: { ...type.body, color: colors.ink },
  row: { gap: space.sm },
});
