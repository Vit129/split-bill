// Connection codes for the copy-paste handshake (no server). A code is base64 of a small JSON
// with the WebRTC session description. Decoding treats the text as untrusted input.
const VERSION = 1;
const MAX_CODE_CHARS = 20000;

export interface SignalDescription {
  type: 'offer' | 'answer';
  sdp: string;
}

export function encodeSignal(description: { type: RTCSdpType; sdp?: string }): string {
  return btoa(JSON.stringify({ v: VERSION, type: description.type, sdp: description.sdp ?? '' }));
}

// Returns { type, sdp } or throws Error('INVALID_CODE').
export function decodeSignal(code: unknown): SignalDescription {
  if (typeof code !== 'string') throw new Error('INVALID_CODE');
  const text = code.trim();
  if (text.length === 0 || text.length > MAX_CODE_CHARS) throw new Error('INVALID_CODE');
  let parsed: unknown;
  try {
    parsed = JSON.parse(atob(text));
  } catch {
    throw new Error('INVALID_CODE');
  }
  if (typeof parsed !== 'object' || parsed === null) throw new Error('INVALID_CODE');
  const o = parsed as Record<string, unknown>;
  const ok = o['v'] === VERSION
    && (o['type'] === 'offer' || o['type'] === 'answer')
    && typeof o['sdp'] === 'string' && o['sdp'].length > 0;
  if (!ok) throw new Error('INVALID_CODE');
  return { type: o['type'] as 'offer' | 'answer', sdp: o['sdp'] as string };
}
