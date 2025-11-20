import { ChatClient } from "@ably/chat";
import * as Ably from "ably";

import { AblyBaseCommand } from "./base-command.js";
import { BaseFlags } from "./types/cli.js";

export abstract class ChatBaseCommand extends AblyBaseCommand {
  protected _chatRealtimeClient: Ably.Realtime | null = null;
  private _chatClient: ChatClient | null = null;
  private _cleanupTimeout: NodeJS.Timeout | undefined

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
          this.logCliEvent({}, "rooms", "cleanupTimeout", "Cleanup timed out after 5s, forcing completion");
          resolve();
        }, 5000);
      })
    ]);

    clearTimeout(this._cleanupTimeout)
    super.finally(error);
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
    
    const realtime = this._chatRealtimeClient;
    if (!realtime || realtime.connection.state === 'closed' || realtime.connection.state === 'failed') {
      return;
    }

    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        resolve();
      }, 2000);

      const onClosedOrFailed = () => {
        clearTimeout(timeout);
        resolve();
      };

      realtime.connection.once('closed', onClosedOrFailed);
      realtime.connection.once('failed', onClosedOrFailed);
      realtime.close();
    });
  }

  /**
   * Create a Chat client and associated resources
   */
  protected async createChatClient(
    flags: BaseFlags,
  ): Promise<ChatClient | null> {
    // We already have a client, return it
    if (this._chatClient) {
      return this._chatClient;
    }
    
    // Create Ably Realtime client first
    const realtimeClient = await this.createAblyRealtimeClient(flags);

    // Mark auth info as shown after creating the client
    // to prevent duplicate "Using..." output on subsequent calls
    this._authInfoShown = true;

    if (!realtimeClient) {
      return null;
    }

    // Store the realtime client for access by subclasses
    this._chatRealtimeClient = realtimeClient;

    // Use the Ably client to create the Chat client
    return this._chatClient = new ChatClient(realtimeClient);
  }
}
