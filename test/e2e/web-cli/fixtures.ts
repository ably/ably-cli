/* eslint-disable no-empty-pattern */
import { test as base } from "playwright/test";
export { expect } from "playwright/test";
import type { ChildProcess } from "node:child_process";
import { startWebServer, stopWebServer } from "./reconnection-utils";

// How many ports we reserve per worker. We keep a gap of 100 to avoid any accidental overlap
// with user-run instances of the terminal server on common dev ports.
const PORT_BLOCK_SIZE = 100;
const PORT_BLOCK_START = 48000;

// Playwright fixture tuples need to be cast to satisfy the extend() overload.
// Using `as const` preserves the tuple literal, and `as unknown as void` bypasses
// the structural mismatch between readonly tuples and Playwright's mutable fixture type.
type FixtureTuple<T> = readonly [
  (
    args: Record<string, unknown>,
    use: (value: T) => Promise<void>,
    workerInfo?: { parallelIndex: number },
  ) => Promise<void>,
  { scope: "worker" },
];

export const test = base.extend<{
  webPort: number;
  termPort: number;
  webServerProcess: ChildProcess | null;
  terminalServerProcess: ChildProcess | null;
}>({
  // Unique terminal-server port for this worker
  termPort: [
    async ({}, use, workerInfo) => {
      const port =
        PORT_BLOCK_START + workerInfo.parallelIndex * PORT_BLOCK_SIZE;
      await use(port);
    },
    { scope: "worker" },
  ] as unknown as FixtureTuple<number>,

  // Unique web-server port for this worker (just +1)
  webPort: [
    async ({ termPort }, use) => {
      await use(termPort + 1);
    },
    { scope: "worker" },
  ] as unknown as FixtureTuple<number>,

  // Terminal server lifecycle (started lazily – some specs want to begin with the server down)
  terminalServerProcess: [
    async ({}, use) => {
      // Provide null by default – tests can start/stop it as needed
      await use(null);
    },
    { scope: "worker" },
  ] as unknown as FixtureTuple<ChildProcess | null>,

  // Vite preview web-server lifecycle (eagerly started – every spec needs the example app)
  webServerProcess: [
    async ({ webPort }, use) => {
      const proc = await startWebServer(webPort);
      await use(proc);
      await stopWebServer(proc);
    },
    { scope: "worker" },
  ] as unknown as FixtureTuple<ChildProcess | null>,
});
