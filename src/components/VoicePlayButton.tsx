import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import React from 'react';

import { Button } from '@/components/ui';

export function VoicePlayButton({ uri, label }: { uri: string; label?: string }) {
  const player = useAudioPlayer({ uri });
  const status = useAudioPlayerStatus(player);

  return (
    <Button
      label={status.playing ? 'Playing…' : label ?? 'Play voice'}
      variant="ghost"
      disabled={!uri || status.playing}
      onPress={() => {
        player.seekTo(0);
        player.play();
      }}
    />
  );
}
