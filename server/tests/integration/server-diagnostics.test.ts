import { expect } from 'chai';
import { exec, spawn, ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import getPort from 'get-port';

const execAsync = promisify(exec);

// For ESM compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Helper Functions ---
// Helper to wait for server health endpoint
async function waitForServer(url: string, timeout = 30000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      // Use fetch API as it's simpler for this purpose
      const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
      // Status 200 (OK) or 404 (Not Found, but server is up) are acceptable
      if (response.ok || response.status === 404) {
        return; // Server is up
      }
    } catch {
      // Ignore fetch errors (connection refused, timeout, etc.) and retry
    }
    await new Promise(resolve => setTimeout(resolve, 500)); // Wait before retrying
  }
  throw new Error(`Server at ${url} did not become ready within ${timeout}ms`);
}

describe('Server Diagnostic Tests', function() {
  this.timeout(180000); // 3 minutes overall timeout

  let terminalServerProcess: ChildProcess | null = null;
  let terminalServerPort: number;
  const serverLogs: string[] = []; // Keep server logs internally for failure context

  before(async function() {
    // Check Docker
    try {
      await execAsync('docker ps');
      console.log('Docker is running, proceeding with server diagnostic tests.');
    } catch {
      console.log('Docker not running, skipping server diagnostic tests.');
      this.skip();
      return;
    }

    // Ensure project is built
    console.log('Ensuring project is built before starting server...');
    try {
      await execAsync('pnpm prepare', { cwd: path.resolve(__dirname, '../../..') });
    } catch (buildError) {
      console.error('pnpm prepare failed:', buildError);
      throw new Error('Project build failed, cannot run server diagnostics test.');
    }

    // Start the terminal server for the server diagnostics test
    terminalServerPort = await getPort();
    console.log(`Starting terminal server for diagnostics test on port ${terminalServerPort}...`);
    const serverScriptPath = path.resolve(__dirname, '../../dist/index.js'); // Use built server

    terminalServerProcess = spawn('node', [serverScriptPath], {
        env: {
            ...process.env,
            PORT: terminalServerPort.toString(),
            NODE_ENV: 'test',
            ABLY_API_KEY: 'dummy.dummy:dummy',
            ABLY_ACCESS_TOKEN: 'dummy'
        },
        stdio: ['ignore', 'pipe', 'pipe'],
        cwd: path.resolve(__dirname, '../..')
    });

    // Capture logs internally but don't print them unless test fails
    terminalServerProcess.stdout?.on('data', (data) => serverLogs.push(`[SERVER_OUT]: ${data.toString().trim()}`));
    terminalServerProcess.stderr?.on('data', (data) => serverLogs.push(`[SERVER_ERR]: ${data.toString().trim()}`));
    terminalServerProcess.on('exit', (code, signal) => serverLogs.push(`[SERVER_EXIT]: Code ${code}, Signal ${signal}`));
    terminalServerProcess.on('error', (err) => serverLogs.push(`[SERVER_SPAWN_ERROR]: ${err.message}`));

    try {
      await waitForServer(`http://localhost:${terminalServerPort}/health`);
      console.log(`Terminal server started successfully on port ${terminalServerPort}.`);
    } catch (error) {
      console.error('Failed to start terminal server for tests.');
      console.error('Server logs:'); // Log server output ONLY on setup failure
      serverLogs.forEach(log => console.error(log));
      terminalServerProcess?.kill('SIGTERM');
      throw error; // Fail the setup
    }
  });

  after(async function() {
    const cleanupPromises: Promise<any>[] = [];
    if (terminalServerProcess) {
      console.log('Stopping diagnostic test terminal server...');
      terminalServerProcess.kill('SIGTERM');
      cleanupPromises.push(new Promise(resolve => terminalServerProcess?.once('exit', resolve)));
      terminalServerProcess = null;
    }
    if (cleanupPromises.length > 0) {
      await Promise.allSettled(cleanupPromises);
      console.log('Test server processes stopped.');
    }
  });

  it('diagnostics:container script should complete successfully', async function() {
    try {
      const { stdout, stderr } = await execAsync('pnpm diagnostics:container', { 
        timeout: 120000,
        cwd: path.resolve(__dirname, '../../..') // Run from main CLI directory
      });
      // Only log stderr if it exists and isn't just a warning
      if (stderr && !stderr.includes('deprecated') && !stderr.includes('Warning:')) {
          // console.error('--- diagnostics:container stderr (non-fatal) ---'); // Commented out non-fatal logging
          // console.error(stderr);
      }
      expect(stdout).to.include('Container test completed successfully!');
    } catch (error: any) {
      console.error('diagnostics:container test failed:'); // Log failure origin
      if (error.stdout) console.log('Failed command stdout:', error.stdout);
      if (error.stderr) console.error('Failed command stderr:', error.stderr);
      throw error;
    }
  });

  it('diagnostics:server script should complete successfully against local test server', async function() {
    if (!terminalServerProcess) this.skip(); // Skip if server failed to start in before hook

    const targetUrl = `ws://localhost:${terminalServerPort}`;
    try {
      const { stdout, stderr } = await execAsync(`pnpm diagnostics:server ${targetUrl}`, {
        cwd: path.resolve(__dirname, '../../..') // Run from main CLI directory
      });
      if (stderr && !stderr.includes('Debugger')) {
        // console.error('--- diagnostics:server stderr (non-fatal) ---'); // Commented out non-fatal logging
        // console.error(stderr);
      }
      expect(stdout).to.include('Diagnostics successful!');
    } catch (error: any) {
      console.error('diagnostics:server test failed:'); // Log failure origin
      if (error.stdout) console.log('Failed command stdout:', error.stdout);
      if (error.stderr) console.error('Failed command stderr:', error.stderr);
      console.error('--- Terminal server logs during test failure ---');
      serverLogs.forEach(log => console.error(log));
      throw error;
    }
  });
}); 