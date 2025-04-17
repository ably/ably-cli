import { WebSocketServer, WebSocket } from 'ws';
import { createWebSocketStream } from 'ws';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Docker from 'dockerode';
import stream, { Duplex } from 'node:stream';
import crypto from 'node:crypto';

// Replicate __dirname behavior in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Configuration ---
const DOCKER_IMAGE_NAME = 'ably-cli-sandbox';
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const DEFAULT_PORT = 8080;
const DEFAULT_MAX_SESSIONS = 5;
const AUTH_TIMEOUT_MS = 10_000; // 10 seconds
const SHUTDOWN_GRACE_PERIOD_MS = 10_000; // 10 seconds

// Type definition for auth timeout reference
let _AuthTimeoutRef: NodeJS.Timeout | null = null;

type ClientSession = {
  ws: WebSocket;
  authenticated: boolean;
  timeoutId: NodeJS.Timeout;
  container?: Docker.Container;
  execInstance?: Docker.Exec;
  stdinStream?: stream.Duplex;
  stdoutStream?: stream.Duplex;
  sessionId: string;
};

const sessions = new Map<string, ClientSession>();
const docker = new Docker();

function log(message: string): void {
    console.log(`[TerminalServer] ${message}`);
}

function logError(message: unknown): void {
    console.error(`[TerminalServerError] ${message instanceof Error ? message.message : String(message)}`);
    if (message instanceof Error && message.stack) {
        console.error(message.stack);
    }
}

// Function to clean up stale containers on startup
async function cleanupStaleContainers(): Promise<void> {
    log('Checking for stale containers managed by this server...');
    try {
        const containers = await docker.listContainers({
            all: true, // List all containers (running and stopped)
            filters: JSON.stringify({
                label: ['managed-by=ably-cli-terminal-server']
            })
        });

        if (containers.length === 0) {
            log('No stale containers found.');
            return;
        }

        log(`Found ${containers.length} stale container(s). Attempting removal...`);
        const removalPromises = containers.map(async (containerInfo) => {
            try {
                const container = docker.getContainer(containerInfo.Id);
                log(`Removing stale container ${containerInfo.Id}...`);
                await container.remove({ force: true }); // Force remove
                log(`Removed stale container ${containerInfo.Id}.`);
            } catch (removeError: any) {
                // Ignore "no such container" errors, it might have been removed already
                if (!(removeError instanceof Error && /no such container/i.test(removeError.message))) {
                     logError(`Failed to remove stale container ${containerInfo.Id}: ${removeError.message || removeError}`);
                }
            }
        });

        await Promise.allSettled(removalPromises);
        log('Stale container cleanup finished.');

    } catch (error: any) {
        logError(`Error during stale container cleanup: ${error.message || error}`);
        // Continue starting the server even if cleanup fails
    }
}

async function ensureDockerImage(): Promise<void> {
    log(`Ensuring Docker image ${DOCKER_IMAGE_NAME} exists...`);
    try {
        const images = await docker.listImages({ filters: { reference: [DOCKER_IMAGE_NAME] } });
        if (images.length === 0) {
            log(`Image ${DOCKER_IMAGE_NAME} not found.`);
            // Assume Dockerfile is in the root, two levels up from scripts/
            const dockerfilePath = path.resolve(__dirname, '../../', 'Dockerfile');
            log(`Attempting to build Docker image from ${dockerfilePath}...`);
            // Note: Building via SDK requires careful stream handling for output
            // This is a simplified example; a real implementation needs better error/output handling.
             try {
                 const stream = await docker.buildImage({ context: path.resolve(__dirname, '../../'), src: ['Dockerfile'] }, { t: DOCKER_IMAGE_NAME });
                 await new Promise((resolve, reject) => {
                     docker.modem.followProgress(stream, (err, res) => err ? reject(err) : resolve(res), (event) => {
                         if (event.stream) process.stdout.write(event.stream); // Log build output
                         if (event.errorDetail) logError(event.errorDetail.message);
                     });
                 });
                 log(`Docker image ${DOCKER_IMAGE_NAME} built successfully.`);
             } catch (buildError) {
                 logError(`Failed to build Docker image ${DOCKER_IMAGE_NAME}: ${buildError}`);
                 throw new Error(`Failed to automatically build Docker image "${DOCKER_IMAGE_NAME}". Please build it manually using "docker build -t ${DOCKER_IMAGE_NAME} ." in the project root.`);
             }
        } else {
            log(`Docker image ${DOCKER_IMAGE_NAME} found.`);
        }
    } catch (error) {
        logError(`Error checking/building Docker image: ${error}`);
        if (error instanceof Error && error.message.includes('Cannot connect to the Docker daemon')) {
            throw new Error('Failed to connect to Docker. Is the Docker daemon running and accessible?');
        }

        throw error;
    }
}

async function createContainer(
    apiKey: string, 
    accessToken: string, 
    environmentVariables: Record<string, string> = {}
): Promise<Docker.Container> {
    log('Creating Docker container (TTY Mode)...');
    try {
        // Create base environment variables with better defaults for terminal behavior
        const env = [
            // These environment variables are critical for proper terminal behavior
            'TERM=xterm-256color', 
            'COLORTERM=truecolor',
            'LANG=en_US.UTF-8',
            'LC_ALL=en_US.UTF-8',
            'LC_CTYPE=en_US.UTF-8',
            'CLICOLOR=1',
            `ABLY_API_KEY=${apiKey}`,
            `ABLY_ACCESS_TOKEN=${accessToken}`,
            // Simple PS1 prompt at container level
            'PS1=$ ',
            // Enable history with reasonable defaults
            'HISTSIZE=1000',
            'HISTFILE=/home/appuser/.bash_history'
        ];
        
        // Add any custom environment variables
        for (const [key, value] of Object.entries(environmentVariables)) {
            // Don't duplicate variables that are already set
            if (!env.some(e => e.startsWith(`${key}=`))) {
                env.push(`${key}=${value}`);
            }
        }
        
        const container = await docker.createContainer({
            AttachStderr: true,
            AttachStdin: true,
            AttachStdout: true,
            Env: env,
            HostConfig: {
                AutoRemove: true,
                CapDrop: ['ALL'],
                SecurityOpt: ['no-new-privileges'],
            },
            Image: DOCKER_IMAGE_NAME,
            Labels: { // Add label for cleanup
                'managed-by': 'ably-cli-terminal-server'
            },
            OpenStdin: true,
            StdinOnce: false,
            StopSignal: 'SIGTERM',
            StopTimeout: 5,
            Tty: true,          // Enable TTY mode
            // Don't override the container's default CMD
            // This will ensure the restricted-shell.sh is used as defined in the Dockerfile
        });
        log(`Container ${container.id} created.`);
        return container;
    } catch (error) {
        logError(`Error creating container: ${error}`);
        throw error;
    }
}

// --- Session Management Functions (Restored & Modified) ---

function generateSessionId(): string {
    return crypto.randomUUID();
}

function isValidToken(token: string): boolean {
    log(`Placeholder token validation for: ${token.slice(0, 10)}...`);
    // Replace with actual token validation logic!
    return true; 
}

async function terminateSession(sessionId: string, reason: string): Promise<void> {
    log(`Terminating session ${sessionId} due to: ${reason}`);
    const session = sessions.get(sessionId);
    if (!session) {
        log(`Session ${sessionId} not found in map, likely already terminated.`);
        return;
    }

    log(`Terminating session ${sessionId}. Current session count: ${sessions.size}`);
    clearTimeout(session.timeoutId);
    sessions.delete(sessionId);
    log(`Session ${sessionId} deleted from map. New session count: ${sessions.size}`);

    // Send termination message before closing
    try {
        if (session.ws.readyState === WebSocket.OPEN) {
            session.ws.send(JSON.stringify({ reason, type: 'session_end' }));
        }
    } catch (sendError) {
        logError(`Error sending session_end message to ${sessionId}: ${sendError}`);
    }

    // Close WebSocket
    try {
        session.ws.close(1001, `Session terminated: ${reason}`.slice(0, 123));
    } catch (wsError) {
        logError(`Error closing WebSocket for session ${sessionId}: ${wsError}`);
    }

    // End the Exec Stream associated with the session
    if (session.stdinStream && !session.stdinStream.destroyed) {
        log(`Ending stdin stream for session ${sessionId}...`);
        session.stdinStream.end();
        session.stdinStream.destroy(); // Force destroy
    }

    // Stop the main Container (check session.container)
    if (session.container) {
        const container = session.container;
        try {
            log(`Stopping container ${container.id}...`);
            // Inspect might fail if already stopped/removed
            const containerInfo = await container.inspect().catch(() => null);
            if (containerInfo && (containerInfo.State.Running || containerInfo.State.Paused)) {
                await container.stop({ t: 2 }).catch(stopError => {
                    logError(`Error stopping container ${container.id}: ${stopError instanceof Error ? stopError.message : String(stopError)}`);
                });
                log(`Container ${container.id} stopped.`);
            } else {
                 log(`Container ${container.id} already stopped or removed.`);
            }
        } catch (dockerError) {
            // Ignore "no such container" errors as it might have auto-removed
            if (!(dockerError instanceof Error && /no such container/i.test(dockerError.message))) {
                logError(`Error during container stop/cleanup for session ${sessionId}: ${dockerError}`);
            }
        }
    } else {
        log(`No container associated with session ${sessionId} during termination.`);
    }

    log(`Session ${sessionId} resources released.`);
}

async function cleanupAllSessions(): Promise<void> {
    log('Cleaning up all active sessions...');
    const cleanupPromises = [...sessions.keys()].map(sessionId =>
        terminateSession(sessionId, 'Server shutting down.')
    );
    await Promise.allSettled(cleanupPromises);
    log('All session cleanup routines initiated.');
}

// --- Main Connection Handler using Exec --- 
async function _handleAuth(ws: WebSocket, req: any): Promise<boolean> {
    if (ws.readyState !== WebSocket.OPEN) {
        logError('WebSocket is not open during handleAuth.');
        return false;
    }

    let credentials: { accessToken?: string; apiKey?: string; environmentVariables?: Record<string, string>; type?: string } = {};
    try {
        credentials = JSON.parse(req.headers.authorization || '');
    } catch {
        logError('Failed to parse auth message');
        ws.send('Invalid authentication message format.\r\n');
        ws.close(1008, 'Invalid auth message');
        return false;
    }

    if (credentials.type !== 'auth' || !credentials.apiKey || !credentials.accessToken) {
        logError('Invalid auth message content');
        ws.send('Invalid authentication credentials provided.\r\n');
        ws.close(1008, 'Invalid credentials');
        return false;
    }

    log('Client authenticated. Creating container and exec process...');
    let container: Docker.Container | null = null;
    let sessionId: null | string = null;
    let execStream: Duplex | null = null;
    let sessionTerminated = false;
    const cleanupAndTerminate = async (reason: string) => {
        if (sessionTerminated) return;
        sessionTerminated = true;
        log(`Triggering session termination for ${sessionId} due to: ${reason}`);
        if (sessionId) {
            await terminateSession(sessionId, reason); 
        }

        // Ensure WS is closed if session termination didn't catch it
        if(ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
            ws.close(1011, reason);
        }
    };

    try {
        // 1. Create & Start Container
        container = await createContainer(credentials.apiKey!, credentials.accessToken!, credentials.environmentVariables || {}); 
        sessionId = container.id;
        await container.start();
        log(`Main container ${sessionId} started.`);

        // 2. Execute the restricted shell script directly via exec
        log(`Executing restricted shell in container ${sessionId}...`);
        const exec = await container.exec({
            AttachStderr: true, 
            AttachStdin: true,
            AttachStdout: true,
            // Explicitly run the restricted shell script
            Cmd: ['/bin/bash', '/scripts/restricted-shell.sh'],
            // Set critical environment variables FOR the restricted shell process
            Env: [
                'TERM=xterm-256color',
                'LANG=en_US.UTF-8',
                'LC_ALL=en_US.UTF-8',
                'LC_CTYPE=en_US.UTF-8',
                'CLICOLOR=1',
                'PS1=$ ' // Ensure prompt is set for this exec context
            ],
            Tty: true          // Use TTY for the exec process
        });
        const execAttachOptions = { hijack: true, stdin: true }; // Keep hijack: true
        execStream = await exec.start(execAttachOptions) as Duplex; 
        log(`Attached to exec stream for ${sessionId} (restricted shell).`);

        // Resize the PTY to a default size initially
        try {
            await exec.resize({ h: 24, w: 80 });
            log(`Resized exec PTY for ${sessionId} to default 80x24.`);
        } catch (resizeError) {
            logError(`[${sessionId}] Failed to resize PTY initially: ${resizeError}`);
            // Continue connection even if resize fails initially
        }

        // 3. Create WS Stream in RAW BINARY mode
        // Omit stream options entirely to get default Buffer behavior
        const websocketStream = createWebSocketStream(ws); 

        // Removed: , { decodeStrings: true } or other encoding options

        // 4. Store Session
        const timeoutId = setTimeout(() => cleanupAndTerminate('Session timed out.'), SESSION_TIMEOUT_MS);
        const fullSession: ClientSession = {
            ws,
            authenticated: true,
            timeoutId,
            container,
            execInstance: exec,
            stdinStream: execStream,
            stdoutStream: execStream,
            sessionId: sessionId,
        };
        sessions.set(sessionId, fullSession);
        log(`Session ${sessionId} created and stored.`);

        // 5. Manual Forwarding & Demultiplexing
        let processingBuffer = Buffer.alloc(0); // Buffer to handle partial stream frames
        execStream.on('data', (chunk: Buffer) => {
            processingBuffer = Buffer.concat([processingBuffer, chunk]);
            // --- DEBUGGING: Log incoming raw chunk and current buffer ---
            // log(`[DEBUG EXEC_CHUNK_RECV] Chunk(${chunk.length}): ${chunk.toString('hex')}`);
            // log(`[DEBUG EXEC_BUFFER_PRE] Buffer(${processingBuffer.length}): ${processingBuffer.toString('hex')}`);
            // --- END DEBUGGING ---

            while (processingBuffer.length >= 8) { // Need at least 8 bytes for the header
                const header = processingBuffer.slice(0, 8);
                const streamType = header[0]; // 1 for stdout, 2 for stderr
                const payloadSize = header.readUInt32BE(4); // Read size from bytes 4-7

                if (processingBuffer.length >= 8 + payloadSize) {
                    // We have the full frame (header + payload)
                    const payload = processingBuffer.slice(8, 8 + payloadSize);
                    // --- DEBUGGING: Log header, size, and extracted payload ---
                    // log(`[DEBUG DEMUX_FRAME] Header: ${header.toString('hex')}, Type: ${streamType}, Size: ${payloadSize}`);
                    // log(`[DEBUG DEMUX_PAYLOAD] Payload(${payload.length}): ${payload.toString('hex')}`);
                    // --- END DEBUGGING ---

                    // Only forward stdout (streamType 1) to the WebSocket for the terminal
                    if (streamType === 1) {
                        try {
                            if (!websocketStream.destroyed) {
                                // --- DEBUGGING: Log payload being written to websocketStream ---
                                // log(`[DEBUG WS_WRITE_DEMUXED] Buffer(${payload.length}): ${payload.toString('hex')}`);
                                // --- END DEBUGGING ---
                                websocketStream.write(payload);
                            }
                        } catch (error) {
                            const logSessionId = sessionId || 'unknown';
                            logError(`[${logSessionId}] WS stream write error after demux: ${error instanceof Error ? error.message : String(error)}`);
                            cleanupAndTerminate('WS stream write error');
                            return; // Stop processing if write fails
                        }
                    } else if (streamType === 2) {
                        // Optionally log stderr or handle it differently
                        // log(`[DEBUG DEMUX_STDERR] Payload(${payload.length}): ${payload.toString('utf-8')}`);
                    } else {
                        // log(`[DEBUG DEMUX_UNKNOWN] Unknown stream type: ${streamType}`);
                    }

                    // Remove the processed frame (header + payload) from the buffer
                    processingBuffer = processingBuffer.slice(8 + payloadSize);
                    // log(`[DEBUG EXEC_BUFFER_POST] Buffer(${processingBuffer.length}): ${processingBuffer.toString('hex')}`);

                } else {
                    // Not enough data in buffer for the full payload yet, break and wait for more data
                    // log(`[DEBUG DEMUX_WAIT] Need ${8 + payloadSize} bytes, have ${processingBuffer.length}. Waiting for more data.`);
                    break;
                }
            }
        });

        websocketStream.on('data', (chunk: Buffer | string) => {
            // Find the current session ID (assuming it's available in the closure)
            // NOTE: sessionId might be null briefly before session is fully stored.
            // It's safer to look up the session by the WebSocket instance if needed,
            // but for simplicity, we assume sessionId is correctly captured here.
            const currentSessionId = sessionId; 
            if (!currentSessionId) { 
                logError('Resize handler: Could not determine session ID.');
                return; 
            }

            try {
                let parsedMessage: any;
                let isResizeMessage = false;

                // Check if it's a resize message
                if (Buffer.isBuffer(chunk) || typeof chunk === 'string') {
                    try {
                        parsedMessage = JSON.parse(chunk.toString());
                        if (parsedMessage && parsedMessage.type === 'resize' && 
                            typeof parsedMessage.cols === 'number' && typeof parsedMessage.rows === 'number') 
                        {
                            isResizeMessage = true;
                        }
                    } catch {
                        // Not a JSON message, treat as regular data
                    }
                }

                if (isResizeMessage) {
                    const { cols, rows } = parsedMessage;
                    // Ensure cols and rows are positive integers
                    if (cols > 0 && rows > 0) {
                        log(`[${currentSessionId}] Received resize request: ${cols}x${rows}`);
                        // Find the session and its exec instance
                        const currentSession = sessions.get(currentSessionId);
                        if (currentSession && currentSession.execInstance) {
                            // Resize the *original* exec instance
                            currentSession.execInstance.resize({ h: rows, w: cols })
                                .catch(resizeError => {
                                    logError(`[${currentSessionId}] Failed to resize PTY on request: ${resizeError}`);
                                });
                        } else {
                            logError(`[${currentSessionId}] Could not find session or execInstance to resize PTY.`);
                        }
                    } else {
                        logError(`[${currentSessionId}] Received invalid dimensions in resize request: ${cols}x${rows}`);
                    }
                } else {
                    // Not a resize message, forward to the container
                    const currentSession = sessions.get(currentSessionId);
                    if (currentSession && currentSession.stdinStream && !currentSession.stdinStream.destroyed) {
                        currentSession.stdinStream.write(chunk);
                    } else {
                        // Log if forwarding fails (e.g., stream closed before message processed)
                        // Avoid terminating session here, let other handlers manage stream closure.
                        log(`[${currentSessionId}] Could not forward non-resize data, stream unavailable.`);
                    }
                }
            } catch (error) {
                 // Use the captured sessionId for consistent logging
                 logError(`[${currentSessionId}] Error processing incoming websocket data: ${error}`);
                 // Terminate the session on general processing errors within this handler
                 cleanupAndTerminate('WebSocket data processing error');
            }
        });
        
        // Error and Close handlers for BOTH streams
        execStream.on('error', (err: Error) => {
             logError(`[${sessionId}] Exec Stream Error: ${err.message}`);
             if (!websocketStream.destroyed) websocketStream.destroy(err);
             cleanupAndTerminate('Exec stream error.'); 
         });
        execStream.on('close', () => {
             log(`[${sessionId}] Exec Stream Closed.`);
             if (!websocketStream.destroyed) websocketStream.destroy();
             cleanupAndTerminate('Container process exited.');
        });
        websocketStream.on('error', (err: Error) => {
             logError(`[${sessionId}] WebSocket Stream Error: ${err.message}`);
             if (!execStream!.destroyed) execStream!.destroy(err);
             cleanupAndTerminate('WebSocket stream error.');
        });
        websocketStream.on('close', () => {
             log(`[${sessionId}] WebSocket Stream Closed (Client disconnected).`);
             if (!execStream!.destroyed) execStream!.destroy();
             cleanupAndTerminate('Client disconnected.');
        });

        log(`[${sessionId}] Manual forwarding established.`);

        // 6. Send confirmation
        ws.send('Authentication successful. Session established.\r\n');
        
        // 7. No explicit startup command needed here, handled by restricted-shell.sh welcome message

        // Attach to container
        await attachToContainer(fullSession, ws);

        log(`Session ${sessionId} authenticated and attached.`);

        return true;
    } catch (error) {
        logError(`Error during authentication for session ${sessionId}: ${error instanceof Error ? error.message : String(error)}`);
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
           ws.close(1011, 'Authentication failed');
        }
        // Add null check for sessionId before cleanup
        if (sessionId) cleanupSession(sessionId);
        return false;
    }
}

// --- WebSocket Server Setup (Restored & Modified) --- 
async function startServer() {
    const port = DEFAULT_PORT; // Simplified for now
    const maxSessions = DEFAULT_MAX_SESSIONS;
    log(`Starting Terminal Server on port ${port}, max sessions: ${maxSessions}...`);

    // Clean up stale containers before starting
    await cleanupStaleContainers();

    try {
        await ensureDockerImage();
    } catch (error) {
        logError(error);
         
        process.exit(1); // Keep necessary exit with disable comment
    }

    const wss = new WebSocketServer({ 
        // Add CORS support for the HTTP upgrade request
        handleProtocols(protocols, request) {
            return Array.isArray(protocols) && protocols.length > 0 ? protocols[0] : '';
        },
        port,
        verifyClient(info, callback) {
            // Get the origin from the request
            const origin = info.req.headers.origin || '*';
            log(`Client connecting from origin: ${origin} - allowing connection`);
            
            // Set CORS headers on the upgrade response
            if (info.req.headers.origin) {
                info.req.headers['Access-Control-Allow-Origin'] = '*';
                info.req.headers['Access-Control-Allow-Headers'] = 'Authorization, X-Requested-With, Content-Type';
                info.req.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
                info.req.headers['Access-Control-Allow-Credentials'] = 'true';
            }
            
            // Always allow the connection
            callback(true);
        }
    });

    // Handle HTTP OPTIONS requests (preflight) separately
    wss.on('headers', (headers, request) => {
        // Add CORS headers to all responses
        headers.push('Access-Control-Allow-Origin: *', 'Access-Control-Allow-Headers: Authorization, X-Requested-With, Content-Type', 'Access-Control-Allow-Methods: GET, POST, OPTIONS', 'Access-Control-Allow-Credentials: true');
    });

    wss.on('connection', async (ws: WebSocket, request) => {
        if (sessions.size >= maxSessions) {
            log('Max session limit reached. Rejecting new connection.');
            ws.send('Server busy. Please try again later.\r\n');
            ws.close(1013, 'Server busy');
            return;
        }

        const sessionId = generateSessionId();
        log(`Client connected. Assigning session ID: ${sessionId}. Waiting for authentication...`);

        // Use a ref object for the auth timeout ID
        const authTimeoutIdRef = { current: null as NodeJS.Timeout | null };

        // Create a minimal initial session state for tracking
        const initialSession: Partial<ClientSession> = {
             ws: ws,
             timeoutId: setTimeout(() => {
                 log(`Authentication timeout for session ${sessionId}.`);
                 // Ensure ws is still open before closing
                 if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
                     ws.close(4008, 'Authentication timeout');
                 }
                 cleanupSession(sessionId); // Cleanup based on ID
             }, AUTH_TIMEOUT_MS),
             sessionId: sessionId,
             authenticated: false,
        };
        authTimeoutIdRef.current = initialSession.timeoutId!; // Store the timeout ID

        // Store partial session - crucial for cleanup if auth fails
        sessions.set(sessionId, initialSession as ClientSession);

        // Handle the single authentication message
        ws.once('message', async (message) => {
            // --- Authentication Phase ---
            try {
                let authPayload: { apiKey?: string; accessToken?: string; environmentVariables?: Record<string, string> };
                try {
                    authPayload = JSON.parse(message.toString());
                } catch {
                    logError(`[${sessionId}] Failed to parse auth message JSON.`);
                     if (ws.readyState === WebSocket.OPEN) {
                        ws.send('Invalid auth message format.\r\n');
                        ws.close(4008, 'Invalid auth format');
                    }
                    if (sessionId) cleanupSession(sessionId);
                    return;
                }
                
                // Combine token validation (placeholder) and credential check
                if (!authPayload.apiKey || !authPayload.accessToken || !isValidToken(authPayload.accessToken)) { 
                    logError(`[${sessionId}] Invalid credentials or token received.`);
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send('Invalid token or credentials.\r\n');
                        ws.close(4001, 'Invalid token/credentials');
                    }
                    if (sessionId) cleanupSession(sessionId); // Cleanup partial session
                    return;
                }
                const { apiKey, accessToken, environmentVariables } = authPayload;

                // --- Auth Success -> Container Creation Phase ---
                log(`[${sessionId}] Authentication successful.`);
                clearTimeout(authTimeoutIdRef.current!); // Clear the auth timeout

                let container: Docker.Container;
                try {
                   // Pass credentials to createContainer
                   container = await createContainer(apiKey, accessToken, environmentVariables || {}); 
                   log(`[${sessionId}] Container created successfully: ${container.id}`);
                } catch (containerError) {
                    logError(`[${sessionId}] Failed to create container: ${containerError instanceof Error ? containerError.message : String(containerError)}`);
                    if (ws.readyState === WebSocket.OPEN) {
                       ws.send('Failed to create session environment.\r\n');
                       ws.close(1011, 'Container creation failed');
                    }
                    if (sessionId) cleanupSession(sessionId); // Cleanup partial session
                    return;
                }

                // --- Create Full Session Object ---
                const fullSession: ClientSession = {
                    ...(initialSession as ClientSession), // Spread initial properties (ws, sessionId)
                    authenticated: true,
                    timeoutId: setTimeout(() => {}, 0), // Dummy timeout, immediately cleared
                    container: container,
                    // execInstance, stdinStream, stdoutStream added by attachToContainer
                };
                clearTimeout(fullSession.timeoutId); // Clear the dummy timeout
                sessions.set(sessionId, fullSession); // Update session map with full data
                log(`[${sessionId}] Full session object created.`);

                // --- Attachment Phase ---
                await attachToContainer(fullSession, ws);
                log(`[${sessionId}] Successfully attached to container.`);

                // --- Set up Main Message Handler --- 
                // Only set this up *after* successful attachment
                ws.on('message', (msg) => handleMessage(fullSession, msg as Buffer));
                log(`[${sessionId}] Main message handler attached.`);

            } catch (error) {
                // Catch errors during the setup process (auth, container create, attach)
                logError(`[${sessionId}] Error during connection setup: ${error instanceof Error ? error.message : String(error)}`);
                 if (ws.readyState === WebSocket.OPEN) {
                     ws.send('Internal server error during setup.\r\n');
                     ws.close(1011, 'Setup error');
                 }
                 if (sessionId) cleanupSession(sessionId); // Cleanup whatever state exists
            }
        });

        // Handle top-level WebSocket close/error (covers cases before/during auth)
        ws.on('close', (code, reason) => {
            log(`[${sessionId}] WebSocket closed. Code: ${code}, Reason: ${reason.toString()}`);
            cleanupSession(sessionId);
        });
        ws.on('error', (err) => {
            logError(`[${sessionId}] WebSocket error: ${err.message}`);
            cleanupSession(sessionId); // Close and cleanup on error
        });
    });

    wss.on('error', (error: Error) => {
        logError(`WebSocket Server Error: ${error.message}`);
        // Consider more robust error handling? Shutdown?
    });

    log(`WebSocket server listening on port ${port}`);

    // --- Graceful Shutdown --- 
    const shutdown = async (signal: string) => {
        log(`Received ${signal}. Shutting down server...`);
        await cleanupAllSessions();
        log('Closing WebSocket server...');
        wss.close((err) => {
            if (err) {
                logError(`Error closing WebSocket server: ${err}`);
            }

            log('WebSocket server closed.');
            log('Shutdown complete.');
        });
        // Force exit if cleanup takes too long
        setTimeout(() => {
            logError('Shutdown timed out. Forcing exit.');
             
            process.exit(1); // Keep necessary exit with disable comment
        }, SHUTDOWN_GRACE_PERIOD_MS);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
}

// Removed IIFE - using top-level await directly

try {
    await startServer();
    log('Terminal server started successfully.');
} catch (error) {
    logError('Server failed unexpectedly:');
    logError(error);
     
    process.exit(1); // Keep necessary exit with disable comment
}

function pipeStreams(wsStream: Duplex, containerStream: stream.Duplex) {
    log('Piping WebSocket stream to container stream');
    wsStream.pipe(containerStream).on('error', (err) => {
        logError(`Error piping WebSocket stream to container stream: ${err.message}`);
    });
    containerStream.pipe(wsStream).on('error', (err) => {
        logError(`Error piping container stream to WebSocket: ${err.message}`);
    });
}

// Helper to safely close WebSocket stream
function safeCloseWsStream(wsStream: Duplex) {
    if (wsStream && !wsStream.destroyed) {
        log('Closing WebSocket stream.');
        wsStream.destroy();
    }
}

// --- Container Attachment Logic ---

async function attachToContainer(session: ClientSession, ws: WebSocket): Promise<void> {
    const wsStream = createWebSocketStream(ws, { encoding: 'utf8' });
    let containerStream: stream.Duplex | null = null;

    try {
        // Ensure container exists on session before proceeding
        if (!session.container) {
            throw new Error('Container not associated with session during attach');
        }
        log(`Attaching to container ${session.container.id} for session ${session.sessionId}`);

        const execOptions: Docker.ExecCreateOptions = {
            AttachStdin: true,
            AttachStdout: true,
            AttachStderr: true,
            Cmd: ['/bin/bash'], // Or your desired shell
            Tty: true,
        };
        const exec = await session.container.exec(execOptions);
        session.execInstance = exec; // Store exec instance

        const streamOpts = { hijack: true, stdin: true };
        containerStream = await exec.start(streamOpts) as stream.Duplex;

        // Assign streams to session *after* successful creation
        session.stdinStream = containerStream;
        session.stdoutStream = containerStream;

        log(`Attached stream to container ${session.container.id} for session ${session.sessionId}`);

        // Now pipe streams, containerStream is guaranteed to be Duplex here
        pipeStreams(wsStream, containerStream);

        // WebSocket stream event handlers
        wsStream.on('close', () => {
            log(`WebSocket stream closed for session ${session.sessionId}`);
            // containerStream is captured in this closure
            if (containerStream) safeCloseWsStream(containerStream);
            cleanupSession(session.sessionId);
        });
        wsStream.on('error', (err) => {
            logError(`WebSocket stream error for session ${session.sessionId}: ${err.message}`);
            if (containerStream) safeCloseWsStream(containerStream);
            cleanupSession(session.sessionId);
        });

        // Container stream event handlers
        containerStream.on('close', () => {
            log(`Container stream closed for session ${session.sessionId}`);
            safeCloseWsStream(wsStream); // wsStream is captured
            cleanupSession(session.sessionId);
        });
        containerStream.on('error', (err) => {
            logError(`Container stream error for session ${session.sessionId}: ${err.message}`);
            safeCloseWsStream(wsStream);
            cleanupSession(session.sessionId);
        });

    } catch (error) {
        logError(`Failed to attach to container for session ${session.sessionId}: ${error instanceof Error ? error.message : String(error)}`);
        safeCloseWsStream(wsStream);
        if (containerStream) {
            safeCloseWsStream(containerStream); // Close if created before error
        }
        cleanupSession(session.sessionId);
        if (ws.readyState === WebSocket.OPEN) {
           ws.close(1011, 'Failed to attach to container');
        }
    }
}

async function cleanupSession(sessionId: string) {
    const session = sessions.get(sessionId);
    if (session) {
        log(`Cleaning up session ${sessionId}`);
        clearTimeout(session.timeoutId);
        if (session.ws.readyState === WebSocket.OPEN || session.ws.readyState === WebSocket.CONNECTING) {
            session.ws.close(1000, 'Session cleanup');
        }

        // Close streams safely
        if (session.stdinStream) safeCloseWsStream(session.stdinStream);
        // stdoutStream is the same as stdinStream in TTY mode, but check just in case
        // if (session.stdoutStream && session.stdoutStream !== session.stdinStream) safeCloseWsStream(session.stdoutStream);

        // Stop the container if it exists
        if (session.container) {
            try {
                const containerInfo = await session.container.inspect();
                if (containerInfo && (containerInfo.State.Running || containerInfo.State.Paused)) {
                    log(`Attempting to stop container ${session.container.id}...`);
                    // Added specific catch for stop error
                    await session.container.stop({ t: 2 }).catch((stopError: Error) => {
                        logError(`Error stopping container ${session.container?.id}: ${stopError.message}. Relying on AutoRemove.`);
                    });
                     log(`Container ${session.container.id} stopped or stop attempted.`);
                }
            } catch (inspectError: any) {
                logError(`Error inspecting container ${session.container?.id} before stop: ${inspectError instanceof Error ? inspectError.message : String(inspectError)}. May already be stopped or removed.`);
            }
        }

        sessions.delete(sessionId);
        log(`Session ${sessionId} removed. Active sessions: ${sessions.size}`);
    } else {
        log(`Attempted to clean up non-existent session ${sessionId}`);
    }
}

// --- Message Handlers ---

function handleExecResize(session: ClientSession, data: { cols: number, rows: number }) {
    if (session.execInstance) {
        const { cols, rows } = data;
        log(`Resizing TTY for session ${session.sessionId} to ${cols}x${rows}`);
        session.execInstance.resize({ h: rows, w: cols }).catch((resizeError: Error) => {
            logError(`Error resizing TTY for session ${session.sessionId}: ${resizeError.message}`);
        });
    } else {
        logError(`Cannot resize TTY: execInstance not found for session ${session.sessionId}`);
    }
}

function handleMessage(session: ClientSession, message: Buffer) {
    try {
        const msgStr = message.toString('utf8');
        const parsed = JSON.parse(msgStr);

        if (parsed.type === 'resize' && parsed.data) {
            handleExecResize(session, parsed.data);
        } else if (parsed.type === 'data' && parsed.data) {
            // Write data to the container's stdin stream
            if (session.stdinStream && !session.stdinStream.destroyed) {
                 log(`Received data for session ${session.sessionId}, writing to stdinStream.`);
                session.stdinStream.write(parsed.data);
            } else {
                logError(`Cannot write data: stdinStream not available or destroyed for session ${session.sessionId}`);
            }
        } else {
            logError(`Received unknown message type or format for session ${session.sessionId}: ${msgStr}`);
        }
    } catch {
        // Handle non-JSON messages or binary data directly as input
        // log(`Received non-JSON message for session ${session.sessionId}, writing directly to stdinStream.`);
        if (session.stdinStream && !session.stdinStream.destroyed) {
            session.stdinStream.write(message);
        } else {
             logError(`Cannot write raw data: stdinStream not available or destroyed for session ${session.sessionId}`);
        }
    }
}

