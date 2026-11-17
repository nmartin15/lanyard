import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import { IntakeBack } from '../intake/IntakeBack';

const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockCanGoBack = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    back: (...args: unknown[]) => mockBack(...args),
    replace: (...args: unknown[]) => mockReplace(...args),
    canGoBack: () => mockCanGoBack(),
  },
}));

describe('IntakeBack', () => {
  beforeEach(() => {
    mockBack.mockReset();
    mockReplace.mockReset();
    mockCanGoBack.mockReset();
  });

  test('uses router.back when stack can go back', async () => {
    mockCanGoBack.mockReturnValue(true);
    const { getByRole } = await render(<IntakeBack fallback="/intake" />);
    await fireEvent.press(getByRole('button', { name: 'Back' }));
    expect(mockBack).toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  test('replaces to fallback when stack is empty', async () => {
    mockCanGoBack.mockReturnValue(false);
    const { getByRole } = await render(<IntakeBack fallback="/intake" />);
    await fireEvent.press(getByRole('button', { name: 'Back' }));
    expect(mockReplace).toHaveBeenCalledWith('/intake');
    expect(mockBack).not.toHaveBeenCalled();
  });
});
