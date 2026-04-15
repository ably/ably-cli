/**
 * Text input bar at the bottom of the TUI.
 */

import React, { useState } from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import { colors } from "./theme.js";

interface InputBarProps {
  onSubmit: (text: string) => void;
  isStreaming: boolean;
  disabled?: boolean;
  placeholder?: string;
}

export function InputBar({
  onSubmit,
  isStreaming,
  disabled = false,
  placeholder = "Type a message...",
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
        <Text color={colors.primary} bold>
          {">"}{" "}
        </Text>
        {disabled ? (
          <Text color={colors.dim}>{placeholder}</Text>
        ) : (
          <TextInput
            value={value}
            onChange={setValue}
            onSubmit={handleSubmit}
            placeholder={placeholder}
          />
        )}
      </Box>
      <Box>
        <Text color={colors.dim}>
          {isStreaming
            ? "Ctrl+C cancel stream │ Ctrl+D quit"
            : "Enter send │ Tab debug │ Ctrl+D quit"}
        </Text>
      </Box>
    </Box>
  );
}
