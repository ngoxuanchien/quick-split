import { describe, expect, it } from 'vitest';
import { transferQrs } from './qr';
import { BANKS } from './banks';

const svg = (uri: string) => Buffer.from(uri.replace('data:image/svg+xml;base64,', ''), 'base64').toString();

describe('transferQrs', () => {
  it('returns an SVG data URI only for transfers with an account', async () => {
    const [withAcc, without] = await transferQrs('Đà Lạt', [
      { from: 1, to: 2, amount: 1000, account: { bank: BANKS[0], accountNo: '123456' } },
      { from: 1, to: 3, amount: 500 },
    ]);
    expect(withAcc).toMatch(/^data:image\/svg\+xml;base64,/);
    expect(svg(withAcc!)).toContain('<svg');
    expect(without).toBeUndefined();
  });
});
