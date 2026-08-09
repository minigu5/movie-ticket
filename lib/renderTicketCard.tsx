import { ImageResponse } from 'next/og';
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

const CARD_WIDTH = 700;
const CARD_HEIGHT = 960;
const POSTER_HEIGHT = CARD_HEIGHT;
const SIDE_MARGIN = 140;
const TOP_MARGIN = 90;
const BOTTOM_MARGIN = 90;
const LOGO_BLOCK_HEIGHT = 170;
const OUTER_WIDTH = CARD_WIDTH + SIDE_MARGIN * 2;
const OUTER_HEIGHT = TOP_MARGIN + LOGO_BLOCK_HEIGHT + CARD_HEIGHT + BOTTOM_MARGIN;
const SCALLOP_COUNT = 13;
const RENDER_TIMEOUT_MS = 8_000;

async function toArrayBuffer(baseUrl: string, path: string): Promise<ArrayBuffer> {
  const res = await fetch(new URL(path, baseUrl).toString());
  if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.status}`);
  return res.arrayBuffer();
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

  const scallops = Array.from({ length: SCALLOP_COUNT }, (_, i) => (
    <div
      key={i}
      style={{
        display: 'flex',
        width: 28,
        height: 28,
        borderRadius: '50%',
        backgroundColor: '#161b26',
        border: '1px solid rgba(255,255,255,0.14)',
        boxShadow: 'inset 0 2px 3px rgba(0,0,0,0.4)',
      }}
    />
  ));

  const response = new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          width: OUTER_WIDTH,
          height: OUTER_HEIGHT,
          alignItems: 'center',
          overflow: 'hidden',
          backgroundColor: '#0b1120',
          fontFamily: 'Pretendard',
        }}
      >
        {posterDataUri && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={posterDataUri}
            width={OUTER_WIDTH + 160}
            height={OUTER_HEIGHT + 160}
            style={{
              position: 'absolute',
              top: -80,
              left: -80,
              objectFit: 'cover',
              filter: 'blur(70px) brightness(0.7) saturate(1.6)',
            }}
          />
        )}
        <div style={{ display: 'flex', position: 'absolute', top: 0, left: 0, width: OUTER_WIDTH, height: OUTER_HEIGHT, backgroundColor: 'rgba(11,17,32,0.15)' }} />
        {/* radial-gradient's ellipse doesn't scale to the canvas's non-square aspect ratio in
            resvg, so the top/bottom edges vignette out to solid navy much sooner than the
            sides do. Four independent edge-aligned linear-gradients avoid that ambiguity. */}
        <div
          style={{
            display: 'flex',
            position: 'absolute',
            top: 0,
            left: 0,
            width: OUTER_WIDTH,
            height: TOP_MARGIN + LOGO_BLOCK_HEIGHT * 0.6,
            background: 'linear-gradient(180deg, #0b1120 0%, rgba(11,17,32,0) 100%)',
          }}
        />
        <div
          style={{
            display: 'flex',
            position: 'absolute',
            bottom: 0,
            left: 0,
            width: OUTER_WIDTH,
            height: BOTTOM_MARGIN + 60,
            background: 'linear-gradient(0deg, #0b1120 0%, rgba(11,17,32,0) 100%)',
          }}
        />
        <div
          style={{
            display: 'flex',
            position: 'absolute',
            top: 0,
            left: 0,
            width: SIDE_MARGIN + 60,
            height: OUTER_HEIGHT,
            background: 'linear-gradient(90deg, #0b1120 0%, rgba(11,17,32,0) 100%)',
          }}
        />
        <div
          style={{
            display: 'flex',
            position: 'absolute',
            top: 0,
            right: 0,
            width: SIDE_MARGIN + 60,
            height: OUTER_HEIGHT,
            background: 'linear-gradient(270deg, #0b1120 0%, rgba(11,17,32,0) 100%)',
          }}
        />

        <div
          style={{
            display: 'flex',
            position: 'relative',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: LOGO_BLOCK_HEIGHT,
            marginTop: TOP_MARGIN,
          }}
        >
          <div style={{ display: 'flex', color: '#f1f5f9', fontSize: 34, fontWeight: 700, letterSpacing: 6, textShadow: '0 0 18px rgba(255,255,255,0.25)' }}>
            영화
          </div>
          <div style={{ display: 'flex', color: '#f1f5f9', fontSize: 34, fontWeight: 700, letterSpacing: 6, textShadow: '0 0 18px rgba(255,255,255,0.25)', marginTop: 6 }}>
            대교
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            width: CARD_WIDTH,
            height: CARD_HEIGHT,
            borderRadius: 28,
            overflow: 'hidden',
            boxShadow: '0 30px 60px rgba(0,0,0,0.55)',
            backgroundColor: '#161b26',
          }}
        >
          {posterDataUri && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={posterDataUri}
              width={CARD_WIDTH}
              height={POSTER_HEIGHT}
              style={{ position: 'absolute', top: 0, left: 0, objectFit: 'cover' }}
            />
          )}
          <div
            style={{
              display: 'flex',
              position: 'absolute',
              top: 0,
              left: 0,
              width: CARD_WIDTH,
              height: POSTER_HEIGHT,
              background:
                'linear-gradient(180deg, rgba(22,27,38,0) 0%, rgba(22,27,38,0.05) 30%, rgba(22,27,38,0.35) 50%, rgba(22,27,38,0.72) 68%, rgba(22,27,38,0.9) 85%, rgba(22,27,38,0.97) 100%)',
            }}
          />
        <div style={{ display: 'flex', flexDirection: 'column', position: 'relative', padding: '44px 44px 50px 44px', flex: 1 }}>
          <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '8px 18px',
                borderRadius: 12,
                backgroundColor: 'rgba(0,0,0,0.45)',
                color: '#e2e8f0',
                fontSize: 22,
              }}
            >
              {`🎫 판매번호 ${props.displayId}`}
            </div>
            <div
              style={{
                display: 'flex',
                width: 88,
                height: 88,
                justifyContent: 'center',
                alignItems: 'center',
                borderRadius: 12,
                backgroundColor: '#ffffff',
                fontSize: 44,
              }}
            >
              🎬
            </div>
          </div>

          <div style={{ display: 'flex', color: '#ffffff', fontSize: 46, fontWeight: 700, textShadow: '0 2px 10px rgba(0,0,0,0.6)', marginTop: 220, marginBottom: 12 }}>
            {props.movieTitle}
          </div>
          <div style={{ display: 'flex', color: '#cbd5e1', fontSize: 24, textShadow: '0 2px 8px rgba(0,0,0,0.6)', marginBottom: 36 }}>
            {`2D · ${props.ageRating || '전체관람가'}`}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 32 }}>
            <div style={{ display: 'flex', color: '#f1f5f9', fontSize: 30, fontWeight: 700, textShadow: '0 2px 8px rgba(0,0,0,0.6)' }}>{props.movieDate}</div>
            {props.venue && (
              <div style={{ display: 'flex', color: '#e2e8f0', fontSize: 26, textShadow: '0 2px 8px rgba(0,0,0,0.6)', marginTop: 8 }}>{`📍 ${props.venue}`}</div>
            )}
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: 'rgba(0,0,0,0.42)',
              padding: '24px 28px',
              borderRadius: 20,
              marginBottom: 36,
            }}
          >
            {props.popcornLines.map((line, i) => (
              <div key={i} style={{ display: 'flex', color: '#e2e8f0', fontSize: 26, marginBottom: 4 }}>
                {line}
              </div>
            ))}
            <div style={{ display: 'flex', color: '#94a3b8', fontSize: 24, fontWeight: 700, marginTop: 8 }}>
              {`결제 금액 ${props.priceText}`}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-end' }}>
              <div
                style={{
                  display: 'flex',
                  color: '#ef4444',
                  fontSize: 88,
                  fontWeight: 700,
                  textDecoration: props.statusType === 'canceled' ? 'line-through' : 'none',
                }}
              >
                {props.seat}
              </div>
              <div style={{ display: 'flex', color: '#e2e8f0', fontSize: 26, textShadow: '0 2px 6px rgba(0,0,0,0.6)', marginLeft: 16, marginBottom: 12 }}>
                {`${props.name} 님`}
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                padding: '8px 18px',
                borderRadius: 12,
                backgroundColor: 'rgba(0,0,0,0.5)',
                color: props.badgeColor,
                border: `2px solid ${props.badgeColor}`,
                fontSize: 22,
                fontWeight: 700,
              }}
            >
              {props.badgeText}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', width: CARD_WIDTH, position: 'absolute', bottom: -14, left: 0, padding: '0 16px' }}>
          {scallops}
        </div>
        </div>
      </div>
    ),
    {
      width: OUTER_WIDTH,
      height: OUTER_HEIGHT,
      emoji: 'twemoji',
      fonts: [
        { name: 'Pretendard', data: regularFont, weight: 400, style: 'normal' },
        { name: 'Pretendard', data: boldFont, weight: 700, style: 'normal' },
      ],
    }
  );

  const buf = await response.arrayBuffer();
  return Buffer.from(buf);
}
