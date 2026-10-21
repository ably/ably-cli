import { describe, it, expect, vi, afterEach } from "vitest";
import type * as readline from "node:readline";

import {
  forwardSigintToProcess,
  InterruptError,
  withSigintCancellation,
} from "../../../src/utils/sigint-cancellation.js";

describe("withSigintCancellation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("resolves with the task result and removes its SIGINT listener", async () => {
    const before = process.listenerCount("SIGINT");

    const result = await withSigintCancellation(async () => "done");

    expect(result).toBe("done");
    expect(process.listenerCount("SIGINT")).toBe(before);
  });

  it("propagates task errors", async () => {
    await expect(
      withSigintCancellation(async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
  });

  it("aborts the signal and rejects with InterruptError on SIGINT", async () => {
    const before = process.listenerCount("SIGINT");
    let taskSignal: AbortSignal | undefined;

    const pending = withSigintCancellation((signal) => {
      taskSignal = signal;
      // A task that never settles, like a force-closed inquirer prompt.
      return new Promise<never>(() => {});
    });

    process.emit("SIGINT");

    await expect(pending).rejects.toBeInstanceOf(InterruptError);
    expect(taskSignal?.aborted).toBe(true);
    expect(process.listenerCount("SIGINT")).toBe(before);
  });
});

describe("forwardSigintToProcess", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("closes the prompt and re-raises SIGINT on the process", () => {
    const kill = vi.spyOn(process, "kill").mockImplementation(() => true);
    const close = vi.fn();
    const handlers = new Map<string, () => void>();
    const rl = {
      close,
      on: (event: string, handler: () => void) => handlers.set(event, handler),
    } as unknown as readline.Interface;

    forwardSigintToProcess(rl);
    handlers.get("SIGINT")?.();

    expect(close).toHaveBeenCalledOnce();
    expect(kill).toHaveBeenCalledWith(process.pid, "SIGINT");
  });
});
