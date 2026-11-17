import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import { Button, Choice, Field } from '../ui';

describe('UI primitives', () => {
  test('Button fires onPress and respects disabled', async () => {
    const onPress = jest.fn();
    const { getByRole, rerender } = await render(<Button label="Save" onPress={onPress} />);
    await fireEvent.press(getByRole('button', { name: 'Save' }));
    expect(onPress).toHaveBeenCalledTimes(1);

    await rerender(<Button label="Save" onPress={onPress} disabled />);
    await fireEvent.press(getByRole('button', { name: 'Save' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  test('Choice exposes selected state and detail as hint', async () => {
    const onPress = jest.fn();
    const { getByRole } = await render(
      <Choice label="Founder + investor" detail="Hate noise." selected onPress={onPress} />
    );
    const choice = getByRole('button', { name: 'Founder + investor' });
    expect(choice.props.accessibilityState).toEqual(
      expect.objectContaining({ selected: true })
    );
    expect(choice.props.accessibilityHint).toBe('Hate noise.');
    await fireEvent.press(choice);
    expect(onPress).toHaveBeenCalled();
  });

  test('Field wires accessibilityLabel for Maestro/UAT', async () => {
    const onChangeText = jest.fn();
    const { getByLabelText } = await render(
      <Field label="Goals right now" value="" onChangeText={onChangeText} placeholder="…" />
    );
    await fireEvent.changeText(getByLabelText('Goals right now'), 'hire lead');
    expect(onChangeText).toHaveBeenCalledWith('hire lead');
  });
});
