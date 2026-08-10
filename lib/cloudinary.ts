const UPLOAD_TIMEOUT_MS = 8_000;

async function sha1Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Uploads an already-fully-composed PNG (data URI) to Cloudinary and returns
 * its public URL. No transformation is requested — the image (blur, logo,
 * card frame, perforation) is already baked in by the admin's browser via
 * lib/ticketBackgroundCanvas.ts, so this is just storage.
 */
export async function uploadTicketBackground(dataUri: string): Promise<string | null> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) return null;

  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const paramsToSign = `timestamp=${timestamp}`;
    const signature = await sha1Hex(paramsToSign + apiSecret);

    const body = new URLSearchParams({
      file: dataUri,
      api_key: apiKey,
      timestamp: String(timestamp),
      signature,
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: 'POST',
        body,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
    if (!res.ok) return null;

    const json = (await res.json()) as { secure_url?: string };
    return json.secure_url ?? null;
  } catch {
    return null;
  }
}
