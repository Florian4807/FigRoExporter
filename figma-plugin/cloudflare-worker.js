addEventListener("fetch", (event) => {
    event.respondWith(
        handleRequest(event.request, event).catch(
            (err) => new Response(err.stack, { status: 500 })
        )
    );
});

async function handleRequest(request) {
    if (request.method === "OPTIONS") {
        return new Response(null, {
            status: 204,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, x-api-key",
            },
        });
    }

    const url = new URL(request.url);

    // Ensure we are only proxying path segments that start with /assets/
    if (!url.pathname.startsWith('/assets/')) {
        return new Response("Invalid proxy route", { status: 400 });
    }

    const targetUrl = new URL(url.pathname + url.search, "https://apis.roblox.com");

    // Forward the original request headers exactly to Roblox,
    // especially the API Key and Content-Type (which includes the multipart boundary!)
    const proxyHeaders = new Headers(request.headers);

    // Strip out the host header so Cloudflare fetches correctly under the hood
    proxyHeaders.delete("Host");
    // Prevent Roblox from expecting a referer from our worker domain
    proxyHeaders.delete("Referer");
    proxyHeaders.delete("Origin");

    // Fetch data from Roblox APIs
    const roxbexResponse = await fetch(targetUrl.toString(), {
        method: request.method,
        headers: proxyHeaders,
        body: request.method !== "GET" && request.method !== "HEAD" ? request.body : null,
    });

    const responseBody = await roxbexResponse.arrayBuffer();

    // Send response back to Figma plugin with proper CORS enabled
    return new Response(responseBody, {
        status: roxbexResponse.status,
        headers: {
            ...Object.fromEntries(roxbexResponse.headers.entries()),
            "Access-Control-Allow-Origin": "*",
        },
    });
}
