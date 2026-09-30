import { describe, it, expect, vi } from "vitest";

import {
  ConnectionHealthMonitor,
  MAX_UNSTABLE_DROPS,
  STABLE_CONNECTION_MS,
} from "../../../src/utils/connection-health.js";

type Change = Parameters<ConnectionHealthMonitor["handle"]>[0];

function change(
  current: Change["current"],
  reason?: { message: string; code: number; statusCode: number },
): Change {
  return { current, previous: "connected", reason } as Change;
}

describe("ConnectionHealthMonitor", () => {
  it("reports a failed connection with its reason's code", () => {
    const onDead = vi.fn();
    const monitor = new ConnectionHealthMonitor(onDead);

    monitor.handle(
      change("failed", { message: "Evicted", code: 40012, statusCode: 400 }),
    );

    expect(onDead).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Connection failed: Evicted",
        code: 40012,
        statusCode: 400,
      }),
    );
  });

  it("reports a reconnect loop that never stays connected", () => {
    const onDead = vi.fn();
    const monitor = new ConnectionHealthMonitor(onDead, () => 0);

    for (let i = 0; i < MAX_UNSTABLE_DROPS - 1; i++) {
      monitor.handle(change("connected"));
      monitor.handle(change("disconnected"));
    }
    expect(onDead).not.toHaveBeenCalled();

    monitor.handle(change("connected"));
    monitor.handle(change("disconnected"));
    expect(onDead).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining(`${MAX_UNSTABLE_DROPS} times`),
      }),
    );
  });

  it("counts drops while never reaching connected", () => {
    const onDead = vi.fn();
    const monitor = new ConnectionHealthMonitor(onDead);

    for (let i = 0; i < MAX_UNSTABLE_DROPS; i++) {
      monitor.handle(change("connecting"));
      monitor.handle(change("disconnected"));
    }

    expect(onDead).toHaveBeenCalledOnce();
  });

  it("restarts the count after a stable connection", () => {
    const onDead = vi.fn();
    let now = 0;
    const monitor = new ConnectionHealthMonitor(onDead, () => now);

    for (let i = 0; i < MAX_UNSTABLE_DROPS - 1; i++) {
      monitor.handle(change("connected"));
      monitor.handle(change("disconnected"));
    }

    monitor.handle(change("connected"));
    now += STABLE_CONNECTION_MS;
    monitor.handle(change("disconnected"));

    expect(onDead).not.toHaveBeenCalled();
  });

  it("reports only once", () => {
    const onDead = vi.fn();
    const monitor = new ConnectionHealthMonitor(onDead);

    monitor.handle(change("failed"));
    monitor.handle(change("failed"));

    expect(onDead).toHaveBeenCalledOnce();
  });
});
