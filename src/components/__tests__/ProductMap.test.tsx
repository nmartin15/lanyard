import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

import { ProductMap } from '../ProductMap';

describe('ProductMap', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  test('shows plain job titles then dismisses', async () => {
    const { getByText, getByRole, queryByText } = await render(<ProductMap />);
    await waitFor(() => expect(getByText('What you do here')).toBeTruthy());
    expect(getByText('Briefing')).toBeTruthy();
    expect(getByText('Decisions')).toBeTruthy();
    expect(getByText('Questions')).toBeTruthy();
    expect(getByText('Reply')).toBeTruthy();

    await fireEvent.press(getByRole('button', { name: 'Dismiss how Lanyard works' }));
    await waitFor(() => expect(queryByText('What you do here')).toBeNull());
    expect(await AsyncStorage.getItem('lanyard.productMap.v7.dismissed')).toBe('1');
  });

  test('stays hidden when already dismissed', async () => {
    await AsyncStorage.setItem('lanyard.productMap.v7.dismissed', '1');
    const { queryByRole, queryByText } = await render(<ProductMap />);
    await waitFor(() =>
      expect(queryByRole('button', { name: 'Dismiss how Lanyard works' })).toBeNull()
    );
    expect(queryByText('What you do here')).toBeNull();
  });
});
