import { router } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FadeIn } from '@/components/FadeIn';
import { Mark } from '@/components/Marks';
import { ProductMap } from '@/components/ProductMap';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Body, Button, Card, Section } from '@/components/ui';
import { postMorningBrief } from '@/lib/briefRemote';
import { unansweredTeamPrompts } from '@/lib/dialogue';
import { formatWhen } from '@/lib/format';
import { freshnessCopy } from '@/lib/freshness';
import { overnightRemoteUrl } from '@/lib/overnightRemote';
import { pendingPackets } from '@/lib/packets';
import { useStore } from '@/lib/store';
import { colors, fonts, space, type } from '@/lib/theme';

const PHOTO = require('../../../assets/onboarding/welcome-hero.jpg');

export default function HuddleScreen() {
  const { huddle, runOvernight, ensureOvernightIfStale, profile, packets, dialogue } =
    useStore();
  const [running, setRunning] = useState(false);
  const [autoNote, setAutoNote] = useState<string | null>(null);
  const autoTried = useRef(false);
  const pendingCount = useMemo(() => pendingPackets(packets).length, [packets]);
  const talkCount = useMemo(() => unansweredTeamPrompts(dialogue), [dialogue]);
  const freshnessLine = useMemo(() => freshnessCopy(huddle), [huddle]);

  useEffect(() => {
    if (!profile.intakeComplete || autoTried.current) return;
    autoTried.current = true;
    void ensureOvernightIfStale().then((did) => {
      if (did) setAutoNote('Fresh overnight update just landed — skim below.');
    });
  }, [ensureOvernightIfStale, profile.intakeComplete]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.wrap}>
        <FadeIn>
          <ScreenHeader
            eyebrow="Briefing"
            title="Overnight update"
            lead="This lives on your phone. Email is optional — same write-up, if you want it in your inbox."
            mark="huddle"
            photo={PHOTO}
            photoCaption="A briefing — not another feed."
          />
        </FadeIn>

        <FadeIn delay={60}>
          <ProductMap />
        </FadeIn>

        <FadeIn delay={80}>
          <Card>
            <Text style={styles.nextLabel}>Where this goes</Text>
            <Body>
              Briefing + long version stay on this phone. Optional email sends a copy. Your
              taste file (corpus) grows every time you approve, pass, answer, or reply — that’s
              how overnight gets smarter.
            </Body>
          </Card>
        </FadeIn>

        <Text style={styles.meta}>
          Updated {formatWhen(huddle.updatedAt)} · {freshnessLine}
        </Text>
        {autoNote ? <Body>{autoNote}</Body> : null}

        <FadeIn delay={100}>
          <Card accent>
            <View style={styles.nextHead}>
              <Mark name="next" color={colors.ink} />
              <View style={styles.nextCopy}>
                <Text style={styles.nextLabel}>Do this next</Text>
                <Text style={styles.hint}>
                  Decisions + Questions teach taste. Quiet users get a dumber overnight.
                </Text>
              </View>
            </View>
            <View style={styles.actions}>
              {pendingCount > 0 ? (
                <Button
                  label={`1. Open Decisions (${pendingCount})`}
                  onPress={() => router.navigate('/(tabs)/packets')}
                />
              ) : (
                <Body>Nothing waiting for a decision.</Body>
              )}
              <Button
                label={
                  talkCount > 0
                    ? `2. Open Questions (${talkCount})`
                    : '2. Open Questions'
                }
                variant={pendingCount > 0 ? 'ghost' : 'primary'}
                onPress={() => router.navigate('/(tabs)/dialogue')}
              />
              <Button
                label="3. Send a quick reply"
                variant="ghost"
                onPress={() => router.navigate('/(tabs)/walk')}
              />
            </View>
          </Card>
        </FadeIn>

        <Button
          label="Open long version"
          variant="ghost"
          onPress={() => router.push('/brief')}
        />

        <FadeIn delay={140}>
          <Section label="Summary">
            <Text style={styles.copy}>{huddle.belief}</Text>
          </Section>
        </FadeIn>

        <FadeIn delay={180}>
          <Section label="Still working">
            {huddle.chasing.map((c) => (
              <Text key={c} style={styles.copy}>
                · {c}
              </Text>
            ))}
          </Section>
        </FadeIn>

        {huddle.questions.length > 0 ? (
          <FadeIn delay={220}>
            <Section label="They need you">
              {huddle.questions.map((q) => (
                <Text key={q} style={styles.copy}>
                  · {q}
                </Text>
              ))}
              <View style={styles.sectionAction}>
                <Button
                  label="Answer in Questions"
                  variant="ghost"
                  onPress={() => router.navigate('/(tabs)/dialogue')}
                />
              </View>
            </Section>
          </FadeIn>
        ) : null}

        <FadeIn delay={260}>
          <Section label="Already passed">
            {huddle.filtered.map((f) => (
              <Text key={f} style={styles.copy}>
                · {f}
              </Text>
            ))}
          </Section>
        </FadeIn>

        <Button
          label={running ? 'Working…' : 'Run overnight again'}
          variant="ghost"
          disabled={running}
          onPress={() => {
            setRunning(true);
            setAutoNote(null);
            void (async () => {
              try {
                const next = await runOvernight();
                const to = profile.intake.notifyEmail?.trim() || '';
                if (!to || !overnightRemoteUrl()) {
                  setAutoNote('Done. Open the long version if you want the full read.');
                  return;
                }
                const result = await postMorningBrief({
                  huddle: next.huddle,
                  packets: next.packets,
                  dialogue: next.dialogue,
                  to,
                  send: true,
                });
                if (!result) {
                  setAutoNote('Done. Email didn’t go — retry from the long version.');
                  return;
                }
                if (result.delivery.status === 'sent') {
                  setAutoNote(`Done · emailed the write-up to ${to}.`);
                } else if (result.delivery.status === 'queued') {
                  setAutoNote(`Done · write-up lined up for ${to}.`);
                } else {
                  setAutoNote(
                    result.delivery.error ||
                      'Done. Email skipped — check the long version.'
                  );
                }
              } finally {
                setRunning(false);
              }
            })();
          }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  wrap: { padding: space.lg, gap: space.md, paddingBottom: space.xxl },
  meta: { ...type.caption, color: colors.inkFaint },
  nextHead: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  nextCopy: { flex: 1, gap: 2 },
  nextLabel: {
    ...type.bodyStrong,
    color: colors.ink,
    fontFamily: fonts.bodyBold,
  },
  hint: { ...type.caption, color: colors.inkMuted },
  copy: { ...type.body, color: colors.ink },
  actions: { gap: space.sm, marginTop: space.sm },
  sectionAction: { marginTop: space.sm },
});
