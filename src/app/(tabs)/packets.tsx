import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Body, Button, Card, Eyebrow, Title } from '@/components/ui';
import { pendingPackets } from '@/lib/packets';
import { packetResolutionLabel } from '@/lib/resolve';
import { useStore } from '@/lib/store';
import type { Packet } from '@/lib/types';
import { colors, space, type } from '@/lib/theme';

function PacketCard({
  packet,
  onResolve,
}: {
  packet: Packet;
  onResolve?: (status: Packet['status']) => void;
}) {
  return (
    <Card>
      <Text style={styles.who}>{packet.who}</Text>
      <Text style={styles.meta}>Why: {packet.why}</Text>
      <Text style={styles.meta}>Why now: {packet.whyNow}</Text>
      <Text style={styles.meta}>Risk: {packet.risk}</Text>
      <Text style={styles.meta}>Next: {packet.nextStep}</Text>
      {packet.status === 'pending' && onResolve ? (
        <View style={styles.actions}>
          <Button label="Approve" onPress={() => onResolve('approve')} />
          <Button label="Kill" variant="danger" onPress={() => onResolve('kill')} />
          <Button label="Reshape" variant="ghost" onPress={() => onResolve('reshape')} />
          <Button label="Need human" variant="ghost" onPress={() => onResolve('need_human')} />
        </View>
      ) : (
        <Text style={styles.status}>Resolved: {packet.status}</Text>
      )}
    </Card>
  );
}

export default function PacketsScreen() {
  const { packets, packetArchive, resolvePacket, runOvernight } = useStore();
  const [lastAction, setLastAction] = useState<string | null>(null);
  const pending = useMemo(() => pendingPackets(packets), [packets]);
  const resolvedOnBoard = useMemo(
    () => packets.filter((p) => p.status !== 'pending'),
    [packets]
  );
  const boardCleared = pending.length === 0;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.wrap}>
        <Eyebrow>Come back</Eyebrow>
        <Title>Packets from your team</Title>
        <Body>
          Small board pack — not a notification firehose. {pending.length} pending on the
          board.
        </Body>
        {lastAction ? <Body>{lastAction}</Body> : null}

        {boardCleared ? (
          <Card>
            <Text style={styles.who}>
              {resolvedOnBoard.length > 0 || packetArchive.length > 0
                ? 'Board cleared'
                : 'Board is clear'}
            </Text>
            <Body>
              {resolvedOnBoard.length > 0
                ? 'Everything on this pack is resolved. Run overnight to archive and get a fresh hunt.'
                : 'Run an overnight hunt when you want a fresh pack.'}
            </Body>
            <Button
              label="Run overnight hunt"
              onPress={() => {
                void runOvernight().then(() => router.push('/(tabs)/huddle'));
              }}
            />
            <Button
              label="Open huddle"
              variant="ghost"
              onPress={() => router.push('/(tabs)/huddle')}
            />
          </Card>
        ) : null}

        {pending.map((p) => (
          <PacketCard
            key={p.id}
            packet={p}
            onResolve={(status) => {
              if (status === 'pending') return;
              void resolvePacket(p.id, status).then(() => {
                setLastAction(
                  `${packetResolutionLabel(status)}: “${p.who}”. Logged to Dialogue.`
                );
              });
            }}
          />
        ))}

        {resolvedOnBoard.length > 0 ? (
          <>
            <Text style={styles.section}>ON THIS BOARD</Text>
            {resolvedOnBoard.map((p) => (
              <PacketCard key={p.id} packet={p} />
            ))}
          </>
        ) : null}

        {packetArchive.length > 0 ? (
          <>
            <Text style={styles.section}>RECENTLY RESOLVED</Text>
            {packetArchive.slice(0, 6).map((p) => (
              <PacketCard key={`arch-${p.id}`} packet={p} />
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
  who: { ...type.bodyStrong, color: colors.ink },
  meta: { ...type.caption, color: colors.inkMuted },
  actions: { gap: space.sm, marginTop: space.sm },
  status: { ...type.caption, color: colors.accent, marginTop: space.sm },
  section: { ...type.label, color: colors.inkFaint, marginTop: space.sm },
});
