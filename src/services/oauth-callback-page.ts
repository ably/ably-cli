export function getSuccessPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ably CLI - Authentication Successful</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f8f9fa; }
    .container { text-align: center; padding: 2rem; max-width: 400px; }
    .icon { font-size: 3rem; margin-bottom: 1rem; }
    h1 { color: #1f2937; font-size: 1.5rem; margin-bottom: 0.5rem; }
    p { color: #6b7280; }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">&#10003;</div>
    <h1>Authentication Successful</h1>
    <p>You can close this tab and return to your terminal.</p>
  </div>
</body>
</html>`;
}

function escapeHtml(unsafe: string): string {
  return unsafe
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function getErrorPage(error: string): string {
  const safeError = escapeHtml(error);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ably CLI - Authentication Failed</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f8f9fa; }
    .container { text-align: center; padding: 2rem; max-width: 400px; }
    .icon { font-size: 3rem; margin-bottom: 1rem; }
    h1 { color: #dc2626; font-size: 1.5rem; margin-bottom: 0.5rem; }
    p { color: #6b7280; }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">&#10007;</div>
    <h1>Authentication Failed</h1>
    <p>${safeError}</p>
    <p>Please return to your terminal and try again.</p>
  </div>
</body>
</html>`;
}
