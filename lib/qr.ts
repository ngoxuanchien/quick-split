import QRCode from 'qrcode';
import type { SummaryTransfer } from './summary';
import { vietQrPayload } from './vietqr';

// data URI (not inline SVG) so both <img> and next/og can render it
export async function qrDataUri(payload: string): Promise<string> {
  const svg = await QRCode.toString(payload, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

export function transferQrs(groupName: string, transfers: SummaryTransfer[]) {
  return Promise.all(
    transfers.map((t) =>
      t.account
        ? qrDataUri(vietQrPayload({ bin: t.account.bank.bin, accountNo: t.account.accountNo, amount: t.amount, note: `QuickSplit ${groupName}` }))
        : undefined,
    ),
  );
}
