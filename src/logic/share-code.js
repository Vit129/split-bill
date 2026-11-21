// Connection codes for the copy-paste handshake (no server). A code is base64 of a small JSON
// with the WebRTC session description. Decoding treats the text as untrusted input.
const VERSION = 1;
const MAX_CODE_CHARS = 20000;

export function encodeSignal(description) {
  return btoa(JSON.stringify({ v: VERSION, type: description.type, sdp: description.sdp }));
}

// Returns { type, sdp } or throws Error('INVALID_CODE').
export function decodeSignal(code) {
  if (typeof code !== 'string') throw new Error('INVALID_CODE');
  const text = code.trim();
  if (text.length === 0 || text.length > MAX_CODE_CHARS) throw new Error('INVALID_CODE');
  let parsed;
  try {
    parsed = JSON.parse(atob(text));
  } catch {
    throw new Error('INVALID_CODE');
  }
  const ok = parsed && parsed.v === VERSION
    && (parsed.type === 'offer' || parsed.type === 'answer')
    && typeof parsed.sdp === 'string' && parsed.sdp.length > 0;
  if (!ok) throw new Error('INVALID_CODE');
  return { type: parsed.type, sdp: parsed.sdp };
}
