import { router } from 'expo-router';
import React, { useRef } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Mark } from '@/components/Marks';
import { IntakeStep } from '@/components/intake/IntakeStep';
import { Body, Button, Card, Field } from '@/components/ui';
import { suggestVoiceFromIntake } from '@/lib/suggestVoice';
import { useStore } from '@/lib/store';
import { goalsLookThin } from '@/lib/taste';
import { colors, space } from '@/lib/theme';
import { useKeyboardBottomPad } from '@/lib/useKeyboardBottomPad';

const PHOTO = require('../../../assets/onboarding/step-direction.jpg');

export default function GoalsScreen() {
  const { profile, updateIntake } = useStore();
  const { goals, antiGoals } = profile.intake;
  const canContinue = !!goals.trim() && !!antiGoals.trim();
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
      >
        <IntakeStep
          step="ambition"
          mark="chase"
          photo={PHOTO}
          photoCaption="Chase this. Skip that."
          photoHeight={72}
          title="What are you after?"
          lead="Your overnight advisor only knows what you put here. A lazy one-liner works to start — two more sentences make the hunt much sharper."
        >
          {goalsLookThin(goals, antiGoals) && (goals.trim() || antiGoals.trim()) ? (
            <Card>
              <Body>
                Advisor nudge: add who / what / where if you can. Example — “Paid AI advisory
                for Series A fintech ops leaders in SF, warm intros only.” Short is ok; thin
                means noisier overnight.
              </Body>
            </Card>
          ) : null}
          <Card accent>
            <View style={styles.fieldHead}>
              <Mark name="thesis" size={16} />
            </View>
            <Field
              label="Goals right now"
              placeholder="e.g. paid AI gigs, warm investor intros, hungry sales hires"
              multiline
              style={{ minHeight: 100, textAlignVertical: 'top' }}
              value={goals}
              onChangeText={(goalsText) => {
                void updateIntake({ goals: goalsText });
              }}
              onFocus={revealLowerFields}
            />
          </Card>
          <Card>
            <View style={styles.fieldHead}>
              <Mark name="filter" size={16} />
            </View>
            <Field
              label="Hard no’s"
              placeholder="e.g. no services shops, no cold pitches, no spray-and-pray"
              multiline
              style={{ minHeight: 100, textAlignVertical: 'top' }}
              value={antiGoals}
              onChangeText={(antiGoalsText) => {
                void updateIntake({ antiGoals: antiGoalsText });
              }}
              onFocus={revealLowerFields}
            />
          </Card>
          <Button
            label="Next: how winning looks"
            disabled={!canContinue}
            onPress={() => {
              const intake = profile.intake;
              const suggestion = suggestVoiceFromIntake(intake);
              void updateIntake({
                corpusNote: intake.corpusNote.trim() || suggestion.corpusNote,
                respectList: intake.respectList.trim() || suggestion.respectList,
              }).then(() => router.push('/intake/corpus'));
            }}
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
});
