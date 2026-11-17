import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Body, Button, Choice, Field } from '@/components/ui';
import {
  connectGmail,
  disconnectGmail,
  fetchGmailStatus,
  type GmailStatus,
} from '@/lib/gmail';
import { GMAIL_USER_STEPS, mailConnectionCopy } from '@/lib/mail';
import type { IntakeDraft, MailProvider } from '@/lib/types';
import { colors, fonts, space, type } from '@/lib/theme';

type Props = {
  intake: Pick<IntakeDraft, 'mailProvider' | 'notifyEmail'>;
  onChangeProvider: (provider: MailProvider) => void;
  onChangeEmail?: (value: string) => void;
  showEmailField?: boolean;
  compact?: boolean;
};

/** Connect real Gmail (OAuth via overnight server) with plain-language steps. */
export function MailConnect({
  intake,
  onChangeProvider,
  onChangeEmail,
  showEmailField = true,
  compact = false,
}: Props) {
  const [status, setStatus] = useState<GmailStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const applyStatus = (next: GmailStatus) => {
    setStatus(next);
    if (next.connected) {
      onChangeProvider('gmail');
      if (next.email && onChangeEmail) onChangeEmail(next.email);
    }
  };

  const onCheckStatus = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const next = await fetchGmailStatus();
      applyStatus(next);
      if (next.connected) {
        setMessage(`Already connected as ${next.email || 'Gmail'}.`);
      } else if (next.error) {
        setMessage(next.error);
      } else {
        setMessage('Not connected yet — tap Connect Gmail.');
      }
    } finally {
      setBusy(false);
    }
  };

  const onConnect = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const next = await connectGmail();
      applyStatus(next);
      if (next.connected) {
        setMessage(`Connected as ${next.email || 'Gmail'}.`);
      } else {
        setMessage(next.error || 'Could not connect Gmail.');
      }
    } finally {
      setBusy(false);
    }
  };

  const onDisconnect = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const next = await disconnectGmail();
      setStatus(next);
      onChangeProvider('none');
      setMessage('Gmail disconnected on this phone.');
    } finally {
      setBusy(false);
    }
  };

  const connected = Boolean(status?.connected || intake.mailProvider === 'gmail');
  const configured = status?.configured ?? false;

  return (
    <View style={styles.wrap}>
      {!compact ? <Text style={styles.title}>Work email for outreach</Text> : null}
      <Body>{mailConnectionCopy(intake)}</Body>

      {!compact ? (
        <View style={styles.steps}>
          <Text style={styles.stepsTitle}>What you’ll do (phone)</Text>
          {GMAIL_USER_STEPS.map((step, i) => (
            <Text key={step} style={styles.step}>
              {i + 1}. {step}
            </Text>
          ))}
        </View>
      ) : (
        <Body>
          Tap Connect Gmail → sign in → Allow → come back. Then on each lead, type To and
          tap Send.
        </Body>
      )}

      {status?.serverUrl ? (
        <Text style={styles.meta}>Server · {status.serverUrl}</Text>
      ) : (
        <Text style={styles.warn}>
          No server URL yet. On your Mac, set EXPO_PUBLIC_OVERNIGHT_URL in .env (see
          docs/CONNECT_GMAIL.md), restart Expo, then come back.
        </Text>
      )}

      {status && !configured && status.serverUrl ? (
        <Text style={styles.warn}>
          Server is up, but Gmail OAuth isn’t configured. Finish the Google Cloud steps in
          docs/CONNECT_GMAIL.md, restart the overnight server, then tap Connect.
        </Text>
      ) : null}

      {busy ? <ActivityIndicator color={colors.ink} /> : null}

      <Button
        label="Check Gmail status"
        variant="ghost"
        onPress={() => {
          void onCheckStatus();
        }}
        disabled={busy}
      />

      <Button
        label={connected ? 'Reconnect Gmail' : 'Connect Gmail'}
        onPress={() => {
          void onConnect();
        }}
        disabled={busy}
      />

      {connected ? (
        <Choice
          label="Disconnect Gmail"
          detail="Stops sending from this phone until you connect again."
          selected={false}
          onPress={() => {
            void onDisconnect();
          }}
        />
      ) : null}

      <Choice
        label="Microsoft 365"
        detail="Not wired yet — use Gmail for send."
        selected={intake.mailProvider === 'microsoft'}
        onPress={() => onChangeProvider('microsoft')}
      />

      {showEmailField && onChangeEmail ? (
        <Field
          label="Inbox address (filled after Connect)"
          placeholder="you@company.com"
          autoCapitalize="none"
          keyboardType="email-address"
          autoCorrect={false}
          value={intake.notifyEmail}
          onChangeText={onChangeEmail}
        />
      ) : null}

      {message ? <Body>{message}</Body> : null}
      {status?.error && !message ? <Text style={styles.warn}>{status.error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  title: {
    ...type.label,
    color: colors.inkFaint,
    fontFamily: fonts.bodySemi,
  },
  steps: {
    gap: 6,
    padding: space.sm,
    backgroundColor: colors.panel,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  stepsTitle: { ...type.label, color: colors.inkFaint },
  step: { ...type.caption, color: colors.inkMuted },
  meta: { ...type.caption, color: colors.inkFaint },
  warn: { ...type.caption, color: colors.danger },
});
