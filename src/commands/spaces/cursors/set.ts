import type { CursorData, CursorPosition } from "@ably/spaces";
import { Args, Flags } from "@oclif/core";
import { errorMessage } from "../../../utils/errors.js";
import { productApiFlags, clientIdFlag, durationFlag } from "../../../flags.js";
import { SpacesBaseCommand } from "../../../spaces-base-command.js";
import { formatResource, formatLabel } from "../../../utils/output.js";

export default class SpacesCursorsSet extends SpacesBaseCommand {
  static override args = {
    spaceName: Args.string({
      description: "Name of the space to set cursor in",
      required: true,
    }),
  };

  static override description = "Set a cursor with position data in a space";

  static override examples = [
    "$ ably spaces cursors set my-space --x 100 --y 200",
    '$ ably spaces cursors set my-space --x 100 --y 200 --data \'{"name": "John", "color": "#ff0000"}\'',
    "$ ably spaces cursors set my-space --simulate",
    "$ ably spaces cursors set my-space --simulate --x 500 --y 500",
    '$ ably spaces cursors set my-space --data \'{"position": {"x": 100, "y": 200}}\'',
    '$ ably spaces cursors set my-space --data \'{"position": {"x": 100, "y": 200}, "data": {"name": "John", "color": "#ff0000"}}\'',
    '$ ABLY_API_KEY="YOUR_API_KEY" ably spaces cursors set my-space --x 100 --y 200',
    "$ ably spaces cursors set my-space --x 100 --y 200 --json",
    "$ ably spaces cursors set my-space --x 100 --y 200 --pretty-json",
  ];

  static override flags = {
    ...productApiFlags,
    ...clientIdFlag,
    data: Flags.string({
      description: "The cursor data to set (as JSON string)",
      required: false,
    }),
    x: Flags.integer({
      description: "The x coordinate for cursor position",
      required: false,
    }),
    y: Flags.integer({
      description: "The y coordinate for cursor position",
      required: false,
    }),
    simulate: Flags.boolean({
      description: "Simulate cursor movement every 250ms with random positions",
      required: false,
    }),
    ...durationFlag,
  };

  private simulationIntervalId: NodeJS.Timeout | null = null;

  async finally(err: Error | undefined): Promise<void> {
    if (this.simulationIntervalId) {
      clearInterval(this.simulationIntervalId);
      this.simulationIntervalId = null;
    }

    return super.finally(err);
  }

  async run(): Promise<void> {
    const { args, flags } = await this.parse(SpacesCursorsSet);
    const { spaceName } = args;

    try {
      // Validate and parse cursor data - either x/y flags or --data JSON
      let cursorData: Record<string, unknown>;

      if (flags.simulate) {
        const startX = flags.x ?? Math.floor(Math.random() * 1000);
        const startY = flags.y ?? Math.floor(Math.random() * 1000);
        cursorData = {
          position: { x: startX, y: startY },
        };

        if (flags.data) {
          try {
            const additionalData = JSON.parse(flags.data) as Record<
              string,
              unknown
            >;
            cursorData.data = additionalData;
          } catch {
            this.fail(
              'Invalid JSON in --data flag. Expected format: {"name":"value",...}',
              flags,
              "cursorSet",
              { spaceName },
            );
          }
        }
      } else if (flags.x !== undefined && flags.y !== undefined) {
        cursorData = {
          position: { x: flags.x, y: flags.y },
        };

        if (flags.data) {
          try {
            const additionalData = JSON.parse(flags.data) as Record<
              string,
              unknown
            >;
            cursorData.data = additionalData;
          } catch {
            this.fail(
              'Invalid JSON in --data flag when used with --x and --y. Expected format: {"name":"value",...}',
              flags,
              "cursorSet",
              { spaceName },
            );
          }
        }
      } else if (flags.data) {
        try {
          cursorData = JSON.parse(flags.data) as Record<string, unknown>;
        } catch {
          this.fail(
            'Invalid JSON in --data flag. Expected format: {"position":{"x":number,"y":number},"data":{...}}',
            flags,
            "cursorSet",
            { spaceName },
          );
        }

        if (
          !cursorData.position ||
          typeof (cursorData.position as Record<string, unknown>).x !==
            "number" ||
          typeof (cursorData.position as Record<string, unknown>).y !== "number"
        ) {
          this.fail(
            'Invalid cursor position in --data. Expected format: {"position":{"x":number,"y":number}}',
            flags,
            "cursorSet",
            { spaceName },
          );
        }
      } else {
        this.fail(
          "Cursor position is required. Use either --x and --y flags, --data flag with position, or --simulate for random movement.",
          flags,
          "cursorSet",
          { spaceName },
        );
      }

      this.logProgress("Entering space", flags);

      await this.initializeSpace(flags, spaceName, { enterSpace: false });

      await this.enterCurrentSpace(flags);

      const { position, data } = cursorData as {
        position: CursorPosition;
        data?: CursorData;
      };

      const cursorForOutput = { position, ...(data ? { data } : {}) };

      // Workaround for known SDK issue: cursors.set() fails if the underlying ::$cursors channel is not attached
      await this.waitForCursorsChannelAttachment(flags);

      // Set cursor position
      await this.space!.cursors.set(cursorForOutput);

      this.logCliEvent(
        flags,
        "cursor",
        "set",
        "Successfully set cursor position",
      );

      if (this.shouldOutputJson(flags)) {
        this.logJsonResult(
          {
            cursor: {
              clientId: this.realtimeClient!.auth.clientId,
              connectionId: this.realtimeClient!.connection.id,
              position,
              data: data ?? null,
            },
          },
          flags,
        );
      } else {
        this.logSuccessMessage(
          `Set cursor in space ${formatResource(spaceName)}.`,
          flags,
        );
        const lines: string[] = [
          `${formatLabel("Position X")} ${position.x}`,
          `${formatLabel("Position Y")} ${position.y}`,
        ];
        if (data) {
          lines.push(`${formatLabel("Data")} ${JSON.stringify(data)}`);
        }
        this.log(lines.join("\n"));
      }

      // In simulate mode, keep running with periodic cursor updates
      if (flags.simulate) {
        this.logCliEvent(
          flags,
          "cursor",
          "simulationStarted",
          "Starting cursor movement simulation",
        );

        this.logProgress(
          "Starting cursor movement simulation every 250ms",
          flags,
        );

        this.simulationIntervalId = setInterval(() => {
          void (async () => {
            try {
              const simulatedX = Math.floor(Math.random() * 1000);
              const simulatedY = Math.floor(Math.random() * 800);

              const simulatedCursor = {
                position: { x: simulatedX, y: simulatedY },
                ...(cursorData.data
                  ? { data: cursorData.data as CursorData }
                  : {}),
              };

              await this.space!.cursors.set(simulatedCursor);

              this.logCliEvent(
                flags,
                "cursor",
                "simulationUpdate",
                "Simulated cursor position update",
                { position: { x: simulatedX, y: simulatedY } },
              );

              if (this.shouldOutputJson(flags)) {
                this.logJsonEvent(
                  {
                    cursor: {
                      clientId: this.realtimeClient!.auth.clientId,
                      connectionId: this.realtimeClient!.connection.id,
                      position: { x: simulatedX, y: simulatedY },
                      data: (cursorData.data as CursorData | undefined) ?? null,
                    },
                  },
                  flags,
                );
              } else {
                const simLines = [
                  `${formatLabel("Simulated")} cursor at (${simulatedX}, ${simulatedY})`,
                ];
                if (cursorData.data) {
                  simLines.push(
                    `  ${formatLabel("Data")} ${JSON.stringify(cursorData.data)}`,
                  );
                }
                this.log(simLines.join("\n"));
              }
            } catch (error) {
              this.logCliEvent(
                flags,
                "cursor",
                "simulationError",
                `Simulation error: ${errorMessage(error)}`,
              );
            }
          })();
        }, 250);
      }

      // Hold in both simulate and non-simulate modes
      this.logHolding(
        flags.simulate
          ? "Simulating cursor movement. Press Ctrl+C to exit."
          : "Holding cursor. Press Ctrl+C to exit.",
        flags,
      );

      await this.waitAndTrackCleanup(flags, "cursor", flags.duration);
    } catch (error) {
      this.fail(error, flags, "cursorSet", { spaceName });
    }
  }
}
