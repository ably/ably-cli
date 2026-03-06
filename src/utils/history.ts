import * as Ably from "ably";

import { parseTimestamp } from "./time.js";

export function buildHistoryParams(flags: {
  start?: string;
  end?: string;
  direction?: string;
  limit?: number;
}): Ably.RealtimeHistoryParams {
  const params: Ably.RealtimeHistoryParams = {
    direction: (flags.direction as "backwards" | "forwards") || "backwards",
    limit: flags.limit,
  };

  if (flags.start) {
    params.start = parseTimestamp(flags.start, "start");
  }

  if (flags.end) {
    params.end = parseTimestamp(flags.end, "end");
  }

  if (
    params.start !== undefined &&
    params.end !== undefined &&
    params.start > params.end
  ) {
    throw new Error("--start must be earlier than or equal to --end");
  }

  return params;
}
