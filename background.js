const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const GEMINI_MODEL = 'gemini-3.1-flash-lite-preview';
const GEMINI_API_KEY = 'AIzaSyDdYwRk_p8WXaBIgpgLv8n8mlDkhw4Q8EE';

function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const result = reader.result;
            if (typeof result !== 'string') {
                reject(new Error('Failed to convert blob to base64'));
                return;
            }

            const commaIndex = result.indexOf(',');
            resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
        };
        reader.onerror = () => reject(reader.error || new Error('FileReader error'));
        reader.readAsDataURL(blob);
    });
}

async function fetchImageAsInlineData(imageUrl) {
    const response = await fetch(imageUrl);
    if (!response.ok) {
        throw new Error(`Failed to fetch image file: ${response.status}`);
    }

    const blob = await response.blob();
    const mimeType = blob.type || 'image/png';
    const data = await blobToBase64(blob);
    return { mimeType, data };
}

function extractGeminiText(data) {
    const parts = data?.candidates?.[0]?.content?.parts;
    if (!Array.isArray(parts)) return '';
    return parts
        .map((part) => (typeof part?.text === 'string' ? part.text : ''))
        .join(' ')
        .trim();
}

async function analyzePokemonInBackground(imageUrl) {
    if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY') {
        throw new Error('Gemini API key is missing. Set GEMINI_API_KEY in background.js.');
    }

    const inlineImage = await fetchImageAsInlineData(imageUrl);

    const payload = {
        contents: [{
            role: 'user',
            parts: [
                { text: 'What is the name of the Pokémon in this image? Respond with only the name.' },
                {
                    inlineData: {
                        mimeType: inlineImage.mimeType,
                        data: inlineImage.data
                    }
                }
            ]
        }]
    };

    const endpoint = `${GEMINI_API_BASE_URL}/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;

    const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data?.error?.message || `Gemini error ${res.status}`);
    }

    const pokemonName = extractGeminiText(data);
    if (!pokemonName) {
        throw new Error('No Pokémon name returned from Gemini response');
    }

    return pokemonName;
}

const runtimeApi = globalThis.browser?.runtime || globalThis.chrome?.runtime;

// --- KEEP ALIVE SYSTEM FOR CHROME MANIFEST V3 ---
async function ensureOffscreenDocument() {
    if (!globalThis.chrome?.offscreen) return;
    try {
        const hasDocument = await chrome.offscreen.hasDocument();
        if (hasDocument) return;

        await chrome.offscreen.createDocument({
            url: 'offscreen.html',
            reasons: [chrome.offscreen.Reason.DOM_SCRAPING],
            justification: 'Keep service worker alive for Discord automation'
        });
        console.log('Keep-alive offscreen document created.');
    } catch (e) {
        if (!e.message.includes('Only a single offscreen document')) {
            console.error('Failed to create offscreen document:', e);
        }
    }
}

if (globalThis.chrome?.alarms) {
    chrome.alarms.create("keepAliveAlarm", { periodInMinutes: 1 });
    chrome.alarms.onAlarm.addListener((alarm) => {
        if (alarm.name === "keepAliveAlarm") {
            ensureOffscreenDocument();
        }
    });
}

// Initial wake up
ensureOffscreenDocument();
// ------------------------------------------------

if (runtimeApi?.onMessage?.addListener) {
    runtimeApi.onMessage.addListener((message) => {
        if (message?.type === 'KEEPALIVE_PING') {
            return Promise.resolve({ ok: true });
        }

        if (message?.type !== 'ANALYZE_POKEMON_IMAGE' || !message.imageUrl) {
            return false;
        }

        return analyzePokemonInBackground(message.imageUrl)
            .then((pokemonName) => ({ ok: true, pokemonName }))
            .catch((error) => ({ ok: false, error: error?.message || String(error) }));
    });
}
