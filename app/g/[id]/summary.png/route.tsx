import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { connection } from 'next/server';
import { getGroup } from '@/db/queries';
import { avatarColor, initial } from '@/lib/avatar';
import { formatDateVn } from '@/lib/date';
import { formatVnd } from '@/lib/money';
import { transferQrs } from '@/lib/qr';
import { summarize } from '@/lib/summary';

const font = (w: string) => readFile(join(process.cwd(), `assets/fonts/BeVietnamPro-${w}.ttf`));
const fonts = Promise.all([font('Regular'), font('Bold')]);

const GREEN = '#059669';
const RED = '#dc2626';
const GRAY = '#6b7280';
const AMBER = '#b45309';

function Dot({ id, name }: { id: number; name: string }) {
  return (
    <div
      style={{ display: 'flex', width: 48, height: 48, borderRadius: 24, background: avatarColor(id), color: '#fff', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 24 }}
    >
      {initial(name)}
    </div>
  );
}

// No emoji / arrows here: the bundled font lacks them and Satori would fetch fallbacks over the network.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const data = await getGroup(id);
  if (!data) return new Response('Not found', { status: 404 });
  const sum = summarize(data);
  const qrs = await transferQrs(data.group.name, sum.transfers);
  const hasQr = qrs.some(Boolean);
  const name = new Map(data.members.map((m) => [m.id, m.name]));
  const [regular, bold] = await fonts;
  // ponytail: estimated layout height (Satori needs a fixed size); measured per block, padded for wrapped names
  const height =
    400 +
    (data.group.name.length > 25 ? 70 : 0) +
    sum.rows.length * 64 +
    (sum.transfers.length
      ? sum.transfers.reduce((h, t, i) => h + (qrs[i] ? 304 : t.account ? 206 : 170) + ((name.get(t.from)?.length ?? 0) + (name.get(t.to)?.length ?? 0) > 40 ? 40 : 0), 0)
      : 90) +
    (hasQr ? 70 : 0);

  return new ImageResponse(
    (
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', padding: 56, background: '#f9fafb', color: '#111827', fontFamily: 'BeVietnamPro', fontSize: 30 }}>
        <div style={{ display: 'flex', flexShrink: 0, fontSize: 56, fontWeight: 700 }}>{data.group.name}</div>
        <div style={{ display: 'flex', flexShrink: 0, marginTop: 8, color: GRAY }}>
          {`${data.members.length} người · Tổng chi ${formatVnd(sum.total)} · ${formatDateVn(new Date())}`}
        </div>
        <div style={{ display: 'flex', flexShrink: 0, flexDirection: 'column', marginTop: 32, padding: '16px 32px', background: '#fff', borderRadius: 24 }}>
          {sum.rows.map(({ member: m, balance: v }) => (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', height: 64 }}>
              <Dot id={m.id} name={m.name} />
              <div style={{ display: 'flex', flex: 1, marginLeft: 16 }}>{m.name}</div>
              <div style={{ display: 'flex', fontWeight: 700, color: v > 0 ? GREEN : v < 0 ? RED : GRAY }}>{`${v > 0 ? '+' : ''}${formatVnd(v)}`}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', flexShrink: 0, marginTop: 40, fontSize: 40, fontWeight: 700 }}>Cách trả nợ</div>
        {sum.transfers.length === 0 && <div style={{ display: 'flex', flexShrink: 0, marginTop: 16, color: GRAY }}>Mọi người đã cân bằng.</div>}
        {sum.transfers.map((t, i) => (
          <div key={`${t.from}-${t.to}`} style={{ display: 'flex', flexShrink: 0, alignItems: 'center', marginTop: 16, padding: 24, background: '#fff', borderRadius: 24 }}>
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <div style={{ display: 'flex' }}>{`${name.get(t.from)} trả ${name.get(t.to)}`}</div>
              <div style={{ display: 'flex', fontSize: 44, fontWeight: 700, color: GREEN }}>{formatVnd(t.amount)}</div>
              {t.account && <div style={{ display: 'flex', color: GRAY, fontSize: 26 }}>{`${t.account.bank.name} · ${t.account.accountNo}`}</div>}
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element -- Satori only renders <img> */}
            {qrs[i] && <img src={qrs[i]} width={240} height={240} alt="" />}
          </div>
        ))}
        {hasQr && (
          <div style={{ display: 'flex', flexShrink: 0, marginTop: 24, color: AMBER, fontSize: 24 }}>
            Quét QR rồi kiểm tra đúng tên người nhận trên app ngân hàng trước khi chuyển.
          </div>
        )}
      </div>
    ),
    {
      width: 1080,
      height,
      fonts: [
        { name: 'BeVietnamPro', data: regular, weight: 400, style: 'normal' },
        { name: 'BeVietnamPro', data: bold, weight: 700, style: 'normal' },
      ],
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}
