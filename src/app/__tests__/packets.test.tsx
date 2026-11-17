import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import { packetFixture } from '@/lib/packets';
import type { Packet } from '@/lib/types';

const mockResolvePacket = jest.fn(async () => ({ sendStatus: 'sent' as const }));
const mockNavigate = jest.fn();
const mockUpdateIntake = jest.fn(async () => undefined);

const mockPackets: Packet[] = [
  packetFixture({
    id: 'p1',
    who: 'Warm intro — Maya',
    why: 'Strong fit for paid consult',
    whyNow: 'Warm thread this week',
    risk: 'Timing',
    nextStep: 'Approve outreach',
    research: 'Credible operator near your goals.',
    approach: 'Short specific note.',
    outreach: {
      to: 'maya@example.com',
      subject: 'Quick thought',
      body: 'Hi Maya — short careful note.',
    },
    status: 'pending',
  }),
  packetFixture({
    id: 'p2',
    who: 'Cold spray list',
    why: 'Low signal',
    whyNow: 'Noise',
    risk: 'Reputation',
    nextStep: 'Skip',
    approach: 'Do not engage.',
    outreach: {
      to: '',
      subject: '(do not send)',
      body: 'No sample.',
    },
    status: 'pending',
  }),
];

jest.mock('expo-router', () => ({
  router: {
    navigate: (...args: unknown[]) => mockNavigate(...args),
    push: jest.fn(),
  },
}));

jest.mock('@/components/FadeIn', () => ({
  FadeIn: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('@/lib/store', () => ({
  useStore: () => ({
    packets: mockPackets,
    packetArchive: [],
    resolvePacket: mockResolvePacket,
    runOvernight: jest.fn(),
    dialogue: [],
    profile: {
      intakeComplete: true,
      intake: {
        mailProvider: 'none',
        notifyEmail: '',
      },
      team: [],
      createdAt: '',
      updatedAt: '',
    },
    draft: { mailProvider: 'none', notifyEmail: '' },
    updateIntake: mockUpdateIntake,
  }),
}));

// eslint-disable-next-line import/first -- must load after jest.mock hoists
import PacketsScreen from '../(tabs)/packets';

describe('PacketsScreen', () => {
  beforeEach(() => {
    mockResolvePacket.mockClear();
    mockNavigate.mockClear();
    mockUpdateIntake.mockClear();
    mockPackets[0].status = 'pending';
    mockPackets[1].status = 'pending';
  });

  test('Send / No / Tweak call resolvePacket with correct statuses', async () => {
    const { getByText, getAllByRole } = await render(<PacketsScreen />);
    expect(getByText('Research → approve → send')).toBeTruthy();
    expect(getByText('Warm intro — Maya')).toBeTruthy();
    expect(getByText(/Credible operator/)).toBeTruthy();

    await fireEvent.press(getAllByRole('button', { name: 'Send' })[0]);
    expect(mockResolvePacket).toHaveBeenCalledWith('p1', 'approve', {
      outreachTo: 'maya@example.com',
    });

    await fireEvent.press(getAllByRole('button', { name: 'No' })[1]);
    expect(mockResolvePacket).toHaveBeenCalledWith('p2', 'kill', undefined);

    await fireEvent.press(getAllByRole('button', { name: 'Tweak' })[0]);
    expect(mockResolvePacket).toHaveBeenCalledWith('p1', 'reshape', undefined);
  });

  test('Back to Briefing navigates to huddle tab', async () => {
    const { getByRole } = await render(<PacketsScreen />);
    await fireEvent.press(getByRole('button', { name: 'Back to Briefing' }));
    expect(mockNavigate).toHaveBeenCalledWith('/(tabs)/huddle');
  });
});
