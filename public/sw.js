const CACHE_NAME = "psynova-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Only handle GET requests
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  // NEVER intercept payment, API, or checkout requests
  const bypassPaths = ["/api/", "/checkout/", "/payhere/"];

  const shouldBypass = bypassPaths.some((path) =>
    url.pathname.startsWith(path),
  );

  if (shouldBypass) {
    return;
  }

  // For everything else, use the network normally.
  event.respondWith(
    fetch(request).catch(() => {
      // Return a valid Response only for non-payment pages.
      return new Response(
        `<!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Offline - PsyNova</title>
          </head>
          <body>
            <h1>You are offline</h1>
            <p>Please check your internet connection and try again.</p>
          </body>
        </html>`,
        {
          status: 503,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
          },
        },
      );
    }),
  );
});
