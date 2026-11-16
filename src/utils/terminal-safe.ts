/**
 * Defences against terminal escape injection.
 *
 * Message data, channel names, client IDs and other values the CLI prints come
 * from whoever published them, not from the person running the CLI. A
 * publisher can embed control sequences that clear the screen, move the
 * cursor, set the window title, write hyperlinks (OSC 8) or the clipboard
 * (OSC 52). Printed raw, those sequences run in the reader's terminal.
 *
 * Two layers:
 * - `escapeControlChars()` is applied by the output formatters to every
 *   remote-sourced value before it is coloured. It renders control characters
 *   as visible `\uXXXX` text, matching what `--json` output already shows.
 * - `stripUnsafeEscapes()` is a backstop applied to every line the base command
 *   writes. It removes any escape sequence other than SGR (colour/style), which
 *   is all the CLI's own formatted output uses.
 */

const ESC = 0x1b;
const BEL = 0x07;
const TAB = 0x09;
const LF = 0x0a;

/**
 * C0 controls except TAB and LF, plus DEL and the C1 range. C1 matters because
 * 0x9B is an 8-bit CSI and 0x9D an 8-bit OSC.
 */
function isControlChar(code: number): boolean {
  if (code === TAB || code === LF) return false;
  return code <= 0x1f || (code >= 0x7f && code <= 0x9f);
}

/**
 * Bidirectional embedding, override and isolate controls (U+202A–U+202E,
 * U+2066–U+2069). They reorder how the rest of a line is displayed, so a value
 * can make itself, or text after it, read differently from what it is
 * ("Trojan Source"). Legitimate right-to-left text does not need them.
 */
function isBidiControl(code: number): boolean {
  return (
    (code >= 0x20_2a && code <= 0x20_2e) || (code >= 0x20_66 && code <= 0x20_69)
  );
}

/**
 * Invisible characters that have no business in an identifier: soft hyphen,
 * Arabic letter mark, Mongolian vowel separator, zero-width space, word joiner
 * and invisible operators, deprecated format controls, and the BOM. They make
 * two different names look identical. ZWNJ, ZWJ, LRM and RLM (U+200C–U+200F)
 * are deliberately left alone: emoji sequences and Persian, Arabic and Hebrew
 * names legitimately need them.
 */
function isInvisibleFormatChar(code: number): boolean {
  return (
    code === 0xad ||
    code === 0x6_1c ||
    code === 0x18_0e ||
    code === 0x20_0b ||
    (code >= 0x20_60 && code <= 0x20_64) ||
    (code >= 0x20_6a && code <= 0x20_6f) ||
    code === 0xfe_ff
  );
}

const isFreeTextUnsafe = (code: number) =>
  isControlChar(code) || isBidiControl(code);

/**
 * Identifiers are single-line: a newline or tab in a client ID or channel name
 * could forge an extra, genuine-looking line of output.
 */
const isIdentifierUnsafe = (code: number) =>
  code === LF ||
  code === TAB ||
  isFreeTextUnsafe(code) ||
  isInvisibleFormatChar(code);

const visibleEscape = (code: number) =>
  `\\u${code.toString(16).padStart(4, "0")}`;

/**
 * Index of the first UTF-16 unit matching `predicate`, or -1. Every character
 * these helpers look for is in the BMP, so surrogate halves never match.
 */
function findFirst(text: string, predicate: (code: number) => boolean): number {
  for (let i = 0; i < text.length; i++) {
    if (predicate(text.codePointAt(i) ?? 0)) return i;
  }
  return -1;
}

function escapeMatching(
  value: unknown,
  shouldEscape: (code: number) => boolean,
): string {
  // String() guards against non-string values from untyped SDK payloads.
  const text = String(value);
  // Nearly every value is clean: return it untouched, with no allocation.
  const first = findFirst(text, shouldEscape);
  if (first === -1) return text;

  let result = text.slice(0, first);
  for (const char of text.slice(first)) {
    const code = char.codePointAt(0)!;
    result += shouldEscape(code) ? visibleEscape(code) : char;
  }
  return result;
}

/**
 * Render control characters and bidi overrides in an untrusted string as
 * visible `\uXXXX` text. Newlines and tabs are kept so multi-line message data
 * stays readable. Use for free text such as message data.
 */
export function escapeControlChars(text: unknown): string {
  return escapeMatching(text, isFreeTextUnsafe);
}

/**
 * Like `escapeControlChars()`, but also escapes newlines, tabs and invisible
 * formatting characters, so a channel name, client ID, event name or other ID
 * stays on one line and cannot pass itself off as a different one. Use for
 * identifiers, never prose.
 */
export function escapeIdentifier(text: unknown): string {
  return escapeMatching(text, isIdentifierUnsafe);
}

/**
 * `JSON.stringify` escapes U+0000–U+001F but emits DEL, the C1 range and bidi
 * overrides raw. Escape those as `\uXXXX` too, so JSON output carries no
 * terminal control characters for `stripUnsafeEscapes()` to drop and cannot
 * reorder how a line displays: it stays lossless and parses back to the same
 * value. Safe on serialised JSON because these characters can only occur
 * inside string literals.
 */
export function escapeJsonControlChars(json: string): string {
  return json.replaceAll(/[\u007F-\u009F\u202A-\u202E\u2066-\u2069]/g, (char) =>
    visibleEscape(char.codePointAt(0)!),
  );
}

const codeAt = (text: string, index: number): number =>
  text.codePointAt(index) ?? -1;

const inRange = (code: number, low: number, high: number) =>
  code >= low && code <= high;

const CAN = 0x18;
const SUB = 0x1a;
const C1_CSI = 0x9b;
const C1_ST = 0x9c;
/** 8-bit DCS, SOS, OSC, PM and APC: each opens a control string. */
const C1_STRING_INTRODUCERS = new Set([0x90, 0x98, 0x9d, 0x9e, 0x9f]);

/** Index just past the parameter, intermediate and final bytes of a CSI body. */
function skipCsiBody(
  text: string,
  start: number,
): { end: number; params: string; isSgrShaped: boolean } {
  let j = start;
  while (j < text.length && inRange(codeAt(text, j), 0x30, 0x3f)) j++;
  const paramsEnd = j;
  while (j < text.length && inRange(codeAt(text, j), 0x20, 0x2f)) j++;
  const hasFinal = j < text.length && inRange(codeAt(text, j), 0x40, 0x7e);
  const params = text.slice(start, paramsEnd);
  return {
    end: hasFinal ? j + 1 : j,
    params,
    isSgrShaped:
      hasFinal &&
      text[j] === "m" &&
      paramsEnd === j &&
      /^[\d;:]*$/.test(params),
  };
}

/**
 * Index just past a control string (OSC, DCS, SOS, PM, APC) whose body starts
 * at `start`. It ends at BEL or ST (ESC \ or 8-bit 0x9C). CAN and SUB abort it,
 * and so does any other ESC, which starts a new sequence and is left for the
 * caller to parse; that matches terminals, and stops an unterminated string
 * from swallowing text that follows it.
 */
function skipControlString(text: string, start: number): number {
  let j = start;
  while (j < text.length) {
    const c = codeAt(text, j);
    if (c === BEL || c === C1_ST || c === CAN || c === SUB) return j + 1;
    if (c === ESC) return text[j + 1] === "\\" ? j + 2 : j;
    j++;
  }
  return j;
}

/**
 * SGR attributes the CLI never emits and that only serve to hide or distract:
 * 5 and 6 (blink) and 8 (conceal). Extended colour arguments (38/48/58 with
 * `;5;n` or `;2;r;g;b`) are skipped so a colour index of 5 or 8 is not
 * mistaken for an attribute.
 */
function isSafeSgr(params: string): boolean {
  const tokens = params === "" ? ["0"] : params.split(";");
  for (let k = 0; k < tokens.length; k++) {
    const token = tokens[k] ?? "";
    const attribute = Number(token.split(":")[0] || "0");
    if (attribute === 38 || attribute === 48 || attribute === 58) {
      if (token.includes(":")) continue;
      const mode = tokens[k + 1];
      if (mode === "5") k += 2;
      else if (mode === "2") k += 4;
      continue;
    }
    if (attribute === 5 || attribute === 6 || attribute === 8) return false;
  }
  return true;
}

/**
 * Remove every escape sequence except SGR colours and text styles (and drop
 * blink and conceal even there), every other control character except TAB and
 * LF, and bidi overrides. Handles both 7-bit (ESC-prefixed) and 8-bit C1
 * introducers. Applied to whole output lines, after formatting, so the CLI's
 * own colours survive.
 */
export function stripUnsafeEscapes(text: string): string {
  // Nearly every line is clean: skip the scan and allocation entirely.
  // ESC and the 8-bit introducers are all control characters.
  const first = findFirst(text, isFreeTextUnsafe);
  if (first === -1) return text;

  let result = text.slice(0, first);
  let i = first;

  while (i < text.length) {
    const code = codeAt(text, i);

    if (code === C1_CSI) {
      i = skipCsiBody(text, i + 1).end;
      continue;
    }

    if (C1_STRING_INTRODUCERS.has(code)) {
      i = skipControlString(text, i + 1);
      continue;
    }

    if (code !== ESC) {
      if (!isControlChar(code) && !isBidiControl(code)) result += text[i];
      i++;
      continue;
    }

    const introducer = text[i + 1];

    if (introducer === "[") {
      const csi = skipCsiBody(text, i + 2);
      if (csi.isSgrShaped && isSafeSgr(csi.params)) {
        result += text.slice(i, csi.end);
      }
      i = csi.end;
      continue;
    }

    if (introducer === "]" || "PX^_".includes(introducer ?? "\0")) {
      i = skipControlString(text, i + 2);
      continue;
    }

    // Any other escape: ESC, intermediate bytes, one final byte.
    let j = i + 1;
    while (j < text.length && inRange(codeAt(text, j), 0x20, 0x2f)) j++;
    if (j < text.length && inRange(codeAt(text, j), 0x30, 0x7e)) j++;
    i = j;
  }

  return result;
}
