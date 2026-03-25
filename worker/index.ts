addEventListener("fetch", (event) => {
    event.respondWith(
        handleRequest(event.request).catch(
            (err) => new Response(err.stack, { 
                status: 500,
                headers: { "Access-Control-Allow-Origin": "*" } 
            })
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
                "Access-Control-Allow-Headers": "Content-Type, x-api-key, authorization",
                "Access-Control-Max-Age": "86400",
            },
        });
    }

    const url = new URL(request.url);

    if (!url.pathname.startsWith('/assets/')) {
        return new Response("Invalid proxy route", { 
            status: 400,
            headers: { "Access-Control-Allow-Origin": "*" }
        });
    }

    const targetUrl = "https://apis.roblox.com" + url.pathname + url.search;

    const proxyHeaders = new Headers(request.headers);
    proxyHeaders.delete("Host");
    proxyHeaders.delete("Referer");
    proxyHeaders.delete("Origin");
    proxyHeaders.delete("CF-Connecting-IP");

    const robloxResponse = await fetch(targetUrl, {
        method: request.method,
        headers: proxyHeaders,
        body: request.method !== "GET" && request.method !== "HEAD" ? request.body : null,
    });

    const responseHeaders = new Headers();
    
    const essentialHeaders = ["content-type", "content-length", "x-roblox-edge"];
    robloxResponse.headers.forEach((value, key) => {
        if (essentialHeaders.includes(key.toLowerCase())) {
            responseHeaders.set(key, value);
        }
    });

    responseHeaders.set("Access-Control-Allow-Origin", "*");
    responseHeaders.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    responseHeaders.set("Access-Control-Allow-Headers", "Content-Type, x-api-key, authorization");

    const responseBody = await robloxResponse.arrayBuffer();

    return new Response(responseBody, {
        status: robloxResponse.status,
        headers: responseHeaders,
    });
}