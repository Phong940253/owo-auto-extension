// Send a ping every 20 seconds to keep the background service worker alive
// This is a common workaround for Service Workers going to sleep in Chrome Extensions Manifest V3
setInterval(async () => {
    try {
        const runtime = globalThis.chrome?.runtime || globalThis.browser?.runtime;
        if (runtime) {
            await runtime.sendMessage({ type: 'KEEPALIVE_PING' });
        }
    } catch (err) {
        // Ignore expected errors if the background script is restarting
    }
}, 20000);
