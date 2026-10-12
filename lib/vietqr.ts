// VietQR = EMVCo merchant-presented QR, NAPAS profile. Each field is tag(2) + length(2) + value.
const tlv = (tag: string, value: string) => tag + String(value.length).padStart(2, '0') + value;

// CRC-16/CCITT-FALSE: poly 0x1021, init 0xFFFF
export function crc16(s: string): string {
  let c = 0xffff;
  for (const b of new TextEncoder().encode(s)) {
    c ^= b << 8;
    for (let i = 0; i < 8; i++) c = c & 0x8000 ? ((c << 1) ^ 0x1021) & 0xffff : (c << 1) & 0xffff;
  }
  return c.toString(16).toUpperCase().padStart(4, '0');
}

// bank apps reject notes with diacritics/symbols or longer than 25 chars
export function qrNote(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^A-Za-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 25)
    .trim();
}

export function vietQrPayload(p: { bin: string; accountNo: string; amount: number; note: string }): string {
  const account = tlv('00', 'A000000727') + tlv('01', tlv('00', p.bin) + tlv('01', p.accountNo)) + tlv('02', 'QRIBFTTA');
  const note = qrNote(p.note);
  const body =
    tlv('00', '01') +
    tlv('01', '12') +
    tlv('38', account) +
    tlv('53', '704') +
    tlv('54', String(p.amount)) +
    tlv('58', 'VN') +
    (note ? tlv('62', tlv('08', note)) : '') +
    '6304';
  return body + crc16(body);
}
