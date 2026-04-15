/**
 * Hook for managing a scrollable log of timestamped entries.
 */

import { useState, useCallback } from "react";

export interface LogEntry {
  timestamp: string;
  message: string;
}

function formatTime(): string {
  const now = new Date();
  return now.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
  });
}

export function useScrollableLog(maxEntries = 200) {
  const [entries, setEntries] = useState<LogEntry[]>([]);

  const addEntry = useCallback(
    (message: string) => {
      setEntries((prev) => {
        const next = [...prev, { timestamp: formatTime(), message }];
        if (next.length > maxEntries) {
          return next.slice(next.length - maxEntries);
        }

        return next;
      });
    },
    [maxEntries],
  );

  const clear = useCallback(() => {
    setEntries([]);
  }, []);

  return { entries, addEntry, clear };
}
