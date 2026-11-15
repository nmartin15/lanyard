import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Body, Button, Card, Eyebrow, Field, Title } from '@/components/ui';
import { useStore } from '@/lib/store';
import { colors, space, type } from '@/lib/theme';

export default function CorpusScreen() {
  const { profile, updateIntake, corpus, appendCorpusItem } = useStore();
  const { corpusNote, respectList } = profile.intake;
  const [picking, setPicking] = useState(false);

  const files = corpus.filter((c) => c.kind === 'file');

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
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
        <Eyebrow>Step 3 · Corpus</Eyebrow>
        <Title>Teach the team who you are</Title>
        <Body>
          Intense intake beats clever outreach. Drop what winning looks like — and who you
          actually respect.
        </Body>
        <Field
          label="Corpus note / voice of winning"
          placeholder="What winning looks like in 12 months…"
          multiline
          style={{ minHeight: 120, textAlignVertical: 'top' }}
          value={corpusNote}
          onChangeText={(value) => {
            void updateIntake({ corpusNote: value });
          }}
        />
        <Field
          label="People you actually respect"
          placeholder="Names or roles — warm paths only"
          multiline
          style={{ minHeight: 90, textAlignVertical: 'top' }}
          value={respectList}
          onChangeText={(value) => {
            void updateIntake({ respectList: value });
          }}
        />
        <Button
          label={picking ? 'Opening…' : 'Attach a file'}
          variant="ghost"
          disabled={picking}
          onPress={() => {
            void attachFile();
          }}
        />
        {files.length > 0 ? (
          <Card>
            <Text style={styles.label}>ATTACHED</Text>
            {files.map((f) => (
              <Text key={f.id} style={styles.file}>
                · {f.fileName ?? 'file'}
              </Text>
            ))}
          </Card>
        ) : null}
        <Button
          label="Continue"
          disabled={!corpusNote.trim()}
          onPress={() => router.push('/intake/constraints')}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  wrap: { padding: space.lg, gap: space.md, paddingBottom: space.xxl },
  label: { ...type.label, color: colors.accent },
  file: { ...type.caption, color: colors.inkMuted },
});
