let lastGemCheckTime = 0;
const GEM_CHECK_COOLDOWN_MS = 120_000;

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

    lastGemCheckTime = 0;

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

const superscriptMap = {'⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9'};
function parseSuperscriptCount(str) {
    if (!str) return 0;
    let s = str.trim();
    if (s === '') return 1;
    let numStr = s.split('').map(c => superscriptMap[c] !== undefined ? superscriptMap[c] : '').join('');
    return parseInt(numStr, 10) || 0;
}

const rarityOrder = {'c': 1, 'u': 2, 'r': 3, 'e': 4, 'm': 5, 'l': 6, 'f': 7};

function getBestGemCombination(gems, currentActiveRarities) {
    const type1Gems = gems.filter(g => g.type === 1);
    const type3Gems = gems.filter(g => g.type === 3);
    const type4Gems = gems.filter(g => g.type === 4);

    if (type1Gems.length === 0 && type3Gems.length === 0 && type4Gems.length === 0) {
        return [];
    }
    
    const t1 = type1Gems.length > 0 ? type1Gems : [null];
    const t3 = type3Gems.length > 0 ? type3Gems : [null];
    const t4 = type4Gems.length > 0 ? type4Gems : [null];

    const combinations = [];
    for (const g1 of t1) {
        for (const g3 of t3) {
            for (const g4 of t4) {
                combinations.push([g1, g3, g4].filter(Boolean));
            }
        }
    }

    if (combinations.length === 0) return [];

    let targetRarityVal = null;
    if (currentActiveRarities && currentActiveRarities.length > 0) {
         let sum = 0;
         currentActiveRarities.forEach(r => sum += rarityOrder[r]);
         targetRarityVal = Math.round(sum / currentActiveRarities.length);
    }

    combinations.forEach(combo => {
        let maxR = 0, minR = 99, sumR = 0;
        combo.forEach(g => {
            let val = rarityOrder[g.rarity];
            if (val > maxR) maxR = val;
            if (val < minR) minR = val;
            sumR += val;
        });
        
        let targetPenalty = 0;
        if (targetRarityVal !== null) {
             let avgR = sumR / combo.length;
             targetPenalty = Math.abs(avgR - targetRarityVal);
        }
        
        combo.span = combo.length <= 1 ? 0 : (maxR - minR);
        combo.sum = sumR;
        combo.targetPenalty = targetPenalty;
    });

    combinations.sort((a, b) => {
        if (a.length !== b.length) return b.length - a.length;
        if (a.span !== b.span) return a.span - b.span;
        
        if (targetRarityVal !== null) {
            if (Math.abs(a.targetPenalty - b.targetPenalty) > 0.01) {
                 return a.targetPenalty - b.targetPenalty;
            }
        }

        return b.sum - a.sum;
    });

    return combinations[0];
}

function extractOwOTargetName(textNode) {
    const strong = textNode.querySelector('strong');
    if (!strong) return '';
    const text = strong.textContent || '';
    const parts = text.split('|');
    if (parts.length > 1) {
        return parts[1].replace(/,$/, '').trim();
    }
    return '';
}

function isOwOMessageTargetingMe(textNode) {
    const targetName = extractOwOTargetName(textNode);
    if (!targetName) return false;

    const names = new Set();
    const userRoot = document.querySelector('section[class*="panels_"]');
    if (userRoot) {
        const nameTag = userRoot.querySelector('[class*="nameTag_"]');
        if (nameTag) {
            const elements = nameTag.querySelectorAll('div, span');
            elements.forEach(el => {
                const t = el.textContent?.trim();
                const ignored = ['online', 'idle', 'invisible', 'offline', 'do not disturb', 'streaming', 'trực tuyến', 'nhàn rỗi', 'không làm phiền'];
                if (t && t.length > 0 && el.children.length === 0 && !ignored.includes(t.toLowerCase())) {
                    names.add(t);
                }
            });
            const displaySpan = nameTag.querySelector('[data-username-with-effects]');
            if (displaySpan && displaySpan.getAttribute('data-username-with-effects')) {
                names.add(displaySpan.getAttribute('data-username-with-effects'));
            }
        }
    }

    if (names.has(targetName)) return true;

    for (const n of names) {
        if (targetName.includes(n) || n.includes(targetName)) return true;
    }

    return false;
}

window.poketwoProcessOwOMessage = function(messageNode) {
    const textNode = messageNode.querySelector('[id^="message-content-"]');
    if (!textNode) return;
    const text = textNode.textContent;

    if (text.includes("'s Inventory ======")) {
        const gems = [];
        const codes = textNode.querySelectorAll('code.inline');
        codes.forEach(codeNode => {
            const itemCode = codeNode.textContent.trim();
            let curr = codeNode.nextSibling;
            let altText = '';
            while (curr) {
                if (curr.nodeType === 1 && (curr.classList.contains('emojiContainer__75abc') || (curr.querySelector && curr.querySelector('.emoji')))) {
                    const img = curr.nodeName === 'IMG' ? curr : curr.querySelector('img.emoji');
                    if (img) altText = img.getAttribute('alt') || '';
                    curr = curr.nextSibling;
                    break;
                }
                curr = curr.nextSibling;
            }

            let countText = '';
            if (curr && curr.nodeType === Node.TEXT_NODE) {
                countText = curr.textContent;
            } else if (curr && curr.nodeName === 'SPAN') {
                countText = curr.textContent;
            }

            const count = parseSuperscriptCount(countText);
            if (altText && count > 0) {
                const match = altText.match(/:([a-z])gem(\d):/i);
                if (match) {
                    gems.push({
                        code: itemCode,
                        rarity: match[1].toLowerCase(),
                        type: parseInt(match[2], 10),
                        count: count
                    });
                }
            }
        });

        if (gems.length > 0) {
            const bestCombo = getBestGemCombination(gems, window.poketwoTargetGemRarities);
            const toUse = bestCombo.map(g => g.code);
            if (toUse.length > 0) {
                setTimeout(() => {
                    sendDiscordMessage(`ouse ${toUse.join(' ')}`);
                }, 1000);
            }
        }
    }

    const targetsMe = isOwOMessageTargetingMe(textNode);
    const isOwOResponse = text.includes('spent 5') && text.includes('caught a') && targetsMe;
    const isEmpowered = text.includes('hunt is empowered by') && targetsMe;

    if (isOwOResponse || isEmpowered) {
        let hasType1 = false, hasType3 = false, hasType4 = false;
        let hasZeroUses = false;
        
        if (isEmpowered) {
            const activeRarities = [];
            const imgs = textNode.querySelectorAll('img.emoji');
            imgs.forEach(img => {
                const alt = img.getAttribute('alt') || '';
                const match = alt.match(/:([a-z])gem(\d):/i);
                if (match) {
                    if (match[2] === '1') hasType1 = true;
                    if (match[2] === '3') hasType3 = true;
                    if (match[2] === '4') hasType4 = true;
                    activeRarities.push(match[1].toLowerCase());
                }
            });

            if (activeRarities.length > 0) {
                window.poketwoTargetGemRarities = activeRarities;
            }

            if (text.includes('[0/')) {
                hasZeroUses = true;
            }
        }

        const missingGems = !isEmpowered || !hasType1 || !hasType3 || !hasType4 || hasZeroUses;

        if (missingGems && isAutoHuntEnabled()) {
            const now = Date.now();
            if (now - lastGemCheckTime > GEM_CHECK_COOLDOWN_MS) {
                lastGemCheckTime = now;
                setTimeout(() => {
                    sendDiscordMessage('oinv');
                }, 1500);
            }
        }
    }
};
