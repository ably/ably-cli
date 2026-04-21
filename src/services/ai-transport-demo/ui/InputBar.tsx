/**
 * Text input — sits inside the client panel, Claude Code-style.
 */

import React, { useState } from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import { colors } from "./theme.js";

interface InputBarProps {
  onSubmit: (text: string) => void;
  isStreaming: boolean;
  disabled?: boolean;
}

export function InputBar({
  onSubmit,
  isStreaming,
  disabled = false,
}: InputBarProps) {
  const [value, setValue] = useState("");

  const handleSubmit = (text: string) => {
    if (text.trim() && !disabled) {
      onSubmit(text.trim());
      setValue("");
    }
  };

  return (
    <Box flexDirection="column">
      <Box>
        <Text color={colors.success} bold>
          {"❯ "}
        </Text>
        {disabled ? (
          <Text color={colors.dim}>Waiting for server...</Text>
        ) : (
          <TextInput
            value={value}
            onChange={setValue}
            onSubmit={handleSubmit}
            placeholder="Type a message..."
          />
        )}
      </Box>
      <Text color={colors.dim}>
        {isStreaming
          ? "  Ctrl+C cancel │ PgUp/PgDn scroll │ Ctrl+D quit"
          : "  Enter send │ Tab debug │ PgUp/PgDn scroll │ Ctrl+D quit"}
      </Text>
    </Box>
  );
}
