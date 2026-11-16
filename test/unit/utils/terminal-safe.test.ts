import { describe, it, expect } from "vitest";
import chalk from "chalk";

import {
  escapeControlChars,
  escapeIdentifier,
  escapeJsonControlChars,
  stripUnsafeEscapes,
} from "../../../src/utils/terminal-safe.js";

const ESC = "\u001B";

describe("escapeControlChars", () => {
  it("renders ESC-introduced sequences as visible text", () => {
    expect(escapeControlChars(`${ESC}[2J${ESC}]0;title\u0007`)).toBe(
      String.raw`\u001b[2J\u001b]0;title\u0007`,
    );
  });

  it("escapes carriage return, DEL and 8-bit C1 controls", () => {
    expect(escapeControlChars("a\rb\u007Fc\u009B2Jd")).toBe(
      String.raw`a\u000db\u007fc\u009b2Jd`,
    );
  });

  it("keeps newlines, tabs, backslashes and non-ASCII text", () => {
    const text = "line one\n\tline two C:\\path café 👍";
    expect(escapeControlChars(text)).toBe(text);
  });
});

describe("stripUnsafeEscapes", () => {
  it("keeps SGR colour sequences", () => {
    const coloured = `${chalk.red("red")} ${ESC}[1;38;5;208mbold${ESC}[m`;
    expect(stripUnsafeEscapes(coloured)).toBe(coloured);
  });

  it("removes cursor, erase and other non-SGR CSI sequences", () => {
    expect(
      stripUnsafeEscapes(`a${ESC}[2J${ESC}[H${ESC}[10;5Hb${ESC}[?25l`),
    ).toBe("ab");
  });

  it("removes OSC sequences terminated by BEL or ST, including their payload", () => {
    const link = `${ESC}]8;;https://evil.example/x${ESC}\\CLICK${ESC}]8;;${ESC}\\`;
    const title = `${ESC}]0;TITLE\u0007`;
    const clipboard = `${ESC}]52;c;ZXZpbA==\u0007`;
    expect(stripUnsafeEscapes(`${link} ${title}${clipboard}end`)).toBe(
      "CLICK end",
    );
  });

  it("removes an unterminated OSC to the end of the text", () => {
    expect(stripUnsafeEscapes(`ok${ESC}]0;never-ends`)).toBe("ok");
  });

  it("removes DCS strings and two-byte escapes", () => {
    expect(stripUnsafeEscapes(`a${ESC}Pdata${ESC}\\b${ESC}cc${ESC}(Bd`)).toBe(
      "abcd",
    );
  });

  it("removes stray control characters but keeps newlines and tabs", () => {
    expect(stripUnsafeEscapes("a\rb\u0007c\u009B2J\n\td")).toBe("abc\n\td");
  });

  it("does not let an SGR-looking sequence with intermediates through", () => {
    expect(stripUnsafeEscapes(`a${ESC}[1 mb`)).toBe("ab");
  });
});

describe("escapeJsonControlChars", () => {
  it("escapes DEL and C1 characters that JSON.stringify leaves raw", () => {
    const value = { data: "a\u007Fb\u0085c\u009Bd" };
    const json = escapeJsonControlChars(JSON.stringify(value));

    expect(json).toBe(String.raw`{"data":"a\u007fb\u0085c\u009bd"}`);
    expect(JSON.parse(json)).toEqual(value);
    expect(stripUnsafeEscapes(json)).toBe(json);
  });
});

describe("bidi and invisible characters", () => {
  it("escapeControlChars escapes bidi overrides and isolates", () => {
    expect(escapeControlChars("a\u202Eb\u2066c\u2069")).toBe(
      String.raw`a\u202eb\u2066c\u2069`,
    );
  });

  it("escapeControlChars keeps zero-width joiners so emoji sequences render", () => {
    const family = "👨\u200D👩\u200D👧";
    expect(escapeControlChars(family)).toBe(family);
  });

  it("escapeIdentifier also escapes invisible formatting characters", () => {
    expect(escapeIdentifier("ad\u200Bmin\uFEFF\u00AD")).toBe(
      String.raw`ad\u200bmin\ufeff\u00ad`,
    );
  });

  it("stripUnsafeEscapes drops bidi overrides", () => {
    expect(stripUnsafeEscapes("x\u202Eevil")).toBe("xevil");
  });

  it("escapeJsonControlChars escapes bidi overrides losslessly", () => {
    const value = { name: "a\u202Eb" };
    const json = escapeJsonControlChars(JSON.stringify(value));
    expect(json).toBe(String.raw`{"name":"a\u202eb"}`);
    expect(JSON.parse(json)).toEqual(value);
  });
});

describe("stripUnsafeEscapes SGR filtering", () => {
  it("drops conceal and blink but keeps other styles", () => {
    expect(stripUnsafeEscapes(`${ESC}[8mhidden${ESC}[28m`)).toBe(
      `hidden${ESC}[28m`,
    );
    expect(stripUnsafeEscapes(`${ESC}[1;5mblink${ESC}[m`)).toBe(
      `blink${ESC}[m`,
    );
    expect(stripUnsafeEscapes(`${ESC}[6mfast${ESC}[m`)).toBe(`fast${ESC}[m`);
  });

  it("does not mistake extended colour arguments for blink or conceal", () => {
    const sequences = [
      `${ESC}[38;5;8mgrey`,
      `${ESC}[48;5;5mmagenta`,
      `${ESC}[38;2;5;8;6mrgb`,
      `${ESC}[38:2::255:0:0mrgb`,
    ];
    for (const sequence of sequences) {
      expect(stripUnsafeEscapes(sequence)).toBe(sequence);
    }
  });
});

describe("stripUnsafeEscapes control strings", () => {
  it("removes 8-bit CSI and its parameters", () => {
    expect(stripUnsafeEscapes("a\u009B2Jb")).toBe("ab");
  });

  it("removes 8-bit OSC, DCS, SOS, PM and APC strings with their payload", () => {
    for (const introducer of [
      "\u009D",
      "\u0090",
      "\u0098",
      "\u009E",
      "\u009F",
    ]) {
      expect(stripUnsafeEscapes(`a${introducer}0;payload\u009Cb`)).toBe("ab");
    }
  });

  it("ends a control string at CAN or SUB so later text survives", () => {
    expect(stripUnsafeEscapes(`a${ESC}]0;title\u0018visible`)).toBe("avisible");
    expect(stripUnsafeEscapes(`a${ESC}]0;title\u001Avisible`)).toBe("avisible");
  });

  it("ends a control string at a new escape sequence", () => {
    expect(stripUnsafeEscapes(`a${ESC}]0;title${ESC}[31mred`)).toBe(
      `a${ESC}[31mred`,
    );
  });
});

describe("escapeIdentifier", () => {
  it("escapes newlines and tabs so an identifier cannot forge extra lines", () => {
    expect(escapeIdentifier("mallory\n  Presence: admin\tleft")).toBe(
      String.raw`mallory\u000a  Presence: admin\u0009left`,
    );
  });

  it("keeps ZWJ, ZWNJ, LRM and RLM that real names and emoji need", () => {
    const names = ["👨\u200D👩\u200D👧", "می\u200Cخواهم", "abc\u200Edef\u200F"];
    for (const name of names) {
      expect(escapeIdentifier(name)).toBe(name);
    }
  });
});

describe("clean input", () => {
  it("returns clean strings unchanged", () => {
    const text = `plain text, colours ${ESC}[36mok${ESC}[39m`;
    expect(escapeControlChars("plain text")).toBe("plain text");
    expect(stripUnsafeEscapes("plain text")).toBe("plain text");
    expect(stripUnsafeEscapes(text)).toBe(text);
  });
});
