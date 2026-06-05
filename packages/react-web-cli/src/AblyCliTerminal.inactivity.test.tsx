import React from "react";
import { render, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import { vi, describe, test, expect, beforeEach, afterEach } from "vitest";

// Mock global-reconnect so reconnect bookkeeping is inert in these tests.
vi.mock("./global-reconnect", () => ({
  getBackoffDelay: vi.fn(() => 0),
  resetState: vi.fn(),
  increment: vi.fn(),
  cancelReconnect: vi.fn(),
  scheduleReconnect: vi.fn(),
  getAttempts: vi.fn(() => 0),
  getMaxAttempts: vi.fn(() => 15),
  isMaxAttemptsReached: vi.fn(() => false),
  isCancelledState: vi.fn(() => false),
  setCountdownCallback: vi.fn(),
  successfulConnectionReset: vi.fn(),
}));

vi.mock("./terminal-box", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    drawBox: vi.fn(),
    clearBox: vi.fn(),
    updateLine: vi.fn(),
    updateSpinner: vi.fn(),
  };
});

vi.mock("@xterm/xterm", () => ({
  Terminal: vi.fn().mockImplementation(function () {
    return {
      open: vi.fn(),
      write: vi.fn(),
      writeln: vi.fn(),
      reset: vi.fn(),
      focus: vi.fn(),
      clear: vi.fn(),
      onData: vi.fn(),
      onResize: vi.fn(),
      dispose: vi.fn(),
      loadAddon: vi.fn(),
      options: {},
      element: null,
      textarea: null,
      scrollToBottom: vi.fn(),
      attachCustomKeyEventHandler: vi.fn(),
      buffer: { active: { cursorX: 0, cursorY: 0 } },
    };
  }),
}));

vi.mock("@xterm/addon-fit", () => ({
  FitAddon: vi.fn().mockImplementation(function () {
    return {
      fit: vi.fn(),
      proposeDimensions: vi.fn(() => ({ cols: 80, rows: 24 })),
    };
  }),
}));

vi.mock("lucide-react", () => ({
  SplitSquareHorizontal: () => null,
  X: () => null,
}));

vi.mock("./utils/crypto", () => ({
  hashCredentials: vi.fn(async (apiKey?: string, accessToken?: string) => {
    return `hash-${apiKey || ""}:${accessToken || ""}`;
  }),
}));

// Import AFTER mocks. Note: use-terminal-visibility is deliberately NOT mocked —
// we drive the real hook via IntersectionObserver + document.visibilityState so
// visibility changes trigger real re-renders.
import { AblyCliTerminal } from "./AblyCliTerminal";
import { CONTROL_MESSAGE_PREFIX } from "./terminal-shared";
import * as GlobalReconnect from "./global-reconnect";

const createControlMessage = (payload: unknown) =>
  CONTROL_MESSAGE_PREFIX + JSON.stringify(payload);

const WS_URL = "wss://web-cli-terminal.ably-dev.com";
const URL_HOST = new URL(WS_URL).host;
const SIGNED_CONFIG = JSON.stringify({
  apiKey: "app.key:secret",
  accessToken: "tok",
  timestamp: 1,
});
const SIGNATURE = "test-signature";
const INACTIVITY_MS = 100;

// --- WebSocket mock ---------------------------------------------------------
type Listener = (ev: unknown) => void;
let sockets: FakeWebSocket[] = [];

class FakeWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  url: string;
  readyState = FakeWebSocket.CONNECTING;
  listeners: Record<string, Listener[]> = {
    open: [],
    message: [],
    close: [],
    error: [],
  };
  send = vi.fn();
  close = vi.fn((code?: number, reason?: string) => {
    if (this.readyState === FakeWebSocket.CLOSED) return;
    this.readyState = FakeWebSocket.CLOSED;
    this.dispatch("close", { code, reason, wasClean: true });
  });
  constructor(url: string) {
    this.url = url;
    sockets.push(this);
  }
  addEventListener(type: string, cb: Listener) {
    (this.listeners[type] ||= []).push(cb);
  }
  removeEventListener(type: string, cb: Listener) {
    this.listeners[type] = (this.listeners[type] || []).filter((l) => l !== cb);
  }
  dispatchEvent() {
    return true;
  }
  dispatch(type: string, ev: unknown) {
    (this.listeners[type] || []).forEach((l) => l(ev));
  }
  fireOpen() {
    this.readyState = FakeWebSocket.OPEN;
    this.dispatch("open", {});
  }
  fireMessage(data: unknown) {
    this.dispatch("message", { data });
  }
  // Mirror real WebSocket semantics: readyState flips to CLOSED before onclose.
  fireClose(code: number, reason: string) {
    this.readyState = FakeWebSocket.CLOSED;
    this.dispatch("close", { code, reason, wasClean: true });
  }
}

// --- visibility plumbing ----------------------------------------------------
class FakeIntersectionObserver {
  cb: (entries: Array<{ isIntersecting: boolean }>) => void;
  constructor(cb: (entries: Array<{ isIntersecting: boolean }>) => void) {
    this.cb = cb;
  }
  observe() {
    this.cb([{ isIntersecting: true }]);
  }
  unobserve() {}
  disconnect() {}
}

let visibility = "visible";
function setVisibility(v: string) {
  visibility = v;
  document.dispatchEvent(new Event("visibilitychange"));
}

const flush = () =>
  act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

beforeEach(() => {
  sockets = [];
  visibility = "visible";
  sessionStorage.clear();
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => visibility,
  });
  vi.stubGlobal("WebSocket", FakeWebSocket);
  vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

async function renderConnected(sessionId: string) {
  await act(async () => {
    render(
      <AblyCliTerminal
        websocketUrl={WS_URL}
        signedConfig={SIGNED_CONFIG}
        signature={SIGNATURE}
        resumeOnReload
        inactivityTimeoutMs={INACTIVITY_MS}
      />,
    );
  });
  await flush();
  // First socket should have been created while visible.
  expect(sockets.length).toBe(1);
  const ws = sockets[0];
  await act(async () => {
    ws.fireOpen();
  });
  await flush();
  // Server sends hello with a sessionId -> client stores it.
  await act(async () => {
    ws.fireMessage(createControlMessage({ type: "hello", sessionId }));
  });
  await flush();
  return ws;
}

describe("DX-1379: inactivity pause & resume-on-return", () => {
  test("pause on background preserves the session (no purge) and closes with 4900", async () => {
    const ws = await renderConnected("sess-1");
    expect(sessionStorage.getItem(`ably.cli.sessionId.${URL_HOST}`)).toBe(
      "sess-1",
    );

    // Background the tab.
    await act(async () => {
      setVisibility("hidden");
    });
    await flush();

    // Cross the (short) inactivity threshold.
    await act(async () => {
      vi.advanceTimersByTime(INACTIVITY_MS + 10);
    });
    await flush();

    // Private 4900 pause code, distinct from the server's 4002 "resume rejected".
    const inactivityClose = ws.close.mock.calls.find(
      ([code, reason]) => code === 4900 && reason === "inactivity-timeout",
    );
    expect(inactivityClose).toBeTruthy();

    // Session is PRESERVED for resume — not purged.
    expect(sessionStorage.getItem(`ably.cli.sessionId.${URL_HOST}`)).toBe(
      "sess-1",
    );
  });

  test("a brief background blip (returns before the timeout) does not pause", async () => {
    const ws = await renderConnected("sess-blip");

    await act(async () => {
      setVisibility("hidden");
    });
    await flush();
    // Return before the threshold — the inactivity timer should be cancelled.
    await act(async () => {
      vi.advanceTimersByTime(INACTIVITY_MS / 2);
    });
    await act(async () => {
      setVisibility("visible");
    });
    await flush();
    // Now run well past the original threshold.
    await act(async () => {
      vi.advanceTimersByTime(INACTIVITY_MS * 2);
    });
    await flush();

    // No pause close, socket still open, no extra sockets opened.
    expect(ws.close.mock.calls.some(([code]) => code === 4900)).toBe(false);
    expect(ws.readyState).toBe(FakeWebSocket.OPEN);
    expect(sockets.length).toBe(1);
  });

  test("honours a custom inactivityTimeoutMs (not the 5-minute default)", async () => {
    const CUSTOM = 300;
    await act(async () => {
      render(
        <AblyCliTerminal
          websocketUrl={WS_URL}
          signedConfig={SIGNED_CONFIG}
          signature={SIGNATURE}
          resumeOnReload
          inactivityTimeoutMs={CUSTOM}
        />,
      );
    });
    await flush();
    const ws = sockets[0];
    await act(async () => {
      ws.fireOpen();
    });
    await flush();

    await act(async () => {
      setVisibility("hidden");
    });
    await flush();
    // Before the custom threshold: no pause.
    await act(async () => {
      vi.advanceTimersByTime(CUSTOM - 50);
    });
    expect(ws.close.mock.calls.some(([code]) => code === 4900)).toBe(false);
    // After it: paused.
    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    await flush();
    expect(ws.close.mock.calls.some(([code]) => code === 4900)).toBe(true);
  });

  test("a token-expiry (4008) during a resume is surfaced, not swallowed as a failed resume", async () => {
    await renderConnected("sess-4008");

    await act(async () => {
      setVisibility("hidden");
    });
    await flush();
    await act(async () => {
      vi.advanceTimersByTime(INACTIVITY_MS + 10);
    });
    await flush();

    const socketsAfterPause = sockets.length;
    await act(async () => {
      setVisibility("visible");
    });
    await flush();
    await act(async () => {
      vi.advanceTimersByTime(50);
    });
    await flush();

    const resumeSocket = sockets[socketsAfterPause];
    const socketsBeforeClose = sockets.length;
    await act(async () => {
      resumeSocket.fireOpen();
    });
    await flush();
    // Server rejects with token-expired (NOT the 4002 resume-rejected code).
    await act(async () => {
      resumeSocket.fireClose(4008, "token expired");
    });
    await flush();
    await act(async () => {
      vi.advanceTimersByTime(50);
    });
    await flush();

    // The session is purged (4008 is non-recoverable) and — crucially — we do
    // NOT silently spin up a fresh session (that would hide the token error and
    // loop against the same expired token).
    expect(sessionStorage.getItem(`ably.cli.sessionId.${URL_HOST}`)).toBeNull();
    expect(sockets.length).toBe(socketsBeforeClose);
  });

  test("returning to the tab resumes the session (reconnect carries the sessionId)", async () => {
    const ws = await renderConnected("sess-2");

    await act(async () => {
      setVisibility("hidden");
    });
    await flush();
    await act(async () => {
      vi.advanceTimersByTime(INACTIVITY_MS + 10);
    });
    await flush();
    expect(ws.readyState).toBe(FakeWebSocket.CLOSED);

    const socketsAfterPause = sockets.length;

    // Foreground the tab -> auto-resume.
    await act(async () => {
      setVisibility("visible");
    });
    await flush();
    await act(async () => {
      vi.advanceTimersByTime(50); // resume uses a 20ms micro-delay
    });
    await flush();

    // A fresh socket was opened to resume.
    expect(sockets.length).toBe(socketsAfterPause + 1);
    const resumeSocket = sockets[socketsAfterPause];

    await act(async () => {
      resumeSocket.fireOpen();
    });
    await flush();

    // The auth payload sent on (re)open carries the preserved sessionId.
    const authSend = resumeSocket.send.mock.calls
      .map(([raw]) => {
        try {
          return JSON.parse(raw as string);
        } catch {
          return null;
        }
      })
      .find((p) => p && p.sessionId);
    expect(authSend?.sessionId).toBe("sess-2");
  });

  test("a rejected resume falls back to a fresh session", async () => {
    await renderConnected("sess-3");

    await act(async () => {
      setVisibility("hidden");
    });
    await flush();
    await act(async () => {
      vi.advanceTimersByTime(INACTIVITY_MS + 10);
    });
    await flush();

    await act(async () => {
      setVisibility("visible");
    });
    await flush();
    const socketsAfterPause = sockets.length;

    await act(async () => {
      vi.advanceTimersByTime(50);
    });
    await flush();

    const resumeSocket = sockets[socketsAfterPause];
    const socketsBeforeReject = sockets.length;

    // Server rejects the resume (session was reaped): close with 4002 but NOT
    // our "inactivity-timeout" reason.
    await act(async () => {
      resumeSocket.fireOpen();
    });
    await flush();
    await act(async () => {
      resumeSocket.fireClose(4002, "session resume rejected");
    });
    await flush();
    await act(async () => {
      vi.advanceTimersByTime(50);
    });
    await flush();

    // The stale session is purged and a brand-new session is started.
    expect(sessionStorage.getItem(`ably.cli.sessionId.${URL_HOST}`)).toBeNull();
    expect(sockets.length).toBe(socketsBeforeReject + 1);
    const freshSocket = sockets[socketsBeforeReject];
    await act(async () => {
      freshSocket.fireOpen();
    });
    await flush();
    const freshAuth = freshSocket.send.mock.calls
      .map(([raw]) => {
        try {
          return JSON.parse(raw as string);
        } catch {
          return null;
        }
      })
      .find(Boolean);
    // Fresh session: no sessionId in the auth payload.
    expect(freshAuth?.sessionId).toBeUndefined();
  });

  test("resume uses freshly-refreshed credentials for the handshake", async () => {
    const freshConfig = JSON.stringify({
      apiKey: "app.key:fresh",
      accessToken: "fresh-tok",
      timestamp: 2,
    });
    const refreshCredentials = vi
      .fn()
      .mockResolvedValue({ signedConfig: freshConfig, signature: "fresh-sig" });

    await act(async () => {
      render(
        <AblyCliTerminal
          websocketUrl={WS_URL}
          signedConfig={SIGNED_CONFIG}
          signature={SIGNATURE}
          resumeOnReload
          inactivityTimeoutMs={INACTIVITY_MS}
          refreshCredentials={refreshCredentials}
        />,
      );
    });
    await flush();
    const ws = sockets[0];
    await act(async () => {
      ws.fireOpen();
    });
    await flush();
    await act(async () => {
      ws.fireMessage(
        createControlMessage({ type: "hello", sessionId: "sess-4" }),
      );
    });
    await flush();

    await act(async () => {
      setVisibility("hidden");
    });
    await flush();
    await act(async () => {
      vi.advanceTimersByTime(INACTIVITY_MS + 10);
    });
    await flush();

    const socketsAfterPause = sockets.length;
    await act(async () => {
      setVisibility("visible");
    });
    await flush();
    await act(async () => {
      vi.advanceTimersByTime(50);
    });
    await flush();

    const resumeSocket = sockets[socketsAfterPause];
    await act(async () => {
      resumeSocket.fireOpen();
    });
    await flush();

    expect(refreshCredentials).toHaveBeenCalled();
    const authSend = resumeSocket.send.mock.calls
      .map(([raw]) => {
        try {
          return JSON.parse(raw as string);
        } catch {
          return null;
        }
      })
      .find((p) => p && p.config);
    // The handshake carries the refreshed signed config, not the stale prop.
    expect(authSend?.config).toBe(freshConfig);
    expect(authSend?.signature).toBe("fresh-sig");
    expect(authSend?.sessionId).toBe("sess-4");
  });

  test.each([
    ["returns null", vi.fn().mockResolvedValue(null)],
    ["throws", vi.fn().mockRejectedValue(new Error("offline"))],
  ])(
    "falls back to the prop credentials when refreshCredentials %s",
    async (_label, refreshCredentials) => {
      await act(async () => {
        render(
          <AblyCliTerminal
            websocketUrl={WS_URL}
            signedConfig={SIGNED_CONFIG}
            signature={SIGNATURE}
            resumeOnReload
            inactivityTimeoutMs={INACTIVITY_MS}
            refreshCredentials={refreshCredentials}
          />,
        );
      });
      await flush();
      const ws = sockets[0];
      await act(async () => {
        ws.fireOpen();
      });
      await flush();

      expect(refreshCredentials).toHaveBeenCalled();
      const authSend = ws.send.mock.calls
        .map(([raw]) => {
          try {
            return JSON.parse(raw as string);
          } catch {
            return null;
          }
        })
        .find((p) => p && p.config);
      // Refresh produced nothing usable, so the handshake still goes out using
      // the static prop config rather than failing/hanging.
      expect(authSend?.config).toBe(SIGNED_CONFIG);
      expect(authSend?.signature).toBe(SIGNATURE);
    },
  );

  // The reporter's "stuck on Connecting/Reconnecting to Ably" symptom: a socket
  // that opens but never receives the server's hello. Before the await-hello
  // timeout this hung forever (the 30s connection timeout only covers the
  // pre-open CONNECTING phase). It must now be force-closed for retry. (DX-1379)
  const AWAIT_HELLO_MS = 12_000;

  test("a socket that opens but never receives hello is force-closed for retry (not left hanging)", async () => {
    await act(async () => {
      render(
        <AblyCliTerminal
          websocketUrl={WS_URL}
          signedConfig={SIGNED_CONFIG}
          signature={SIGNATURE}
          resumeOnReload
          inactivityTimeoutMs={INACTIVITY_MS}
          maxReconnectAttempts={15}
        />,
      );
    });
    await flush();
    const ws = sockets[0];
    await act(async () => {
      ws.fireOpen(); // opens, but the server stays silent (no hello)
    });
    await flush();

    // Just before the threshold: still waiting, not force-closed.
    await act(async () => {
      vi.advanceTimersByTime(AWAIT_HELLO_MS - 1000);
    });
    expect(
      ws.close.mock.calls.some(
        ([, reason]) => reason === "awaiting-hello-timeout",
      ),
    ).toBe(false);

    // Cross the await-hello threshold -> the silent socket is closed for retry.
    await act(async () => {
      vi.advanceTimersByTime(1500);
    });
    await flush();
    const helloTimeoutClose = ws.close.mock.calls.find(
      ([code, reason]) => code === 4901 && reason === "awaiting-hello-timeout",
    );
    expect(helloTimeoutClose).toBeTruthy();
  });

  test("a resumed socket that never receives hello is closed for retry (the stuck-reconnecting repro)", async () => {
    await renderConnected("sess-hang");

    await act(async () => {
      setVisibility("hidden");
    });
    await flush();
    await act(async () => {
      vi.advanceTimersByTime(INACTIVITY_MS + 10);
    });
    await flush();

    const afterPause = sockets.length;
    await act(async () => {
      setVisibility("visible");
    });
    await flush();
    await act(async () => {
      vi.advanceTimersByTime(50);
    });
    await flush();

    const resumeSocket = sockets[afterPause];
    await act(async () => {
      resumeSocket.fireOpen(); // resume socket opens; server never sends hello
    });
    await flush();

    // It must not hang: after the await-hello timeout the resume socket is closed.
    await act(async () => {
      vi.advanceTimersByTime(AWAIT_HELLO_MS + 500);
    });
    await flush();
    const helloTimeoutClose = resumeSocket.close.mock.calls.find(
      ([code, reason]) => code === 4901 && reason === "awaiting-hello-timeout",
    );
    expect(helloTimeoutClose).toBeTruthy();
  });

  test("a hello within the await-hello window keeps the connection (no spurious close)", async () => {
    await act(async () => {
      render(
        <AblyCliTerminal
          websocketUrl={WS_URL}
          signedConfig={SIGNED_CONFIG}
          signature={SIGNATURE}
          resumeOnReload
          inactivityTimeoutMs={INACTIVITY_MS}
        />,
      );
    });
    await flush();
    const ws = sockets[0];
    await act(async () => {
      ws.fireOpen();
    });
    await flush();
    // Server replies in time.
    await act(async () => {
      ws.fireMessage(
        createControlMessage({ type: "hello", sessionId: "sess-ok" }),
      );
    });
    await flush();

    // Advancing past the await-hello window must NOT close the live socket.
    await act(async () => {
      vi.advanceTimersByTime(AWAIT_HELLO_MS + 2000);
    });
    await flush();
    // The live socket is not closed and stays usable.
    expect(
      ws.close.mock.calls.some(
        ([, reason]) => reason === "awaiting-hello-timeout",
      ),
    ).toBe(false);
    expect(ws.readyState).toBe(FakeWebSocket.OPEN);
  });

  test("the await-hello close code (4901) routes to a reconnect, not a terminal disconnect", async () => {
    const ws = await renderConnected("sess-route");
    // Isolate the effect of the 4901 close from the initial-connect bookkeeping.
    vi.mocked(GlobalReconnect.increment).mockClear();
    vi.mocked(GlobalReconnect.scheduleReconnect).mockClear();

    // A 4901 close (what the await-hello timeout emits) must be treated as
    // recoverable: schedule a reconnect rather than purging the session.
    await act(async () => {
      ws.fireClose(4901, "awaiting-hello-timeout");
    });
    await flush();

    expect(GlobalReconnect.increment).toHaveBeenCalled();
    expect(GlobalReconnect.scheduleReconnect).toHaveBeenCalled();
    // Recoverable => the session is NOT purged.
    expect(sessionStorage.getItem(`ably.cli.sessionId.${URL_HOST}`)).toBe(
      "sess-route",
    );
  });
});
