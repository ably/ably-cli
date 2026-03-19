/**
 * Split text into chunks of approximately `chunkSize` characters.
 * Prefers breaking at word boundaries (space, punctuation) when within 2 chars of target.
 * Returns array of string chunks.
 */
export function chunkText(text: string, chunkSize: number): string[] {
  if (!text) return [];
  if (chunkSize <= 0) return [text];
  if (text.length <= chunkSize) return [text];

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    if (start + chunkSize >= text.length) {
      chunks.push(text.slice(start));
      break;
    }

    let end = start + chunkSize;

    // Look for a word boundary within 2 chars of the target
    const searchStart = Math.max(start, end - 2);
    const searchEnd = Math.min(text.length, end + 2);
    let bestBreak = -1;

    for (let i = searchStart; i <= searchEnd; i++) {
      if (
        text[i] === " " ||
        text[i] === "," ||
        text[i] === "." ||
        text[i] === ";" ||
        text[i] === "!" ||
        text[i] === "?"
      ) {
        bestBreak = i + 1; // Include the boundary character in the current chunk
        break;
      }
    }

    if (bestBreak > start) {
      end = bestBreak;
    }

    chunks.push(text.slice(start, end));
    start = end;
  }

  return chunks;
}
