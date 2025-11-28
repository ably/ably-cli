import React, { useEffect, useRef } from "react";

export type OverlayVariant =
  | "connecting"
  | "reconnecting"
  | "error"
  | "maxAttempts";

export interface TerminalOverlayProperties {
  variant: OverlayVariant;
  title: string;
  lines: string[];
  drawer?: {
    lines: string[];
  };
}

export const TerminalOverlay: React.FC<TerminalOverlayProperties> = ({
  variant,
  title,
  lines,
  drawer,
}) => {
  const overlayReference = useRef<HTMLDivElement>(null);

  // No-op effect retained in case future diagnostics are needed
  useEffect(() => {}, []);

  // Critical layout styles for outer dim/backdrop
  const overlayStyle: React.CSSProperties = {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "rgba(0,0,0,0.6)",
    pointerEvents: "none",
    zIndex: 10,
  };

  // Colours per variant (kept inline so no external CSS needed)
  const variantColour: Record<OverlayVariant, string> = {
    connecting: "#3af",
    reconnecting: "#fd0",
    error: "#f44",
    maxAttempts: "#f44",
  };

  const boxStyle: React.CSSProperties = {
    background: "#000",
    opacity: 0.9,
    fontFamily: "monospace",
    fontSize: 14,
    lineHeight: "16px",
    padding: "0",
    maxWidth: "80%",
    // Remove CSS border - we're using ASCII borders
  };

  return (
    <div
      ref={overlayReference}
      className={`ably-overlay ably-${variant}`}
      style={overlayStyle}
      data-testid="ably-overlay"
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "16px",
        }}
      >
        {/* Main box */}
        {(() => {
          // Build ASCII box dynamically
          const visibleLines = [title, ...lines];

          // Calculate width of longest line
          const titleWidth = getStringWidth(stripHtml(title));
          const linesWidth = lines.reduce(
            (m, l) => Math.max(m, getStringWidth(stripHtml(l))),
            0,
          );
          let longest = Math.max(titleWidth, linesWidth);

          // Also consider drawer lines for width calculation
          if (drawer && drawer.lines.length > 0) {
            const drawerLongest = drawer.lines.reduce(
              (m, l) => Math.max(m, getStringWidth(stripHtml(l))),
              0,
            );
            longest = Math.max(longest, drawerLongest);
          }

          // Use a fixed width based on the variant to prevent jumping
          // Add padding for box borders and some breathing room
          const contentWidth =
            variant === "connecting" || variant === "reconnecting"
              ? 80
              : Math.max(longest + 4, 70);
          const horizontal = "-".repeat(contentWidth + 2); // +2 for padding spaces

          const pad = (string_: string) => {
            const stringWidth = getStringWidth(string_);
            const paddingNeeded = contentWidth - stringWidth;
            return string_ + " ".repeat(Math.max(0, paddingNeeded));
          };
          const linesNodes: React.ReactNode[] = [];

          const newline = "\n";

          const pushBorderLine = (
            text: string,
            color: string = variantColour[variant],
          ) => {
            linesNodes.push(
              <span key={linesNodes.length} style={{ color }}>
                {text}
                {newline}
              </span>,
            );
          };

          const pushContentLine = (
            plain: string,
            index: number,
            borderColor: string = variantColour[variant],
          ) => {
            // Check if this line has the cancel hint
            const cancelMatch = plain.match(
              /^(.*?)(\s*\(Press ⏎ to cancel\))$/,
            );

            if (cancelMatch) {
              // Split the line into main text and cancel hint
              const mainText = cancelMatch[1];
              const cancelText = cancelMatch[2];
              const mainWidth = getStringWidth(mainText);
              const cancelWidth = getStringWidth(cancelText);
              const paddingNeeded = contentWidth - mainWidth - cancelWidth;
              const padding = " ".repeat(Math.max(0, paddingNeeded));

              linesNodes.push(
                <React.Fragment key={linesNodes.length}>
                  <span style={{ color: borderColor }}>| </span>
                  <span style={{ color: "#777" }}>{mainText}</span>
                  <span>{padding}</span>
                  <span style={{ color: "#555" }}>{cancelText}</span>
                  <span style={{ color: borderColor }}> |{newline}</span>
                </React.Fragment>,
              );
            } else {
              const padded = pad(plain);

              let col = "#fff";
              if (plain.startsWith("Next attempt")) col = "#777";
              else if (plain.startsWith("Press")) col = "#0af";
              else if (index === 0) col = variantColour[variant];

              linesNodes.push(
                <React.Fragment key={linesNodes.length}>
                  <span style={{ color: borderColor }}>| </span>
                  <span style={{ color: col }}>{padded}</span>
                  <span style={{ color: borderColor }}> |{newline}</span>
                </React.Fragment>,
              );
            }
          };

          // top border
          pushBorderLine(`+${horizontal}+`);

          visibleLines.forEach((ln, index) =>
            pushContentLine(
              typeof ln === "string" ? ln : stripHtml(String(ln)),
              index,
            ),
          );

          // bottom border
          pushBorderLine(`+${horizontal}+`);

          const mainBox = (
            <pre style={{ ...boxStyle, whiteSpace: "pre", margin: 0 }}>
              {linesNodes}
            </pre>
          );

          // If drawer is provided, render it below the main box
          if (drawer && drawer.lines.length > 0) {
            const drawerNodes: React.ReactNode[] = [];
            const drawerColor = "#4a9eff"; // Light blue color for drawer

            // Use same width as main box
            const drawerWidth = contentWidth;
            const drawerHorizontal = "-".repeat(drawerWidth + 2);
            const drawerPad = (string_: string) => {
              const stringWidth = getStringWidth(string_);
              const paddingNeeded = drawerWidth - stringWidth;
              return string_ + " ".repeat(Math.max(0, paddingNeeded));
            };

            const pushDrawerBorderLine = (text: string) => {
              drawerNodes.push(
                <span
                  key={`drawer-${drawerNodes.length}`}
                  style={{ color: drawerColor }}
                >
                  {text}
                  {newline}
                </span>,
              );
            };

            const pushDrawerContentLine = (plain: string) => {
              const padded = drawerPad(plain);
              drawerNodes.push(
                <React.Fragment key={`drawer-${drawerNodes.length}`}>
                  <span style={{ color: drawerColor }}>| </span>
                  <span style={{ color: "#fff" }}>{padded}</span>
                  <span style={{ color: drawerColor }}> |{newline}</span>
                </React.Fragment>,
              );
            };

            // Drawer top border (use dotted style for visual separation)
            pushDrawerBorderLine(`+${drawerHorizontal}+`);

            // Drawer content
            drawer.lines.forEach((line) => pushDrawerContentLine(line));

            // Drawer bottom border
            pushDrawerBorderLine(`+${drawerHorizontal}+`);

            const drawerBoxStyle: React.CSSProperties = {
              background: "#000",
              opacity: 0.85,
              fontFamily: "monospace",
              fontSize: 14,
              lineHeight: "16px",
              maxWidth: "80%",
              whiteSpace: "pre" as const,
              margin: 0,
              padding: "0",
            };
            const drawerBox = <pre style={drawerBoxStyle}>{drawerNodes}</pre>;

            return (
              <>
                {mainBox}
                {drawerBox}
              </>
            );
          }

          return mainBox;
        })()}
      </div>
    </div>
  );
};

function stripHtml(string_: string): string {
  return string_.replaceAll(/<[^>]*>/g, "");
}

// Calculate the actual display width of a string in a terminal
// Emojis and some Unicode characters take up 2 character widths
function getStringWidth(string_: string): number {
  let width = 0;
  for (let index = 0; index < string_.length; index++) {
    const code = string_.charCodeAt(index);
    // Check for emoji and wide characters
    if (
      code >= 0x1_f0_00 || // Emoji blocks
      (code >= 0x26_00 && code <= 0x26_ff) || // Misc symbols
      (code >= 0x27_00 && code <= 0x27_bf) || // Dingbats
      (code >= 0xfe_00 && code <= 0xfe_0f) || // Variation selectors
      (code >= 0x1_f3_00 && code <= 0x1_f5_ff) || // Misc Symbols and Pictographs
      (code >= 0x1_f6_00 && code <= 0x1_f6_4f) || // Emoticons
      (code >= 0x1_f6_80 && code <= 0x1_f6_ff) || // Transport and Map
      (code >= 0x1_f9_00 && code <= 0x1_f9_ff)
    ) {
      // Supplemental Symbols and Pictographs
      width += 2;
      // Skip next char if it's a combining character
      if (
        index + 1 < string_.length &&
        string_.charCodeAt(index + 1) >= 0xfe_00 &&
        string_.charCodeAt(index + 1) <= 0xfe_0f
      ) {
        index++;
      }
    } else {
      width += 1;
    }
  }
  return width;
}

export default TerminalOverlay;
