import { router } from 'expo-router';
import React, { useRef } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MailConnect } from '@/components/MailConnect';
import { IntakeStep } from '@/components/intake/IntakeStep';
import { Body, Button, Choice } from '@/components/ui';
import { useStore } from '@/lib/store';
import { colors, space } from '@/lib/theme';
import { useKeyboardBottomPad } from '@/lib/useKeyboardBottomPad';

const PHOTO = require('../../../assets/onboarding/step-direction.jpg');

export default function ConstraintsScreen() {
  const { profile, updateIntake } = useStore();
  const { interruptPolicy, neverMessageAsMe, notifyEmail, mailProvider } = profile.intake;
  const scrollRef = useRef<React.ElementRef<typeof ScrollView>>(null);
  const keyboardHeight = useKeyboardBottomPad();

  const revealLowerFields = () => {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 80);
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
        onScrollBeginDrag={revealLowerFields}
      >
        <IntakeStep
          step="rules"
          mark="filter"
          photo={PHOTO}
          photoCaption="Phone for decisions. Work email for sending."
          photoHeight={72}
          title="A few preferences"
          lead="Keep the app for research + approve. Connect work email so outreach can send after you say yes."
        >
          <Body>How often should the team nudge you in the app?</Body>
          <Choice
            label="Quiet — I’ll open it when I’m ready"
            detail="Best default. You check in on your time."
            selected={interruptPolicy === 'rare'}
            onPress={() => {
              void updateIntake({ interruptPolicy: 'rare' });
            }}
          />
          <Choice
            label="A little more chatty"
            detail="Still only in-app. More questions when something’s real."
            selected={interruptPolicy === 'normal'}
            onPress={() => {
              void updateIntake({ interruptPolicy: 'normal' });
            }}
          />

          <Body>Can they ever email or message as you?</Body>
          <Choice
            label="Nope — always ask me first"
            detail="Nothing goes out unless you approve. Smart default."
            selected={neverMessageAsMe}
            onPress={() => {
              void updateIntake({ neverMessageAsMe: true });
            }}
          />
          <Choice
            label="Maybe someday — still ask first for now"
            detail="Door stays open. Nothing sends without you."
            selected={!neverMessageAsMe}
            onPress={() => {
              void updateIntake({ neverMessageAsMe: false });
            }}
          />

          <MailConnect
            intake={{ mailProvider, notifyEmail }}
            onChangeProvider={(next) => {
              void updateIntake({ mailProvider: next });
              revealLowerFields();
            }}
            onChangeEmail={(value) => {
              void updateIntake({ notifyEmail: value });
            }}
          />
          <Body>
            Same address can get the morning write-up. Phone stays the skim; approve lives here.
          </Body>

          <Button label="Show me my team" onPress={() => router.push('/intake/reveal')} />
        </IntakeStep>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1 },
});
