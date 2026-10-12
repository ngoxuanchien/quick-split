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
// lazy so a missing font fails the request (500) instead of an unhandled rejection at import
let fonts: ReturnType<typeof loadFonts> | undefined;
const loadFonts = () => Promise.all([font('Regular'), font('Bold')]);

const BRAND = '#7c3aed';
const ACCENT = '#db2777';
const HERO = 'linear-gradient(135deg, #6d28d9, #a21caf 60%, #ec4899)';
const GRAY = '#6b7280';
const AMBER = '#b45309';
// single line + ellipsis keeps every block a fixed height, so the image height below stays exact
const ONE_LINE = { overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' } as const;

function balanceColor(v: number) {
  if (v > 0) return BRAND;
  if (v < 0) return ACCENT;
  return GRAY;
}

function transferHeight(hasQr: boolean, hasAccount: boolean) {
  if (hasQr) return 304;
  return hasAccount ? 206 : 170;
}

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
  const [regular, bold] = await (fonts ??= loadFonts());
  // measured per block; text is single-line so no wrapping to account for
  const height =
    464 +
    sum.rows.length * 64 +
    (sum.transfers.length ? sum.transfers.reduce((h, t, i) => h + transferHeight(!!qrs[i], !!t.account), 0) : 90) +
    (hasQr ? 70 : 0);

  return new ImageResponse(
    (
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', padding: 56, background: '#f7f5ff', color: '#1e1b4b', fontFamily: 'BeVietnamPro', fontSize: 30 }}>
        <div style={{ display: 'flex', flexShrink: 0, flexDirection: 'column', padding: '32px 36px', borderRadius: 32, backgroundImage: HERO, color: '#fff' }}>
          <div style={{ ...ONE_LINE, display: 'flex', fontSize: 56, fontWeight: 700 }}>{data.group.name}</div>
          <div style={{ display: 'flex', marginTop: 8, color: 'rgba(255,255,255,0.85)' }}>
            {`${data.members.length} người · Tổng chi ${formatVnd(sum.total)} · ${formatDateVn(new Date())}`}
          </div>
        </div>
        <div style={{ display: 'flex', flexShrink: 0, flexDirection: 'column', marginTop: 32, padding: '16px 32px', background: '#fff', borderRadius: 24 }}>
          {sum.rows.map(({ member: m, balance: v }) => (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', height: 64 }}>
              <Dot id={m.id} name={m.name} />
              <div style={{ ...ONE_LINE, display: 'flex', flex: 1, marginLeft: 16, marginRight: 16 }}>{m.name}</div>
              <div style={{ display: 'flex', fontWeight: 700, color: balanceColor(v) }}>{`${v > 0 ? '+' : ''}${formatVnd(v)}`}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', flexShrink: 0, marginTop: 40, fontSize: 40, fontWeight: 700 }}>Cách trả nợ</div>
        {sum.transfers.length === 0 && <div style={{ display: 'flex', flexShrink: 0, marginTop: 16, color: GRAY }}>Mọi người đã cân bằng.</div>}
        {sum.transfers.map((t, i) => (
          <div key={`${t.from}-${t.to}`} style={{ display: 'flex', flexShrink: 0, alignItems: 'center', marginTop: 16, padding: 24, background: '#fff', borderRadius: 24 }}>
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
              <div style={{ ...ONE_LINE, display: 'flex' }}>{`${name.get(t.from)} trả ${name.get(t.to)}`}</div>
              <div style={{ display: 'flex', fontSize: 44, fontWeight: 700, color: ACCENT }}>{formatVnd(t.amount)}</div>
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
