#!/usr/bin/env node

// Backwards-compatible invocation: `npx @ably/cli ably <command>` passes a
// redundant leading `ably` token through to the CLI (the package is `@ably/cli`
// and the bin is `ably`, so people naturally repeat it). Now that
// `npx @ably/cli <command>` resolves the single `ably` bin directly, tolerate a
// leading `ably` so old docs, scripts and muscle memory keep working. There is
// no top-level `ably` command, so a leading `ably` is unambiguously the
// redundant binary name and is safe to drop.
if (process.argv[2] === 'ably') {
  process.argv.splice(2, 1);
}

// For interactive mode, ensure SIGINT exits with code 130
if (process.argv.includes('interactive')) {
  process.env.ABLY_INTERACTIVE_MODE = 'true';
  
  // Load sigint-exit to ensure proper exit code
  await import('../dist/src/utils/sigint-exit.js');
}

import { execute } from "@oclif/core";

// Store original write function
const originalWrite = process.stdout.write;

// Override process.stdout.write
process.stdout.write = function(chunk, encoding, callback) {
  // Handle overloaded arguments
  if (typeof encoding === 'function') {
    callback = encoding;
    encoding = undefined;
  }
  
  // Process string chunks
  if (typeof chunk === 'string') {
    // Remove double newlines before example lines (lines starting with "  $")
    // This works regardless of ANSI escape codes in the output
    if (chunk.includes('  $')) {
      chunk = chunk.replace(/\n\n(  \$)/g, '\n$1');
    }
  }
  
  // Call original write
  return originalWrite.call(process.stdout, chunk, encoding, callback);
};

await execute({ 
  dir: import.meta.url,
});