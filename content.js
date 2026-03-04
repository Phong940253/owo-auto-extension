const CATCH_COMMAND_PREFIX = '@Pokétwo#8236 catch ';
const processedImageUrls = new Set();
const ALLOWED_BOT_NAMES = new Set(['Pokétwo']);

function normalizeAuthorName(rawText) {
    if (!rawText) return '';
    return String(rawText)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();
}

function isAllowedAuthorName(authorName) {
    const normalized = normalizeAuthorName(authorName)
        .replace(/^@+/, '')
        .split('#')[0]
        .trim();
    return ALLOWED_BOT_NAMES.has(normalized);
}

function extractMessageAuthorNameFromImage(img) {
    const messageNode = img.closest('li[id^="chat-messages-"], [data-list-item-id^="chat-messages"]');
    if (!messageNode) {
        return '';
    }

    const authorSelectors = [
        '[id^="message-username-"]',
        'h3 span[class*="username"]',
        'span[class*="username"]'
    ];

    for (const selector of authorSelectors) {
        const authorElement = messageNode.querySelector(selector);
        const authorName = authorElement?.textContent?.trim();
        if (authorName) {
            return authorName;
        }
    }

    const ariaLabel = (messageNode.getAttribute('aria-label') || '').trim();
    if (!ariaLabel) {
        return '';
    }

    const authorFromAria = ariaLabel.split(',')[0].trim();
    return authorFromAria;
}

function isPoketwoMessageImage(img) {
    const authorName = extractMessageAuthorNameFromImage(img);
    return isAllowedAuthorName(authorName);
}

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
    console.log('Firefox Extension: Requesting background analysis for image:', imageUrl);

    try {
        const runtimeApi = globalThis.browser?.runtime || globalThis.chrome?.runtime;
        if (!runtimeApi?.sendMessage) {
            throw new Error('Extension runtime API is unavailable in content script');
        }

        const response = await runtimeApi.sendMessage({
            type: 'ANALYZE_POKEMON_IMAGE',
            imageUrl
        });

        if (!response?.ok) {
            throw new Error(response?.error || 'Background analysis failed');
        }

        const pokemonName = normalizePokemonName(response.pokemonName);
        console.log('✅ Firefox Ext identified:', pokemonName || response.pokemonName);

        if (!pokemonName) {
            console.warn('⚠️ No Pokémon name returned from Gemini response');
            return;
        }

        const sent = sendDiscordMessage(`${CATCH_COMMAND_PREFIX}${pokemonName}`);
        if (sent) {
            console.log('📨 Sent to Discord:', `${CATCH_COMMAND_PREFIX}${pokemonName}`);
        }
    } catch (error) {
        console.error('❌ Firefox Extension Error:', error);
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

                if (!isPoketwoMessageImage(img)) {
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