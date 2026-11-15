import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Body, Button, Card, Eyebrow, Title } from '@/components/ui';
import { useStore } from '@/lib/store';
import type { Packet } from '@/lib/types';
import { colors, space, type } from '@/lib/theme';

function PacketCard({
  packet,
  onResolve,
}: {
  packet: Packet;
  onResolve: (status: Packet['status']) => void;
}) {
  return (
    <Card>
      <Text style={styles.who}>{packet.who}</Text>
      <Text style={styles.meta}>Why: {packet.why}</Text>
      <Text style={styles.meta}>Why now: {packet.whyNow}</Text>
      <Text style={styles.meta}>Risk: {packet.risk}</Text>
      <Text style={styles.meta}>Next: {packet.nextStep}</Text>
      {packet.status === 'pending' ? (
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
  const { packets, resolvePacket } = useStore();

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.wrap}>
        <Eyebrow>Come back</Eyebrow>
        <Title>Packets from your team</Title>
        <Body>Small board pack — not a notification firehose. You steer.</Body>
        {packets.map((p) => (
          <PacketCard
            key={p.id}
            packet={p}
            onResolve={(status) => resolvePacket(p.id, status)}
          />
        ))}
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
});
