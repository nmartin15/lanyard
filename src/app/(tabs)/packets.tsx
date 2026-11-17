import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FadeIn } from '@/components/FadeIn';
import { MailConnect } from '@/components/MailConnect';
import { Mark } from '@/components/Marks';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Body, Button, Card, Field } from '@/components/ui';
import { unansweredTeamPrompts } from '@/lib/dialogue';
import { isMailConnected } from '@/lib/mail';
import { pendingPackets } from '@/lib/packets';
import { packetResolutionLabel, packetStatusLabel } from '@/lib/resolve';
import { useStore } from '@/lib/store';
import type { Packet } from '@/lib/types';
import { colors, fonts, space, type } from '@/lib/theme';

const PHOTO = require('../../../assets/onboarding/step-direction.jpg');

function truncate(text: string, max = 110) {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trim()}…`;
}

function DecisionChip({
  label,
  mark,
  tone,
  onPress,
}: {
  label: string;
  mark: 'yes' | 'no' | 'reshape';
  tone: 'yes' | 'no' | 'ghost';
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.chip,
        tone === 'yes' && styles.chipYes,
        tone === 'no' && styles.chipNo,
        tone === 'ghost' && styles.chipGhost,
        pressed && { opacity: 0.85 },
      ]}
    >
      <Mark
        name={mark}
        size={18}
        color={tone === 'yes' ? colors.onAccent : tone === 'ghost' ? colors.ink : colors.onNight}
      />
      <Text
        style={[
          styles.chipLabel,
          tone === 'yes' && styles.chipLabelYes,
          tone === 'ghost' && { color: colors.ink },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function PacketCard({
  packet,
  index,
  onResolve,
}: {
  packet: Packet;
  index: number;
  onResolve?: (status: Packet['status'], opts?: { outreachTo?: string }) => void;
}) {
  const [open, setOpen] = useState(true);
  const [to, setTo] = useState(packet.outreach.to);
  const pending = packet.status === 'pending' && onResolve;
  const noise =
    packet.outreach.subject.toLowerCase().includes('do not send') ||
    packet.approach.toLowerCase().includes('do not engage');

  return (
    <FadeIn delay={index * 50}>
      <Card accent={!!pending}>
        <Pressable onPress={() => setOpen((v) => !v)} accessibilityRole="button">
          <View style={styles.cardTop}>
            <Mark name="packets" size={18} color={colors.ink} />
            <Text style={styles.cardEyebrow}>Lead {String(index + 1).padStart(2, '0')}</Text>
            <Text style={styles.chev}>{open ? 'Hide' : 'Details'}</Text>
          </View>
          <Text style={styles.who}>{packet.who}</Text>
          <Text style={styles.summary}>{truncate(packet.why)}</Text>
          <Text style={styles.source}>{packet.sourceHint}</Text>
        </Pressable>

        {open ? (
          <View style={styles.details}>
            <Text style={styles.sectionLabel}>Research</Text>
            <Text style={styles.meta}>{packet.research}</Text>
            <Text style={styles.sectionLabel}>Approach</Text>
            <Text style={styles.meta}>{packet.approach}</Text>
            <Text style={styles.sectionLabel}>Sample outreach</Text>
            <View style={styles.outreach}>
              <Text style={styles.outreachSubject}>{packet.outreach.subject}</Text>
              <Text style={styles.outreachBody}>{packet.outreach.body}</Text>
            </View>
            {pending && !noise ? (
              <Field
                label="To (their email)"
                placeholder="name@company.com"
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
                value={to}
                onChangeText={setTo}
              />
            ) : null}
            <Text style={styles.meta}>Why now · {packet.whyNow}</Text>
            <Text style={styles.meta}>Watch out · {packet.risk}</Text>
            <Text style={styles.meta}>If yes · {packet.nextStep}</Text>
            <Button
              label="Read the full write-up"
              variant="ghost"
              onPress={() =>
                router.push({ pathname: '/brief', params: { packet: packet.id } })
              }
            />
          </View>
        ) : null}

        {pending ? (
          <View style={styles.actions}>
            <DecisionChip
              label={noise ? 'Yes' : 'Send'}
              mark="yes"
              tone="yes"
              onPress={() => onResolve('approve', { outreachTo: to })}
            />
            <DecisionChip
              label="No"
              mark="no"
              tone="no"
              onPress={() => onResolve('kill')}
            />
            <DecisionChip
              label="Tweak"
              mark="reshape"
              tone="ghost"
              onPress={() => onResolve('reshape')}
            />
          </View>
        ) : (
          <Text style={styles.status}>You said: {packetStatusLabel(packet)}</Text>
        )}
      </Card>
    </FadeIn>
  );
}

export default function PacketsScreen() {
  const { packets, packetArchive, resolvePacket, runOvernight, dialogue, profile, updateIntake } =
    useStore();
  const [lastAction, setLastAction] = useState<string | null>(null);
  const pending = useMemo(() => pendingPackets(packets), [packets]);
  const resolvedOnBoard = useMemo(
    () => packets.filter((p) => p.status !== 'pending'),
    [packets]
  );
  const talkCount = useMemo(() => unansweredTeamPrompts(dialogue), [dialogue]);
  const boardCleared = pending.length === 0;
  const intake = profile.intake;
  const mailOk = isMailConnected(intake);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.wrap}>
        <ScreenHeader
          eyebrow="Decisions"
          title="Research → approve → send"
          lead={
            pending.length === 0
              ? 'Nothing waiting. Run overnight again when you want fresh leads.'
              : `${pending.length} researched lead${pending.length === 1 ? '' : 's'} — approve sample outreach, pass, or tweak.`
          }
          mark="packets"
          photo={PHOTO}
          photoCaption="Scout finds them. You approve the note."
        />

        <Card accent={!mailOk}>
          <MailConnect
            intake={intake}
            compact
            showEmailField={false}
            onChangeProvider={(mailProvider) => {
              void updateIntake({ mailProvider });
            }}
          />
          {!mailOk ? (
            <Body>
              You can still approve research. Connect email when you’re ready to send.
            </Body>
          ) : null}
          <Button
            label="Email settings"
            variant="ghost"
            onPress={() => router.navigate('/(tabs)/team')}
          />
        </Card>

        <View style={styles.exits}>
          {talkCount > 0 ? (
            <Button
              label={`Answer ${talkCount} in Questions`}
              variant="ghost"
              onPress={() => router.navigate('/(tabs)/dialogue')}
            />
          ) : null}
          <Button
            label="Back to Briefing"
            variant="ghost"
            onPress={() => router.navigate('/(tabs)/huddle')}
          />
        </View>
        {lastAction ? <Body>{lastAction}</Body> : null}

        {boardCleared ? (
          <Card>
            <Text style={styles.who}>
              {resolvedOnBoard.length > 0 || packetArchive.length > 0
                ? 'All decided'
                : 'Nothing waiting'}
            </Text>
            <Body>
              {resolvedOnBoard.length > 0
                ? 'Want a new research pass? Run overnight again.'
                : 'Run overnight from Briefing to fill this list.'}
            </Body>
            <Button
              label="Run overnight"
              onPress={() => {
                void runOvernight().then(() => router.navigate('/(tabs)/huddle'));
              }}
            />
          </Card>
        ) : null}

        {pending.map((p, i) => (
          <PacketCard
            key={p.id}
            packet={p}
            index={i}
            onResolve={(status, opts) => {
              if (status === 'pending') return;
              void resolvePacket(p.id, status, opts).then((result) => {
                const sendStatus = result?.sendStatus;
                const suffix = result?.sendError ? ` ${result.sendError}` : '';
                setLastAction(`${packetResolutionLabel(status, sendStatus)}.${suffix}`);
              });
            }}
          />
        ))}

        {resolvedOnBoard.length > 0 ? (
          <>
            <Text style={styles.section}>Already decided</Text>
            {resolvedOnBoard.map((p, i) => (
              <PacketCard key={p.id} packet={p} index={i} />
            ))}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  wrap: { padding: space.lg, gap: space.md, paddingBottom: space.xxl },
  exits: { gap: space.sm },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  cardEyebrow: { ...type.label, color: colors.ink, flex: 1 },
  chev: { ...type.caption, color: colors.inkFaint, fontFamily: fonts.bodySemi },
  who: { ...type.bodyStrong, color: colors.ink, marginTop: space.xs },
  summary: { ...type.caption, color: colors.inkMuted, marginTop: 4 },
  source: { ...type.caption, color: colors.inkFaint, marginTop: 4 },
  details: {
    gap: 6,
    marginTop: space.sm,
    paddingTop: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  sectionLabel: { ...type.label, color: colors.inkFaint, marginTop: 4 },
  meta: { ...type.caption, color: colors.inkMuted },
  outreach: {
    gap: 4,
    padding: space.sm,
    backgroundColor: colors.panel,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  outreachSubject: { ...type.bodyStrong, color: colors.ink, fontSize: 14 },
  outreachBody: { ...type.caption, color: colors.inkMuted },
  actions: {
    flexDirection: 'row',
    gap: space.sm,
    marginTop: space.md,
  },
  chip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 12,
    borderRadius: 10,
  },
  chipYes: { backgroundColor: colors.accent },
  chipNo: { backgroundColor: colors.danger },
  chipGhost: {
    backgroundColor: colors.panel,
    borderWidth: 1.5,
    borderColor: colors.ink,
  },
  chipLabel: {
    ...type.caption,
    fontFamily: fonts.bodySemi,
    color: colors.onNight,
  },
  chipLabelYes: {
    color: colors.onAccent,
  },
  status: { ...type.caption, color: colors.ink, marginTop: space.sm },
  section: { ...type.label, color: colors.inkFaint, marginTop: space.sm },
});
