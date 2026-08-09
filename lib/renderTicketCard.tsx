import satori from 'satori';
import { Resvg, initWasm } from '@resvg/resvg-wasm';
import { fetchSafeImage } from '@/lib/safeImageFetch';

export interface TicketCardProps {
  baseUrl: string;
  posterUrl: string | null;
  movieTitle: string;
  movieDate: string;
  venue: string;
  ageRating: string;
  seat: string;
  name: string;
  displayId: string;
  statusType: string;
  badgeColor: string;
  badgeText: string;
  priceText: string;
  popcornLines: string[];
}

const CARD_WIDTH = 760;
const CARD_HEIGHT = 740;
const POSTER_HEIGHT = 520;
const RENDER_TIMEOUT_MS = 8_000;

let resvgWasmReady = false;

export async function ensureResvgWasmInit(wasmBytes: ArrayBuffer | Uint8Array): Promise<void> {
  if (resvgWasmReady) return;
  await initWasm(wasmBytes instanceof Uint8Array ? wasmBytes : new Uint8Array(wasmBytes));
  resvgWasmReady = true;
}

const TWEMOJI_BASE = 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/';

function twemojiCodepoints(emoji: string): string {
  return [...emoji]
    .map((c) => c.codePointAt(0)!.toString(16))
    .filter((cp) => cp !== 'fe0f')
    .join('-');
}

function collectEmoji(props: TicketCardProps): string[] {
  const found = new Set<string>();
  found.add('🎫');
  found.add('🎬');
  if (props.venue) found.add('📍');
  for (const line of props.popcornLines) {
    if (line.includes('🍿')) found.add('🍿');
  }
  return [...found];
}

// @resvg/resvg-wasm cannot fetch external URLs when rasterizing (no network I/O in the
// WASM sandbox), so graphemeImages must be self-contained data URIs, not external hrefs.
async function buildGraphemeImages(emoji: string[]): Promise<Record<string, string>> {
  const entries = await Promise.all(
    emoji.map(async (e) => {
      const res = await fetch(`${TWEMOJI_BASE}${twemojiCodepoints(e)}.svg`);
      const svgText = await res.text();
      return [e, `data:image/svg+xml;base64,${Buffer.from(svgText).toString('base64')}`] as const;
    })
  );
  return Object.fromEntries(entries);
}

async function toArrayBuffer(baseUrl: string, path: string): Promise<ArrayBuffer> {
  const res = await fetch(new URL(path, baseUrl).toString());
  if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.status}`);
  return res.arrayBuffer();
}

// satori requires every multi-child container to declare display:flex explicitly —
// it has no normal block flow layout, unlike a real browser.
function row(children: unknown, extra: Record<string, unknown> = {}) {
  return { type: 'div', props: { style: { display: 'flex', flexDirection: 'row', ...extra }, children } };
}

function col(children: unknown, extra: Record<string, unknown> = {}) {
  return { type: 'div', props: { style: { display: 'flex', flexDirection: 'column', ...extra }, children } };
}

function text(content: string, style: Record<string, unknown>) {
  return { type: 'div', props: { style: { display: 'flex', ...style }, children: content } };
}

function chip(content: string, style: Record<string, unknown>) {
  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        alignItems: 'center',
        padding: '8px 18px',
        borderRadius: 12,
        ...style,
      },
      children: content,
    },
  };
}

function buildCardTree(props: TicketCardProps, posterDataUri: string | null) {
  const dateWithVenue = [text(props.movieDate, { color: '#f1f5f9', fontSize: 30, fontWeight: 700 })];
  if (props.venue) {
    dateWithVenue.push(
      text(`📍 ${props.venue}`, { color: '#94a3b8', fontSize: 26, fontWeight: 400, marginTop: 8 })
    );
  }

  const popcornChildren = props.popcornLines.map((line) =>
    text(line, { color: '#e2e8f0', fontSize: 26, fontWeight: 400, marginBottom: 4 })
  );

  const children: unknown[] = [];
  if (posterDataUri) {
    children.push({
      type: 'img',
      props: {
        src: posterDataUri,
        width: CARD_WIDTH,
        height: POSTER_HEIGHT,
        style: { position: 'absolute', top: 0, left: 0, objectFit: 'cover' },
      },
    });
  }
  children.push({
    type: 'div',
    props: {
      style: {
        display: 'flex',
        position: 'absolute',
        top: 0,
        left: 0,
        width: CARD_WIDTH,
        height: POSTER_HEIGHT,
        background:
          'linear-gradient(180deg, rgba(22,27,38,0) 0%, rgba(22,27,38,0.15) 45%, rgba(22,27,38,0.85) 82%, #161b26 100%)',
      },
    },
  });
  children.push(
    col(
      [
        row(
          [
            chip(`🎫 판매번호 ${props.displayId}`, {
              backgroundColor: 'rgba(0,0,0,0.45)',
              color: '#e2e8f0',
              fontSize: 22,
              fontWeight: 400,
            }),
            chip('🎬', {
              width: 88,
              height: 88,
              justifyContent: 'center',
              backgroundColor: '#ffffff',
              fontSize: 44,
            }),
          ],
          { justifyContent: 'space-between', alignItems: 'flex-start' }
        ),
        text(props.movieTitle, { color: '#ffffff', fontSize: 46, fontWeight: 700, marginTop: 32, marginBottom: 12 }),
        text(`2D · ${props.ageRating || '전체관람가'}`, { color: '#cbd5e1', fontSize: 24, fontWeight: 400, marginBottom: 36 }),
        col(dateWithVenue, { marginBottom: 32 }),
        col(
          [
            ...popcornChildren,
            text(`결제 금액 ${props.priceText}`, { color: '#94a3b8', fontSize: 24, fontWeight: 700, marginTop: 8 }),
          ],
          { backgroundColor: 'rgba(255,255,255,0.06)', padding: '24px 28px', borderRadius: 20, marginBottom: 36 }
        ),
        row(
          [
            row(
              [
                text(props.seat, {
                  color: '#ef4444',
                  fontSize: 88,
                  fontWeight: 700,
                  textDecoration: props.statusType === 'canceled' ? 'line-through' : 'none',
                }),
                text(`${props.name} 님`, {
                  color: '#94a3b8',
                  fontSize: 26,
                  fontWeight: 400,
                  marginLeft: 16,
                  alignSelf: 'flex-end',
                  marginBottom: 12,
                }),
              ],
              { alignItems: 'flex-end' }
            ),
            chip(props.badgeText, {
              backgroundColor: 'rgba(0,0,0,0.5)',
              color: props.badgeColor,
              border: `2px solid ${props.badgeColor}`,
              fontSize: 22,
              fontWeight: 700,
            }),
          ],
          { justifyContent: 'space-between', alignItems: 'flex-end' }
        ),
      ],
      { position: 'relative', padding: '36px 44px 52px 44px', flex: 1 }
    )
  );

  return col(children, {
    position: 'relative',
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    backgroundColor: '#161b26',
    fontFamily: 'Pretendard',
  });
}

export async function renderTicketCardImage(props: TicketCardProps): Promise<Buffer | null> {
  try {
    return await Promise.race([
      renderInternal(props),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), RENDER_TIMEOUT_MS)),
    ]);
  } catch (err) {
    console.error('renderTicketCardImage failed:', err);
    return null;
  }
}

async function renderInternal(props: TicketCardProps): Promise<Buffer | null> {
  if (!resvgWasmReady) {
    console.error('renderTicketCardImage: resvg wasm not initialized');
    return null;
  }

  let posterDataUri: string | null = null;
  if (props.posterUrl) {
    const posterResult = await fetchSafeImage(props.posterUrl);
    if (posterResult.ok) {
      posterDataUri = `data:${posterResult.contentType};base64,${Buffer.from(posterResult.body).toString('base64')}`;
    }
  }

  const [regularFont, boldFont] = await Promise.all([
    toArrayBuffer(props.baseUrl, '/fonts/Pretendard-Regular.otf'),
    toArrayBuffer(props.baseUrl, '/fonts/Pretendard-Bold.otf'),
  ]);

  const graphemeImages = await buildGraphemeImages(collectEmoji(props));
  const tree = buildCardTree(props, posterDataUri);

  const svg = await satori(tree as never, {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    fonts: [
      { name: 'Pretendard', data: regularFont, weight: 400, style: 'normal' },
      { name: 'Pretendard', data: boldFont, weight: 700, style: 'normal' },
    ],
    graphemeImages,
  });

  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: CARD_WIDTH } });
  const png = resvg.render().asPng();
  return Buffer.from(png);
}
