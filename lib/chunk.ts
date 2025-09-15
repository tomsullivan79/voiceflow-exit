// Simple text chunker: ~1200 chars with ~200 char overlap.
// Good enough to start; we can swap for token-based later.
export function chunkText(
  text: string,
  maxLen = 1200,
  overlap = 200
): { index: number; content: string }[] {
  const clean = text.replace(/\r/g, "").trim();
  const parts: string[] = clean
    .split(/\n{2,}/g)           // paragraph-ish
    .map(s => s.trim())
    .filter(Boolean);

  const chunks: { index: number; content: string }[] = [];
  let buf = "";
  let i = 0;

  const push = (s: string) => {
    chunks.push({ index: i++, content: s.trim() });
  };

  for (const p of parts) {
    if ((buf + "\n\n" + p).length <= maxLen) {
      buf = buf ? `${buf}\n\n${p}` : p;
    } else {
      if (buf) push(buf);
      // start next buffer with overlap tail
      const tail = buf.slice(-overlap);
      buf = (tail ? tail + "\n\n" : "") + p;
      while (buf.length > maxLen) {
        push(buf.slice(0, maxLen));
        buf = buf.slice(maxLen - overlap);
      }
    }
  }
  if (buf) push(buf);
  return chunks;
}
