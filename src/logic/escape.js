// Escapes text before it goes into HTML. Every name or item typed by a user passes through here.
const MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export const esc = (value) => String(value).replace(/[&<>"']/g, (ch) => MAP[ch]);
