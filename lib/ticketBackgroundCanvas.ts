// lib/ticketBackgroundCanvas.ts
// 관리자 브라우저에서 티켓 카드의 "outer 배경"(블러 확산 배경 + 로고 + 카드
// 프레임 + 절취선, 텍스트는 없음)을 미리 PNG로 합성한다. 이 무거운 합성을
// 이메일 발송 시점(Cloudflare Workers, CPU 예산 있음)이 아니라 관리자가 포스터를
// 등록할 때 브라우저(CPU 무제한)에서 한 번만 처리해서, 발송 시엔 이 PNG 위에
// app/api/ticket/route.ts가 순수 이메일 HTML로 텍스트만 오버레이하면 되게 한다.
// 레이아웃 상수는 route.ts의 DISPLAY_* 좌표 계산과 반드시 일치해야 한다.

const CARD_WIDTH = 700;
const CARD_HEIGHT = 960;
const SIDE_MARGIN = 140;
const TOP_MARGIN = 90;
const LOGO_BLOCK_HEIGHT = 170;
const BOTTOM_MARGIN = 90;
const OUTER_WIDTH = CARD_WIDTH + SIDE_MARGIN * 2;
const OUTER_HEIGHT = TOP_MARGIN + LOGO_BLOCK_HEIGHT + CARD_HEIGHT + BOTTOM_MARGIN;
const SCALLOP_COUNT = 13;
const CARD_RADIUS = 28;
const SCALE = 2;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`이미지를 불러오지 못했습니다: ${src}`));
    img.src = src;
  });
}

async function ensureSongMyungFont(): Promise<void> {
  if (!document.getElementById('song-myung-font-link')) {
    const link = document.createElement('link');
    link.id = 'song-myung-font-link';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Song+Myung&display=swap';
    document.head.appendChild(link);
  }
  await document.fonts.load('700 34px "Song Myung"');
  await document.fonts.ready;
}

function drawRoundedRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** object-fit: cover를 흉내 낸다 — 이미지 종횡비를 유지한 채 대상 영역을 꽉 채운다. */
function drawImageCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number): void {
  const imgRatio = img.naturalWidth / img.naturalHeight;
  const targetRatio = w / h;
  let sx = 0;
  let sy = 0;
  let sw = img.naturalWidth;
  let sh = img.naturalHeight;
  if (imgRatio > targetRatio) {
    sw = img.naturalHeight * targetRatio;
    sx = (img.naturalWidth - sw) / 2;
  } else {
    sh = img.naturalWidth / targetRatio;
    sy = (img.naturalHeight - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function drawEdgeGradients(ctx: CanvasRenderingContext2D): void {
  const topH = TOP_MARGIN + LOGO_BLOCK_HEIGHT * 0.6;
  const top = ctx.createLinearGradient(0, 0, 0, topH);
  top.addColorStop(0, '#0b1120');
  top.addColorStop(1, 'rgba(11,17,32,0)');
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, OUTER_WIDTH, topH);

  const bottomH = BOTTOM_MARGIN + 60;
  const bottom = ctx.createLinearGradient(0, OUTER_HEIGHT - bottomH, 0, OUTER_HEIGHT);
  bottom.addColorStop(0, 'rgba(11,17,32,0)');
  bottom.addColorStop(1, '#0b1120');
  ctx.fillStyle = bottom;
  ctx.fillRect(0, OUTER_HEIGHT - bottomH, OUTER_WIDTH, bottomH);

  const sideW = SIDE_MARGIN + 60;
  const left = ctx.createLinearGradient(0, 0, sideW, 0);
  left.addColorStop(0, '#0b1120');
  left.addColorStop(1, 'rgba(11,17,32,0)');
  ctx.fillStyle = left;
  ctx.fillRect(0, 0, sideW, OUTER_HEIGHT);

  const right = ctx.createLinearGradient(OUTER_WIDTH - sideW, 0, OUTER_WIDTH, 0);
  right.addColorStop(0, 'rgba(11,17,32,0)');
  right.addColorStop(1, '#0b1120');
  ctx.fillStyle = right;
  ctx.fillRect(OUTER_WIDTH - sideW, 0, sideW, OUTER_HEIGHT);
}

function drawLogo(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.font = '700 34px "Song Myung"';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f1f5f9';
  ctx.shadowColor = 'rgba(255,255,255,0.25)';
  ctx.shadowBlur = 18;
  const cx = OUTER_WIDTH / 2;
  const cy = TOP_MARGIN + LOGO_BLOCK_HEIGHT / 2;
  ctx.fillText('영화', cx, cy - 24);
  ctx.fillText('대교', cx, cy + 24);
  ctx.restore();
}

function drawCardFrame(ctx: CanvasRenderingContext2D, poster: HTMLImageElement, cardLeft: number, cardTop: number): void {
  // 그림자는 클리핑 전에 별도로 그린다 (클립 안에서는 shadow가 카드 내부에 안 보임).
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 60;
  ctx.shadowOffsetY = 30;
  ctx.fillStyle = '#161b26';
  drawRoundedRectPath(ctx, cardLeft, cardTop, CARD_WIDTH, CARD_HEIGHT, CARD_RADIUS);
  ctx.fill();
  ctx.restore();

  ctx.save();
  drawRoundedRectPath(ctx, cardLeft, cardTop, CARD_WIDTH, CARD_HEIGHT, CARD_RADIUS);
  ctx.clip();

  ctx.fillStyle = '#161b26';
  ctx.fillRect(cardLeft, cardTop, CARD_WIDTH, CARD_HEIGHT);
  drawImageCover(ctx, poster, cardLeft, cardTop, CARD_WIDTH, CARD_HEIGHT);

  const grad = ctx.createLinearGradient(0, cardTop, 0, cardTop + CARD_HEIGHT);
  grad.addColorStop(0, 'rgba(22,27,38,0)');
  grad.addColorStop(0.3, 'rgba(22,27,38,0.05)');
  grad.addColorStop(0.5, 'rgba(22,27,38,0.35)');
  grad.addColorStop(0.68, 'rgba(22,27,38,0.72)');
  grad.addColorStop(0.85, 'rgba(22,27,38,0.9)');
  grad.addColorStop(1, 'rgba(22,27,38,0.97)');
  ctx.fillStyle = grad;
  ctx.fillRect(cardLeft, cardTop, CARD_WIDTH, CARD_HEIGHT);

  ctx.restore();
}

/**
 * 카드 아래쪽 가장자리를 반원 모양으로 "뚫어서" 절취선처럼 보이게 한다. 원을
 * 그 자리에 얹으면(이전 구현) 카드 안쪽 절반은 카드와 같은 색이라 안 보이고
 * 바깥쪽 절반만 배경 위에 도드라져서 단추처럼 보이는 문제가 있었다 —
 * destination-out으로 실제로 지워서 카드 뒤 배경이 비치게 하면 진짜 절취선
 * 노치처럼 보인다.
 */
function drawScallops(ctx: CanvasRenderingContext2D, cardLeft: number, cardTop: number): void {
  const radius = 14;
  const padding = 16;
  const areaWidth = CARD_WIDTH - padding * 2;
  const gap = SCALLOP_COUNT > 1 ? areaWidth / (SCALLOP_COUNT - 1) : 0;
  const cy = cardTop + CARD_HEIGHT;

  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < SCALLOP_COUNT; i++) {
    const cx = cardLeft + padding + gap * i;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#000000';
    ctx.fill();
  }
  ctx.restore();
}

/**
 * posterUrl(원본 포스터 주소)로부터 텍스트 없는 티켓 카드 배경 PNG(980×1310, SCALE 적용 시 실제 픽셀은 그 2배)를
 * 만들어 Blob으로 반환한다. same-origin 프록시(/api/poster-image)를 거치므로
 * CORS로 canvas가 오염되지 않는다.
 */
export async function renderTicketBackground(posterUrl: string): Promise<Blob> {
  await ensureSongMyungFont();
  const poster = await loadImage(`/api/poster-image?src=${encodeURIComponent(posterUrl)}`);

  const canvas = document.createElement('canvas');
  canvas.width = OUTER_WIDTH * SCALE;
  canvas.height = OUTER_HEIGHT * SCALE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context를 가져올 수 없습니다.');
  ctx.scale(SCALE, SCALE);

  ctx.fillStyle = '#0b1120';
  ctx.fillRect(0, 0, OUTER_WIDTH, OUTER_HEIGHT);

  ctx.save();
  ctx.filter = 'blur(70px) brightness(0.7) saturate(1.6)';
  drawImageCover(ctx, poster, -80, -80, OUTER_WIDTH + 160, OUTER_HEIGHT + 160);
  ctx.restore();

  ctx.fillStyle = 'rgba(11,17,32,0.15)';
  ctx.fillRect(0, 0, OUTER_WIDTH, OUTER_HEIGHT);

  drawEdgeGradients(ctx);
  drawLogo(ctx);

  const cardLeft = SIDE_MARGIN;
  const cardTop = TOP_MARGIN + LOGO_BLOCK_HEIGHT;
  drawCardFrame(ctx, poster, cardLeft, cardTop);
  drawScallops(ctx, cardLeft, cardTop);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) reject(new Error('PNG 생성에 실패했습니다.'));
      else resolve(blob);
    }, 'image/png');
  });
}

export function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('이미지 인코딩에 실패했습니다.'));
    reader.readAsDataURL(blob);
  });
}
