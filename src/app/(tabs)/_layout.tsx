import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import React, { useMemo } from 'react';
import { Text, View } from 'react-native';

import { unansweredTeamPrompts } from '@/lib/dialogue';
import { pendingPackets } from '@/lib/packets';
import { useStore } from '@/lib/store';
import { colors, fonts, radii } from '@/lib/theme';

type Ion = keyof typeof Ionicons.glyphMap;

function TabIcon({ name, focused }: { name: Ion; focused: boolean }) {
  return (
    <View
      style={{
        width: 36,
        height: 28,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radii.sm,
        backgroundColor: focused ? colors.ink : 'transparent',
      }}
    >
      <Ionicons
        name={name}
        size={20}
        color={focused ? colors.accent : colors.inkFaint}
      />
    </View>
  );
}

function TabLabel({ label, focused }: { label: string; focused: boolean }) {
  return (
    <Text
      style={{
        fontFamily: fonts.bodySemi,
        fontSize: 11,
        letterSpacing: 0.2,
        color: focused ? colors.ink : colors.inkFaint,
        marginTop: 2,
      }}
    >
      {label}
    </Text>
  );
}

export default function TabsLayout() {
  const { packets, dialogue } = useStore();
  const pendingCount = useMemo(() => pendingPackets(packets).length, [packets]);
  const talkCount = useMemo(() => unansweredTeamPrompts(dialogue), [dialogue]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: colors.paper,
          borderTopColor: colors.line,
          height: 64,
          paddingTop: 6,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.inkFaint,
      }}
    >
      <Tabs.Screen
        name="team"
        options={{
          title: 'Team',
          tabBarIcon: ({ focused }) => <TabIcon name="people-outline" focused={focused} />,
          tabBarLabel: ({ focused }) => <TabLabel label="Team" focused={focused} />,
          tabBarAccessibilityLabel: 'Team — who works overnight',
        }}
      />
      <Tabs.Screen
        name="huddle"
        options={{
          title: 'Briefing',
          tabBarIcon: ({ focused }) => <TabIcon name="sunny-outline" focused={focused} />,
          tabBarLabel: ({ focused }) => <TabLabel label="Briefing" focused={focused} />,
          tabBarAccessibilityLabel: 'Briefing — read the overnight update',
        }}
      />
      <Tabs.Screen
        name="walk"
        options={{
          title: 'Reply',
          tabBarIcon: ({ focused }) => <TabIcon name="walk-outline" focused={focused} />,
          tabBarLabel: ({ focused }) => <TabLabel label="Reply" focused={focused} />,
          tabBarAccessibilityLabel: 'Reply — send one quick update',
        }}
      />
      <Tabs.Screen
        name="packets"
        options={{
          title: 'Decisions',
          tabBarBadge: pendingCount > 0 ? pendingCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: colors.ink,
            color: colors.accent,
            fontSize: 11,
            fontFamily: fonts.bodyBold,
          },
          tabBarIcon: ({ focused }) => <TabIcon name="documents-outline" focused={focused} />,
          tabBarLabel: ({ focused }) => <TabLabel label="Decisions" focused={focused} />,
          tabBarAccessibilityLabel: 'Decisions — approve or pass options',
        }}
      />
      <Tabs.Screen
        name="dialogue"
        options={{
          title: 'Questions',
          tabBarBadge: talkCount > 0 ? talkCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: colors.ink,
            color: colors.accent,
            fontSize: 11,
            fontFamily: fonts.bodyBold,
          },
          tabBarIcon: ({ focused }) => <TabIcon name="chatbubbles-outline" focused={focused} />,
          tabBarLabel: ({ focused }) => <TabLabel label="Questions" focused={focused} />,
          tabBarAccessibilityLabel: 'Questions — answer the team',
        }}
      />
    </Tabs>
  );
}
