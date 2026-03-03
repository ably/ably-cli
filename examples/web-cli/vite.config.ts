import react from "@vitejs/plugin-react";
import { defineConfig, Plugin } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import { signCredentials, getSigningSecret } from "./server/sign-handler.js";

// Custom plugin to add /api/sign endpoint for both dev and preview
function apiSignPlugin(): Plugin {
  // Shared middleware handler for both dev and preview servers
  const apiSignMiddleware = (req: any, res: any, next: any) => {
    // Only handle /api/sign requests
    if (!req.url?.startsWith("/api/sign")) {
      return next();
    }

    if (req.method !== "POST") {
      res.statusCode = 405;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Method not allowed" }));
      return;
    }

    const secret = getSigningSecret();
    if (!secret) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Signing secret not configured" }));
      return;
    }

    // Parse request body
    let body = "";
    req.on("data", (chunk: any) => {
      body += chunk;
    });

    req.on("end", () => {
      try {
        const { apiKey, bypassRateLimit } = JSON.parse(body);

        if (!apiKey) {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "apiKey is required" }));
          return;
        }

        // Use shared signing logic
        const result = signCredentials({ apiKey, bypassRateLimit }, secret);

        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(result));
      } catch (error) {
        console.error("[/api/sign] Error:", error);
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "Invalid request body" }));
      }
    });
  };

  return {
    name: "api-sign",
    configureServer(server) {
      server.middlewares.use(apiSignMiddleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(apiSignMiddleware);
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tsconfigPaths(), tailwindcss(), apiSignPlugin()],
  server: {
    host: true,
    https: undefined,
  },
});
