import { Tabs } from 'expo-router';
import React from 'react';
import { Text } from 'react-native';

import { colors } from '@/lib/theme';

function TabLabel({ label, focused }: { label: string; focused: boolean }) {
  return (
    <Text
      style={{
        fontSize: 11,
        fontWeight: '600',
        color: focused ? colors.accent : colors.inkFaint,
      }}
    >
      {label}
    </Text>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.paper,
          borderTopColor: colors.line,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.inkFaint,
      }}
    >
      <Tabs.Screen
        name="team"
        options={{
          title: 'Team',
          tabBarLabel: ({ focused }) => <TabLabel label="Team" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="huddle"
        options={{
          title: 'Huddle',
          tabBarLabel: ({ focused }) => <TabLabel label="Huddle" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="walk"
        options={{
          title: 'Walk',
          tabBarLabel: ({ focused }) => <TabLabel label="Walk" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="packets"
        options={{
          title: 'Packets',
          tabBarLabel: ({ focused }) => <TabLabel label="Packets" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="dialogue"
        options={{
          title: 'Dialogue',
          tabBarLabel: ({ focused }) => <TabLabel label="Talk" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
