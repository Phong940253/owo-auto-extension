const CATCH_COMMAND_PREFIX = '@Pokétwo#8236 catch ';
const AUTO_HUNT_COMMAND = 'oh';
const AUTO_BATTLE_COMMAND = 'ob';
const AUTO_OPRAY_COMMAND = 'opray';
const AUTO_HUNT_TO_BATTLE_DELAY_MS = 450;
const AUTO_HUNT_INTERVAL_MIN_MS = 15_000;
const AUTO_HUNT_INTERVAL_MAX_MS = 25_000;
const AUTO_OPRAY_INTERVAL_MS = 330_000;
const OWNER_MENTION_TEXT = '<@phong940253>';
const VERIFY_ALERT_TEXT = 'are you a real human';
const VERIFY_BUTTON_TEXT = 'verify';
const processedImageUrls = new Set();
const processedVerifyMessageIds = new Set();
const ALLOWED_BOT_NAMES = new Set(['poketwoverified appapp', '']);
let autoHuntTimeoutId = null;
let autoHuntButton = null;
let autoHuntStatus = null;
let autoCatchEnabled = true;
let autoCatchButton = null;
let autoCatchStatus = null;
let autoOprayIntervalId = null;
let autoOprayButton = null;
let autoOprayStatus = null;
let overlayPanel = null;

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

    console.log('Checking author name:', { original: authorName, normalized });
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

function sanitizeMessageText(rawText) {
    if (!rawText) return '';
    return String(rawText)
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

function getMessageKey(messageNode) {
    const listItemId = messageNode.getAttribute('data-list-item-id');
    if (listItemId) {
        return listItemId;
    }

    const labelledBy = messageNode.getAttribute('aria-labelledby');
    if (labelledBy) {
        return labelledBy;
    }

    return messageNode.id || '';
}

function isVerifyChallengeMessage(messageNode) {
    if (!messageNode || messageNode.nodeType !== 1) {
        return false;
    }

    const authorElement = messageNode.querySelector('[id^="message-username-"], span[class*="username"]');
    const authorName = normalizeAuthorName(authorElement?.textContent || '');
    if (!authorName.includes('owo')) {
        return false;
    }

    const contentElement = messageNode.querySelector('[id^="message-content-"]');
    const messageText = sanitizeMessageText(contentElement?.textContent || '');
    const hasVerifyWarningText = messageText.includes(VERIFY_ALERT_TEXT) && messageText.includes('link below');

    const buttonLabels = Array.from(messageNode.querySelectorAll('button, [role="button"]'))
        .map((button) => sanitizeMessageText(button.textContent || ''));
    const hasVerifyButton = buttonLabels.some((label) => label.includes(VERIFY_BUTTON_TEXT));

    return hasVerifyWarningText && hasVerifyButton;
}

function getOwOVerifyMessageNodes(node) {
    if (!node || node.nodeType !== 1) {
        return [];
    }

    const candidates = [];
    if (node.matches?.('[role="article"][data-list-item-id^="chat-messages"], li[id^="chat-messages-"]')) {
        candidates.push(node);
    }

    const nested = node.querySelectorAll?.('[role="article"][data-list-item-id^="chat-messages"], li[id^="chat-messages-"]') || [];
    nested.forEach((element) => candidates.push(element));

    return candidates.filter(isVerifyChallengeMessage);
}

function stopAutomationAndTagOwner() {
    stopAutoHunt();
    setAutoCatchEnabled(false);
    stopAutoOpray();

    const alertMessage = `${OWNER_MENTION_TEXT} OwO verify da xuat hien, minh da dung auto. Vao verify ngay!`;
    const sent = sendDiscordMessage(alertMessage);

    if (sent) {
        console.warn('⚠️ OwO verify detected. Auto hunt/catch stopped and owner notified.');
    } else {
        console.warn('⚠️ OwO verify detected. Auto hunt/catch stopped but unable to send alert tag.');
    }
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

function isAutoHuntEnabled() {
    return autoHuntTimeoutId !== null;
}

function isAutoCatchEnabled() {
    return autoCatchEnabled;
}

function updateAutoCatchOverlayState() {
    if (!autoCatchButton || !autoCatchStatus) {
        return;
    }

    const enabled = isAutoCatchEnabled();
    autoCatchButton.textContent = enabled ? 'Auto Catch: ON' : 'Auto Catch: OFF';
    autoCatchButton.style.background = enabled ? '#22c55e' : '#ef4444';
    autoCatchStatus.textContent = enabled ? 'Tự catch Pokémon spawn' : 'Đang tắt';
}

function setAutoCatchEnabled(enabled) {
    autoCatchEnabled = Boolean(enabled);
    updateAutoCatchOverlayState();
}

function toggleAutoCatch() {
    setAutoCatchEnabled(!isAutoCatchEnabled());
}

function isAutoOprayEnabled() {
    return autoOprayIntervalId !== null;
}

function updateAutoOprayOverlayState() {
    if (!autoOprayButton || !autoOprayStatus) {
        return;
    }

    const enabled = isAutoOprayEnabled();
    autoOprayButton.textContent = enabled ? 'Auto Opray: ON' : 'Auto Opray: OFF';
    autoOprayButton.style.background = enabled ? '#22c55e' : '#ef4444';
    autoOprayStatus.textContent = enabled ? 'Gui opray moi 5p30s' : 'Dang tat';
}

function stopAutoOpray() {
    if (autoOprayIntervalId !== null) {
        clearInterval(autoOprayIntervalId);
        autoOprayIntervalId = null;
    }

    updateAutoOprayOverlayState();
}

function startAutoOpray() {
    if (autoOprayIntervalId !== null) {
        return;
    }

    autoOprayIntervalId = setInterval(() => {
        const sent = sendDiscordMessage(AUTO_OPRAY_COMMAND);
        if (!sent) {
            console.warn('⚠️ Auto Opray: cannot send command, message box unavailable');
        }
    }, AUTO_OPRAY_INTERVAL_MS);

    updateAutoOprayOverlayState();
}

function toggleAutoOpray() {
    if (isAutoOprayEnabled()) {
        stopAutoOpray();
    } else {
        startAutoOpray();
    }
}

function updateAutoHuntOverlayState() {
    if (!autoHuntButton || !autoHuntStatus) {
        return;
    }

    const enabled = isAutoHuntEnabled();
    autoHuntButton.textContent = enabled ? 'Auto Hunt: ON' : 'Auto Hunt: OFF';
    autoHuntButton.style.background = enabled ? '#22c55e' : '#ef4444';
    autoHuntStatus.textContent = enabled ? 'Gửi oh -> ob, ngẫu nhiên 15-25s' : 'Đang tắt';
}

function stopAutoHunt() {
    if (autoHuntTimeoutId !== null) {
        clearTimeout(autoHuntTimeoutId);
        autoHuntTimeoutId = null;
    }

    updateAutoHuntOverlayState();
}

function getRandomAutoHuntDelayMs() {
    return Math.floor(
        Math.random() * (AUTO_HUNT_INTERVAL_MAX_MS - AUTO_HUNT_INTERVAL_MIN_MS + 1)
    ) + AUTO_HUNT_INTERVAL_MIN_MS;
}

function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function startAutoHunt() {
    if (autoHuntTimeoutId !== null) {
        return;
    }

    const sendHunt = async () => {
        const sent = sendDiscordMessage(AUTO_HUNT_COMMAND);
        if (!sent) {
            console.warn('⚠️ Auto Hunt: cannot send oh, message box unavailable');
            return;
        }

        await wait(AUTO_HUNT_TO_BATTLE_DELAY_MS);

        const sentBattle = sendDiscordMessage(AUTO_BATTLE_COMMAND);
        if (!sentBattle) {
            console.warn('⚠️ Auto Hunt: sent oh but cannot send ob, message box unavailable');
        }
    };

    const scheduleNextHunt = () => {
        if (!isAutoHuntEnabled()) {
            return;
        }

        const delay = getRandomAutoHuntDelayMs();
        autoHuntTimeoutId = setTimeout(() => {
            sendHunt();
            scheduleNextHunt();
        }, delay);
    };

    sendHunt();
    autoHuntTimeoutId = setTimeout(() => {
        sendHunt();
        scheduleNextHunt();
    }, getRandomAutoHuntDelayMs());
    updateAutoHuntOverlayState();
}

function toggleAutoHunt() {
    if (isAutoHuntEnabled()) {
        stopAutoHunt();
    } else {
        startAutoHunt();
    }
}

function clampOverlayPosition(panel, nextLeft, nextTop) {
    const maxLeft = Math.max(0, window.innerWidth - panel.offsetWidth - 8);
    const maxTop = Math.max(0, window.innerHeight - panel.offsetHeight - 8);
    return {
        left: Math.min(Math.max(8, nextLeft), maxLeft),
        top: Math.min(Math.max(8, nextTop), maxTop)
    };
}

function enableOverlayDrag(panel, dragHandle) {
    let isDragging = false;
    let pointerOffsetX = 0;
    let pointerOffsetY = 0;

    const stopDragging = () => {
        isDragging = false;
        document.removeEventListener('pointermove', onPointerMove);
        document.removeEventListener('pointerup', onPointerUp);
    };

    const onPointerMove = (event) => {
        if (!isDragging) {
            return;
        }

        const { left, top } = clampOverlayPosition(
            panel,
            event.clientX - pointerOffsetX,
            event.clientY - pointerOffsetY
        );

        panel.style.left = `${left}px`;
        panel.style.top = `${top}px`;
        panel.style.right = 'auto';
    };

    const onPointerUp = () => {
        stopDragging();
    };

    dragHandle.addEventListener('pointerdown', (event) => {
        const rect = panel.getBoundingClientRect();
        isDragging = true;
        pointerOffsetX = event.clientX - rect.left;
        pointerOffsetY = event.clientY - rect.top;

        document.addEventListener('pointermove', onPointerMove);
        document.addEventListener('pointerup', onPointerUp);
    });
}

function createPanelRow(labelText) {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.flexDirection = 'column';
    row.style.gap = '6px';

    const label = document.createElement('div');
    label.textContent = labelText;
    label.style.fontSize = '11px';
    label.style.opacity = '0.85';

    row.appendChild(label);
    return row;
}

function createAutoHuntOverlay() {
    if (document.getElementById('poketwo-auto-hunt-overlay')) {
        return;
    }

    overlayPanel = document.createElement('div');
    overlayPanel.id = 'poketwo-auto-hunt-overlay';
    overlayPanel.style.position = 'fixed';
    overlayPanel.style.top = '16px';
    overlayPanel.style.right = '16px';
    overlayPanel.style.zIndex = '999999';
    overlayPanel.style.display = 'flex';
    overlayPanel.style.flexDirection = 'column';
    overlayPanel.style.gap = '8px';
    overlayPanel.style.width = '210px';
    overlayPanel.style.padding = '0';
    overlayPanel.style.borderRadius = '10px';
    overlayPanel.style.background = 'rgba(17, 24, 39, 0.92)';
    overlayPanel.style.color = '#f9fafb';
    overlayPanel.style.fontFamily = 'system-ui, -apple-system, Segoe UI, sans-serif';
    overlayPanel.style.fontSize = '12px';
    overlayPanel.style.overflow = 'hidden';

    const dragHeader = document.createElement('div');
    dragHeader.textContent = 'OWO Control Panel';
    dragHeader.style.padding = '8px 10px';
    dragHeader.style.background = 'rgba(255, 255, 255, 0.08)';
    dragHeader.style.cursor = 'move';
    dragHeader.style.fontWeight = '700';
    dragHeader.style.userSelect = 'none';

    const contentArea = document.createElement('div');
    contentArea.style.display = 'flex';
    contentArea.style.flexDirection = 'column';
    contentArea.style.gap = '8px';
    contentArea.style.padding = '10px';

    const autoCatchRow = createPanelRow('Auto Catch Pokemon');

    autoCatchButton = document.createElement('button');
    autoCatchButton.type = 'button';
    autoCatchButton.textContent = 'Auto Catch: ON';
    autoCatchButton.style.border = 'none';
    autoCatchButton.style.borderRadius = '6px';
    autoCatchButton.style.padding = '8px 10px';
    autoCatchButton.style.color = '#fff';
    autoCatchButton.style.cursor = 'pointer';
    autoCatchButton.style.fontWeight = '600';
    autoCatchButton.addEventListener('click', toggleAutoCatch);

    autoCatchStatus = document.createElement('div');
    autoCatchStatus.textContent = 'Tự catch Pokémon spawn';
    autoCatchStatus.style.fontSize = '11px';
    autoCatchStatus.style.opacity = '0.85';

    autoCatchRow.appendChild(autoCatchButton);
    autoCatchRow.appendChild(autoCatchStatus);
    contentArea.appendChild(autoCatchRow);

    const autoHuntRow = createPanelRow('Auto Hunt');

    autoHuntButton = document.createElement('button');
    autoHuntButton.type = 'button';
    autoHuntButton.textContent = 'Auto Hunt: OFF';
    autoHuntButton.style.border = 'none';
    autoHuntButton.style.borderRadius = '6px';
    autoHuntButton.style.padding = '8px 10px';
    autoHuntButton.style.color = '#fff';
    autoHuntButton.style.cursor = 'pointer';
    autoHuntButton.style.fontWeight = '600';
    autoHuntButton.addEventListener('click', toggleAutoHunt);

    autoHuntStatus = document.createElement('div');
    autoHuntStatus.textContent = 'Đang tắt';
    autoHuntStatus.style.fontSize = '11px';
    autoHuntStatus.style.opacity = '0.85';

    autoHuntRow.appendChild(autoHuntButton);
    autoHuntRow.appendChild(autoHuntStatus);
    contentArea.appendChild(autoHuntRow);

    const autoOprayRow = createPanelRow('Auto Opray');

    autoOprayButton = document.createElement('button');
    autoOprayButton.type = 'button';
    autoOprayButton.textContent = 'Auto Opray: OFF';
    autoOprayButton.style.border = 'none';
    autoOprayButton.style.borderRadius = '6px';
    autoOprayButton.style.padding = '8px 10px';
    autoOprayButton.style.color = '#fff';
    autoOprayButton.style.cursor = 'pointer';
    autoOprayButton.style.fontWeight = '600';
    autoOprayButton.addEventListener('click', toggleAutoOpray);

    autoOprayStatus = document.createElement('div');
    autoOprayStatus.textContent = 'Dang tat';
    autoOprayStatus.style.fontSize = '11px';
    autoOprayStatus.style.opacity = '0.85';

    autoOprayRow.appendChild(autoOprayButton);
    autoOprayRow.appendChild(autoOprayStatus);
    contentArea.appendChild(autoOprayRow);

    overlayPanel.appendChild(dragHeader);
    overlayPanel.appendChild(contentArea);
    document.body.appendChild(overlayPanel);

    enableOverlayDrag(overlayPanel, dragHeader);
    updateAutoCatchOverlayState();
    updateAutoHuntOverlayState();
    updateAutoOprayOverlayState();
}

function initAutoHuntOverlay() {
    if (document.body) {
        createAutoHuntOverlay();
        return;
    }

    window.addEventListener('DOMContentLoaded', () => {
        createAutoHuntOverlay();
    }, { once: true });
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
                const verifyNodes = getOwOVerifyMessageNodes(node);
                verifyNodes.forEach((messageNode) => {
                    const messageKey = getMessageKey(messageNode);
                    if (messageKey && processedVerifyMessageIds.has(messageKey)) {
                        return;
                    }

                    if (messageKey) {
                        processedVerifyMessageIds.add(messageKey);
                    }

                    stopAutomationAndTagOwner();
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
window.poketwoTestSend = testSend;
window.poketwoTestCatch = (pokemonName = 'pikachu') => testSend(`${CATCH_COMMAND_PREFIX}${pokemonName}`);
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

document.addEventListener('keydown', (event) => {
    if (event.altKey && event.shiftKey && event.key.toLowerCase() === 'y') {
        testSend();
    }
});

console.log("🚀 Firefox Poketwo Forwarder Active");
console.log('🧪 Test helpers ready: poketwoTestSend("hello"), poketwoTestCatch("mew") or press Alt+Shift+T');