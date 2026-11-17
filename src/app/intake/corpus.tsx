import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Mark } from '@/components/Marks';
import { IntakeStep } from '@/components/intake/IntakeStep';
import { Body, Button, Card, Field } from '@/components/ui';
import { suggestVoiceFromIntake } from '@/lib/suggestVoice';
import { useStore } from '@/lib/store';
import { colors, space, type } from '@/lib/theme';
import { useKeyboardBottomPad } from '@/lib/useKeyboardBottomPad';

const PHOTO = require('../../../assets/onboarding/welcome-hero.jpg');

export default function CorpusScreen() {
  const { profile, updateIntake, corpus, appendCorpusItem } = useStore();
  const intake = profile.intake;
  const { corpusNote, respectList } = intake;
  const [picking, setPicking] = useState(false);
  const scrollRef = useRef<React.ElementRef<typeof ScrollView>>(null);
  const keyboardHeight = useKeyboardBottomPad();

  const files = corpus.filter((c) => c.kind === 'file');
  const hasDraft = !!corpusNote.trim() || !!respectList.trim();

  const revealLowerFields = () => {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 80);
  };

  const rewriteFromEarlier = () => {
    const suggestion = suggestVoiceFromIntake(intake);
    void updateIntake({
      corpusNote: suggestion.corpusNote,
      respectList: suggestion.respectList,
    });
  };

  const attachFile = async () => {
    if (picking) return;
    setPicking(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      await appendCorpusItem({
        kind: 'file',
        text: `Attached ${asset.name}`,
        uri: asset.uri,
        fileName: asset.name,
      });
    } catch {
      Alert.alert('Could not attach file', 'Try another document.');
    } finally {
      setPicking(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        ref={scrollRef}
        style={styles.flex}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: space.xxl + keyboardHeight },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        <IntakeStep
          step="voice"
          mark="bench"
          photo={PHOTO}
          photoCaption="Tell them what “good” feels like."
          photoHeight={72}
          title="What does winning look like?"
          lead="We drafted this from what you just said. Fix anything that’s off."
        >
          {hasDraft ? <Body>Already filled in — edit it or hit rewrite.</Body> : null}

          <Card accent>
            <View style={styles.fieldHead}>
              <Mark name="thesis" size={16} />
            </View>
            <Field
              label="In your words"
              placeholder="In a year I’d be pumped if…"
              multiline
              style={{ minHeight: 110, textAlignVertical: 'top' }}
              value={corpusNote}
              onChangeText={(value) => {
                void updateIntake({ corpusNote: value });
              }}
              onFocus={revealLowerFields}
            />
          </Card>
          <Card>
            <View style={styles.fieldHead}>
              <Mark name="team" size={16} />
            </View>
            <Field
              label="People you’d take a call from"
              placeholder="Investors, hungry closers, folks you’d ask for intros…"
              multiline
              style={{ minHeight: 88, textAlignVertical: 'top' }}
              value={respectList}
              onChangeText={(value) => {
                void updateIntake({ respectList: value });
              }}
              onFocus={revealLowerFields}
            />
          </Card>

          <Button
            label="Rewrite from what I already said"
            variant="ghost"
            onPress={rewriteFromEarlier}
          />

          <Button
            label={picking ? 'Opening…' : 'Add a file'}
            variant="ghost"
            disabled={picking}
            onPress={() => {
              void attachFile();
            }}
          />
          {files.length > 0 ? (
            <Card>
              <Text style={styles.label}>Files</Text>
              {files.map((f) => (
                <Text key={f.id} style={styles.file}>
                  · {f.fileName ?? 'file'}
                </Text>
              ))}
            </Card>
          ) : null}
          <Button
            label="Next: preferences"
            disabled={!corpusNote.trim()}
            onPress={() => router.push('/intake/constraints')}
          />
        </IntakeStep>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  fieldHead: { marginBottom: -space.xs },
  label: { ...type.label, color: colors.ink },
  file: { ...type.caption, color: colors.inkMuted },
});
