import type * as Ably from "ably";
import { ChatClient, LogLevel, Room, RoomStatus } from "@ably/chat";

import { AblyBaseCommand } from "./base-command.js";
import { productApiFlags } from "./flags.js";
import { BaseFlags } from "./types/cli.js";

import {
  formatSuccess,
  formatListening,
  formatWarning,
} from "./utils/output.js";
import isTestMode from "./utils/test-mode.js";

export abstract class ChatBaseCommand extends AblyBaseCommand {
  static globalFlags = { ...productApiFlags };
  private _chatClient: ChatClient | null = null;
  private _cleanupTimeout: NodeJS.Timeout | undefined;

  protected validateRoomName(
    args: Record<string, unknown>,
    flags: BaseFlags,
    argv?: string[],
  ): void {
    const name = (args.room ?? args.rooms ?? "") as string;
    if (!name.trim()) {
      this.fail("Room name cannot be empty", flags, "parse");
    }

    if (argv) {
      if (argv.length === 0) {
        this.fail(
          "At least one room name is required",
          flags,
          "roomMessageSubscribe",
        );
      }

      for (const n of argv) {
        if (!n.trim()) {
          this.fail("Room name cannot be empty", flags, "parse");
        }
      }
    }
  }

  /**
   * finally disposes of the chat client, if there is one, which includes cleaning up any subscriptions.
   *
   * It also disposes of the realtime client.
   */
  async finally(error: Error | undefined): Promise<void> {
    await Promise.race([
      this._cleanup(),
      new Promise<void>((resolve) => {
        this._cleanupTimeout = setTimeout(() => {
          this.logCliEvent(
            {},
            "rooms",
            "cleanupTimeout",
            "Cleanup timed out after 5s, forcing completion",
          );
          resolve();
        }, 5000);
      }),
    ]);

    clearTimeout(this._cleanupTimeout);
    await super.finally(error);
  }

  private async _cleanup() {
    // Dispose of the chat client
    if (this._chatClient) {
      try {
        await this._chatClient.dispose();
      } catch {
        // no-op
      }
    }
  }

  /**
   * Create a Chat client and associated resources
   */
  protected async createChatClient(
    flags: BaseFlags,
    options?: { restOnly?: boolean },
  ): Promise<ChatClient | null> {
    // We already have a client, return it
    if (this._chatClient) {
      return this._chatClient;
    }

    // Create Ably Realtime client first
    // When restOnly is true, skip auto-connect to avoid opening a WebSocket
    // for commands that only use REST API methods (send, delete, update, history, etc.)
    const realtimeClient = await this.createAblyRealtimeClient(flags, {
      autoConnect: options?.restOnly ? false : undefined,
    });

    // Mark auth info as shown after creating the client
    // to prevent duplicate "Using..." output on subsequent calls
    this._authInfoShown = true;

    if (!realtimeClient) {
      return null;
    }

    if (isTestMode()) {
      this.debug(`Running in test mode, using mock Ably Chat client`);
      const mockChat = this.getMockAblyChat();

      if (mockChat) {
        // Return mock as appropriate type
        this._chatClient = mockChat;
        return mockChat;
      }

      this.fail(
        "No mock Ably Chat client available in test mode",
        flags,
        "client",
      );
    }

    // Use the Ably client to create the Chat client.
    // Suppress Chat SDK's console logger by default; enable it when --verbose is active
    // so that additional diagnostic output is available on demand.
    const chatOptions = flags.verbose
      ? { logLevel: LogLevel.Info }
      : { logLevel: LogLevel.Silent };
    return (this._chatClient = new ChatClient(realtimeClient, chatOptions));
  }

  protected setupRoomStatusHandler(
    room: Room,
    flags: Record<string, unknown>,
    options: {
      roomName: string;
      successMessage?: string;
      listeningMessage?: string;
    },
  ): void {
    room.onStatusChange((statusChange) => {
      let reason: Error | null | string | undefined;
      if (statusChange.current === RoomStatus.Failed) {
        reason = room.error;
      }
      const reasonMsg = reason instanceof Error ? reason.message : reason;
      this.logCliEvent(
        flags,
        "room",
        `status-${statusChange.current}`,
        `Room status changed to ${statusChange.current}`,
        { reason: reasonMsg, room: options.roomName },
      );
      switch (statusChange.current) {
        case RoomStatus.Attached: {
          if (!this.shouldOutputJson(flags)) {
            if (options.successMessage) {
              this.log(formatSuccess(options.successMessage));
            }
            if (options.listeningMessage) {
              this.log(formatListening(options.listeningMessage));
            }
          }
          break;
        }
        case RoomStatus.Detached: {
          if (!this.shouldOutputJson(flags)) {
            this.log(formatWarning("Disconnected from Ably"));
          }
          break;
        }
        case RoomStatus.Failed: {
          this.fail(
            `Failed to attach to room ${options.roomName}: ${reasonMsg || "Unknown error"}`,
            flags as BaseFlags,
            "room",
          );
        }
        // No default
      }
    });
  }
}
