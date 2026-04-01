// Temporary stub for legacy terminal-box until fully removed.
export const colour = {
  reset: "",
  bold: "",
  dim: "",
  red: "",
  green: "",
  yellow: "",
  blue: "",
  magenta: "",
  cyan: "",
};
export interface TerminalBox {
  row: number;
  width: number;
  content: string[];
  term: unknown;
  height: number;
}
export function drawBox(..._args: unknown[]): TerminalBox {
  return { row: 0, width: 0, content: [], term: null, height: 0 };
}
export function clearBox(_box: TerminalBox): void {}
export function updateLine(
  _box: TerminalBox,
  _line: number,
  _text: string,
  _color?: string,
): void {}
export function updateSpinner(): void {}
