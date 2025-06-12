import { AblyCliTerminal } from "@ably/react-web-cli";
import { useCallback, useEffect, useState } from "react";

import "./App.css";
import { CliDrawer } from "./components/CliDrawer";

// Default WebSocket URL - use public endpoint for production, localhost for development
const DEFAULT_WEBSOCKET_URL = "wss://web-cli.ably.com";

// Get WebSocket URL from Vite environment variables or query parameters
const getWebSocketUrl = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const serverParam = urlParams.get("serverUrl");
  if (serverParam) {
    console.log(`[App.tsx] Found serverUrl param: ${serverParam}`);
    return serverParam;
  }
  const envServerUrl = import.meta.env.VITE_TERMINAL_SERVER_URL;
  if (envServerUrl) {
    console.log(`[App.tsx] Using env var VITE_TERMINAL_SERVER_URL: ${envServerUrl}`);
    return envServerUrl;
  }
  console.log(`[App.tsx] Falling back to default URL: ${DEFAULT_WEBSOCKET_URL}`);
  return DEFAULT_WEBSOCKET_URL;
};

// Credentials: query parameters take precedence over env variables
const urlParamsForCreds = new URLSearchParams(window.location.search);
const qsApiKey = urlParamsForCreds.get('apikey') || urlParamsForCreds.get('apiKey');
const qsAccessToken = urlParamsForCreds.get('accessToken') || urlParamsForCreds.get('accesstoken');

// Fallback to Vite env vars if query params absent
const envApiKey = import.meta.env.VITE_ABLY_API_KEY as string | undefined;
const envAccessToken = import.meta.env.VITE_ABLY_ACCESS_TOKEN as string | undefined;

const initialApiKey = qsApiKey ?? envApiKey;
const initialAccessToken = qsAccessToken ?? envAccessToken;

// Determine whether we already have cred inputs (either source)
const hasInitialCredentials = Boolean(initialApiKey || initialAccessToken);

function App() {
  // Read initial mode from URL, default to fullscreen
  const initialMode = new URLSearchParams(window.location.search).get("mode") as ("fullscreen" | "drawer") || "fullscreen";

  type TermStatus = 'initial' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error';
  const [connectionStatus, setConnectionStatus] = useState<TermStatus>('disconnected');
  const [apiKey, setApiKey] = useState<string | undefined>(initialApiKey);
  const [accessToken, setAccessToken] = useState<string | undefined>(initialAccessToken);
  const [displayMode, setDisplayMode] = useState<"fullscreen" | "drawer">(initialMode);

  // Remove state vars that cause remounting issues
  const [shouldConnect, setShouldConnect] = useState<boolean>(
    hasInitialCredentials,
  );

  // Store the latest sessionId globally for E2E tests / debugging
  const handleSessionId = useCallback((id: string) => {
    console.log(`[App] Received sessionId: ${id}`);
    (window as any)._sessionId = id; // Expose for Playwright
  }, []);

  const handleConnectionChange = useCallback((status: TermStatus) => {
    console.log("Connection Status:", status);
    setConnectionStatus(status);
  }, []);

  const handleSessionEnd = useCallback((reason: string) => {
    console.log("Session ended:", reason);
  }, []);

  // Effect to update URL when displayMode changes
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("mode") !== displayMode) {
      urlParams.set("mode", displayMode);
      window.history.replaceState({}, '', `${window.location.pathname}?${urlParams.toString()}`);
    }
  }, [displayMode]);

  // Set up credentials once on mount and immediately connect
  useEffect(() => {
    if (!hasInitialCredentials) {
      // For demo purposes only - in production get these from a secure API
      console.log("Setting demo credentials");
      setApiKey("dummy.key:secret"); // Use a realistic-looking key format
      // Provide a structurally valid (but fake) JWT
      setAccessToken("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkZW1vIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c");
      setShouldConnect(true);
    }
  }, []);

  // Get the URL *inside* the component body
  const currentWebsocketUrl = getWebSocketUrl();

  // Prepare the terminal component instance to pass it down
  const TerminalInstance = useCallback(() => (
    shouldConnect && apiKey && accessToken ? (
      <AblyCliTerminal
        ablyAccessToken={accessToken}
        ablyApiKey={apiKey}
        onConnectionStatusChange={handleConnectionChange}
        onSessionEnd={handleSessionEnd}
        onSessionId={handleSessionId}
        websocketUrl={currentWebsocketUrl}
        resumeOnReload={true}
        enableSplitScreen={true}
        maxReconnectAttempts={5} /* In the example, limit reconnection attempts for testing, default is 15 */
      />
    ) : null
  ), [shouldConnect, apiKey, accessToken, handleConnectionChange, handleSessionEnd, handleSessionId, currentWebsocketUrl]);

  return (
    <div className="App fixed">
      {/* Restore header */}
      <header className="App-header">
        <span className="font-semibold text-base">Ably Web CLI Terminal</span>
        <div className="header-info">
          <span>Status: <span className={`status status-${connectionStatus}`}>{connectionStatus}</span></span>
          <span>Server: {currentWebsocketUrl}</span>
        </div>
        <div className="toggle-group">
          <button
            className={`toggle-segment ${displayMode === 'fullscreen' ? 'active' : ''}`}
            onClick={() => setDisplayMode('fullscreen')}
          >
            Fullscreen
          </button>
          <button
            className={`toggle-segment ${displayMode === 'drawer' ? 'active' : ''}`}
            onClick={() => setDisplayMode('drawer')}
          >
            Drawer
          </button>
        </div>
      </header>

      {/* Restore conditional rendering */}
      {displayMode === 'fullscreen' ? (
        <main className="App-main no-padding">
          <div className="Terminal-container">
            <TerminalInstance />
          </div>
        </main>
      ) : (
        <CliDrawer TerminalComponent={TerminalInstance} />
      )}

    </div>
  );
}

export default App;
