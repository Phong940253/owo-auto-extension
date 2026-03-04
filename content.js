const BACKEND_URL = 'http://127.0.0.1:6969/gemini-chat';
const CATCH_COMMAND_PREFIX = 'c ';
const processedImageUrls = new Set();

function normalizePokemonName(rawText) {
    if (!rawText) return '';
    return String(rawText)
        .trim()
        .replace(/^['"`]+|['"`]+$/g, '')
        .replace(/^the\s+/i, '')
        .replace(/\.$/, '');
}

function findDiscordMessageBox() {
    const allBoxes = Array.from(document.querySelectorAll('div[role="textbox"][contenteditable="true"]'));
    return allBoxes.find((box) => {
        const label = box.getAttribute('aria-label') || '';
        return label.startsWith('Message #') && box.offsetParent !== null;
    }) || null;
}

function sendDiscordMessage(text) {
    const box = findDiscordMessageBox();
    if (!box) {
        console.warn('⚠️ Discord message box not found');
        return false;
    }

    box.focus();
    const inserted = document.execCommand('insertText', false, text);

    if (!inserted) {
        box.textContent = text;
        box.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
    }

    const enterEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true
    });

    box.dispatchEvent(enterEvent);
    return true;
}

function testSend(message = `${CATCH_COMMAND_PREFIX}pikachu`) {
    const sent = sendDiscordMessage(message);
    if (sent) {
        console.log('🧪 Test message sent:', message);
    } else {
        console.warn('🧪 Test send failed: message box unavailable');
    }
    return sent;
}

async function analyzePokemon(imageUrl) {
    console.log("Firefox Extension: Sending image to local backend:", imageUrl);

    try {
        const requestOptions = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        };

        // Attempt 1: image URL in files using updated API body shape
        let payload = {
            message: "What is the name of the Pokémon in this image? Respond with only the name.",
            files: [imageUrl]
        };

        let res = await fetch(BACKEND_URL, {
            ...requestOptions,
            body: JSON.stringify(payload)
        });

        let data = await res.json().catch(() => ({}));

        // Attempt 2: fallback for backends that only accept local file paths
        const errorDetail = typeof data?.detail === 'string' ? data.detail.toLowerCase() : '';
        if (!res.ok && errorDetail.includes('not a valid file')) {
            console.warn('⚠️ Backend rejected URL as file path. Retrying with URL in message text.');
            payload = {
                message: `What is the name of the Pokémon in this image URL: ${imageUrl}. Respond with only the name.`,
                files: []
            };

            res = await fetch(BACKEND_URL, {
                ...requestOptions,
                body: JSON.stringify(payload)
            });

            data = await res.json().catch(() => ({}));
        }

        if (!res.ok) {
            throw new Error(data?.detail || `Backend error ${res.status}`);
        }

        const pokemonName = normalizePokemonName(data?.response);
        console.log("✅ Firefox Ext identified:", pokemonName || data?.response);

        if (!pokemonName) {
            console.warn('⚠️ No Pokémon name returned from backend response');
            return;
        }

        const sent = sendDiscordMessage(`${CATCH_COMMAND_PREFIX}${pokemonName}`);
        if (sent) {
            console.log('📨 Sent to Discord:', `${CATCH_COMMAND_PREFIX}${pokemonName}`);
        }
    } catch (error) {
        console.error("❌ Firefox Extension Error:", error);
    }
}

function extractPokemonImage(node) {
    if (!node || node.nodeType !== 1) return null;

    if (node.matches?.('.imageWrapper_af017a img')) {
        return node;
    }

    return node.querySelector?.('.imageWrapper_af017a img') || null;
}

// Mutation Observer to watch for Pokétwo spawns
const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
        mutation.addedNodes.forEach(node => {
            if (node.nodeType === 1) {
                const img = extractPokemonImage(node);
                if (!img?.src || img.src.includes('data:image')) {
                    return;
                }

                if (processedImageUrls.has(img.src)) {
                    return;
                }

                processedImageUrls.add(img.src);
                analyzePokemon(img.src);
            }
        });
    }
});

// Start observing
const targetNode = document.querySelector('[aria-label="Messages in spam"]') || document.body;
observer.observe(targetNode, { childList: true, subtree: true });
window.poketwoTestSend = testSend;
window.poketwoTestCatch = (pokemonName = 'pikachu') => testSend(`${CATCH_COMMAND_PREFIX}${pokemonName}`);

document.addEventListener('keydown', (event) => {
    if (event.altKey && event.shiftKey && event.key.toLowerCase() === 'y') {
        testSend();
    }
});

console.log("🚀 Firefox Poketwo Forwarder Active");
console.log('🧪 Test helpers ready: poketwoTestSend("hello"), poketwoTestCatch("mew") or press Alt+Shift+T');