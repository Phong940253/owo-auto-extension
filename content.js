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

    const attachmentImageSelector = [
        'img[src*="cdn.discordapp.com/attachments/"]',
        'img[src*="media.discordapp.net/attachments/"]',
        'img[src*="cdn.discordapp.com/ephemeral-attachments/"]',
        'img[src*="media.discordapp.net/ephemeral-attachments/"]'
    ].join(', ');

    if (node.matches?.(attachmentImageSelector)) {
        return node;
    }

    return node.querySelector?.(attachmentImageSelector) || null;
}

// Mutation Observer to watch for Pokétwo spawns
const observer = new MutationObserver((mutations) => {
    const seenVerifyFingerprints = new Set();

    for (const mutation of mutations) {
        mutation.addedNodes.forEach(node => {
            if (node.nodeType === 1) {
                if (window.poketwoProcessOwOMessage) {
                    window.poketwoProcessOwOMessage(node);
                }

                const verifyNodes = getOwOVerifyMessageNodes(node);
                verifyNodes.forEach((messageNode) => {
                    const verifyFingerprint = getVerifyMessageFingerprint(messageNode);
                    if (seenVerifyFingerprints.has(verifyFingerprint)) {
                        return;
                    }
                    seenVerifyFingerprints.add(verifyFingerprint);

                    if (processedVerifyMessageIds.has(verifyFingerprint)) {
                        return;
                    }

                    processedVerifyMessageIds.add(verifyFingerprint);

                    stopAutomationAndTagOwner(verifyFingerprint);
                });

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

                if (!isAutoCatchEnabled()) {
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
initAutoHuntOverlay();
installPageConsoleBridge();
window.poketwoTestSend = testSend;
window.poketwoTestCatch = (pokemonName = 'pikachu') => testSend(`${CATCH_COMMAND_PREFIX}${pokemonName}`);
window.poketwoTestGetId = testGetId;
window.poketwoAutoHunt = {
    start: startAutoHunt,
    stop: stopAutoHunt,
    toggle: toggleAutoHunt,
    isEnabled: isAutoHuntEnabled
};
window.poketwoAutoCatch = {
    toggle: toggleAutoCatch,
    isEnabled: isAutoCatchEnabled,
    setEnabled: setAutoCatchEnabled
};
window.poketwoAutoOpray = {
    start: startAutoOpray,
    stop: stopAutoOpray,
    toggle: toggleAutoOpray,
    isEnabled: isAutoOprayEnabled
};
window.poketwoDebug = {
    setAllowNonOwoAutoStop(enabled = true) {
        allowDebugAutoStopFromAnyAuthor = Boolean(enabled);
        console.log('🧪 Non-OwO auto-stop debug mode:', allowDebugAutoStopFromAnyAuthor ? 'ON' : 'OFF');
        return allowDebugAutoStopFromAnyAuthor;
    },
    isAllowNonOwoAutoStopEnabled() {
        return allowDebugAutoStopFromAnyAuthor;
    },
    triggerPhrases: [...DEBUG_AUTO_STOP_TRIGGER_PHRASES]
};

document.addEventListener('keydown', (event) => {
    if (event.altKey && event.shiftKey && event.key.toLowerCase() === 'y') {
        testSend();
    }
});

console.log("🚀 Firefox Poketwo Forwarder Active");
console.log('🧪 Test helpers ready: poketwoTestSend("hello"), poketwoTestCatch("mew"), poketwoTestGetId() or press Alt+Shift+T');