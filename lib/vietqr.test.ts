import { describe, expect, it } from 'vitest';
import { BANKS, bankByBin } from './banks';
import { crc16, qrNote, vietQrPayload } from './vietqr';

describe('crc16', () => {
  it('matches the CRC-16/CCITT-FALSE check value', () => expect(crc16('123456789')).toBe('29B1'));
});

describe('vietQrPayload', () => {
  // fixture from github.com/xuannghia/vietnam-qr-pay test/test-quick-gen-qr.spec.ts (CRC re-verified)
  it('matches a known-good dynamic VietQR', () => {
    expect(vietQrPayload({ bin: '970416', accountNo: '257678859', amount: 10000, note: 'Chuyen tien' })).toBe(
      '00020101021238530010A0000007270123000697041601092576788590208QRIBFTTA53037045405100005802VN62150811Chuyen tien630453E6',
    );
  });
  it('omits tag 62 when the note sanitizes to empty', () => {
    const p = vietQrPayload({ bin: '970416', accountNo: '257678859', amount: 10000, note: '🎉!!' });
    expect(p).not.toContain('6215');
    expect(p).toMatch(/5802VN6304[0-9A-F]{4}$/);
  });
});

describe('qrNote', () => {
  it('strips diacritics and đ', () => expect(qrNote('QuickSplit Đà Lạt')).toBe('QuickSplit Da Lat'));
  it('drops symbols and emoji, collapses spaces', () => expect(qrNote('Ăn  tối 🎉 #1!')).toBe('An toi 1'));
  it('caps at 25 chars without trailing space', () => {
    const n = qrNote('QuickSplit Chuyen di choi Nha Trang');
    expect(n.length).toBeLessThanOrEqual(25);
    expect(n).toBe('QuickSplit Chuyen di choi');
  });
});

describe('banks', () => {
  it('has unique 6-digit BINs', () => {
    expect(BANKS.every((b) => /^\d{6}$/.test(b.bin))).toBe(true);
    expect(new Set(BANKS.map((b) => b.bin)).size).toBe(BANKS.length);
  });
  it('looks up by bin', () => {
    expect(bankByBin('970437')?.code).toBe('HDBank');
    expect(bankByBin('000000')).toBeUndefined();
    expect(bankByBin(null)).toBeUndefined();
  });
});
