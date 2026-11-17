import { isMailConnected, mailConnectionCopy, mailProviderLabel } from '../mail';

describe('mail helpers', () => {
  test('labels and connection', () => {
    expect(mailProviderLabel('gmail')).toBe('Gmail');
    expect(mailProviderLabel('microsoft')).toBe('Microsoft 365');
    expect(mailProviderLabel('none')).toBe('Not connected');
    expect(isMailConnected({ mailProvider: 'none' })).toBe(false);
    expect(isMailConnected({ mailProvider: 'gmail' })).toBe(true);
    expect(isMailConnected({ mailProvider: 'microsoft' })).toBe(false);
  });

  test('copy reflects connect state', () => {
    expect(mailConnectionCopy({ mailProvider: 'none', notifyEmail: '' })).toContain('Connect');
    expect(
      mailConnectionCopy({ mailProvider: 'gmail', notifyEmail: 'a@b.com' })
    ).toContain('a@b.com');
    expect(mailConnectionCopy({ mailProvider: 'microsoft', notifyEmail: '' })).toContain(
      'Gmail'
    );
  });
});
