"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
function sanitizeName(name) {
    return name.replace(/[^a-zA-Z0-9]/g, '_');
}
function padIndex(index) {
    return index < 10 ? '00' + index : index < 100 ? '0' + index : String(index);
}
let imageCounter = 0;
let imageList = [];
// Store image bytes in the main thread so we can upload from here (no CORS)
let storedImageBytes = {};
function walkNode(node_1) {
    return __awaiter(this, arguments, void 0, function* (node, parentAbsX = 0, parentAbsY = 0) {
        const absX = 'absoluteTransform' in node ? node.absoluteTransform[0][2] : 0;
        const absY = 'absoluteTransform' in node ? node.absoluteTransform[1][2] : 0;
        const relX = absX - parentAbsX;
        const relY = absY - parentAbsY;
        const isScrolling = node.type === 'FRAME' && node.clipsContent === true;
        const overflow = node.type === 'FRAME' ? node.overflowDirection : 'NONE';
        const name = node.name;
        const tags = name.split('_').slice(1).map(tag => tag.toLowerCase());
        // Check for _ignore
        if (tags.indexOf('ignore') !== -1) {
            return null;
        }
        const forceImage = tags.indexOf('image') !== -1;
        const isWhiteout = tags.indexOf('white') !== -1;
        const base = {
            id: node.id,
            name: node.name,
            type: node.type,
            x: relX,
            y: relY,
            width: 'width' in node ? node.width : 0,
            height: 'height' in node ? node.height : 0,
            opacity: 'opacity' in node ? node.opacity : 1,
            visible: 'visible' in node ? node.visible : true,
            rotation: 'rotation' in node ? node.rotation : 0,
            cornerRadius: 'cornerRadius' in node && typeof node.cornerRadius === 'number' ? node.cornerRadius : 0,
            fills: 'fills' in node && Array.isArray(node.fills) ? node.fills : [],
            strokes: 'strokes' in node && Array.isArray(node.strokes) ? node.strokes : [],
            strokeWeight: 'strokeWeight' in node && typeof node.strokeWeight === 'number' ? node.strokeWeight : 0,
            children: [],
            tags: tags,
            isImage: forceImage,
            clipsContent: isScrolling,
            overflowDirection: overflow,
        };
        if (node.type === 'TEXT') {
            const textNode = node;
            base.characters = textNode.characters;
            base.fontSize = textNode.fontSize;
            base.fontName = textNode.fontName;
            base.textAlignHorizontal = textNode.textAlignHorizontal;
            base.textAlignVertical = textNode.textAlignVertical;
            base.textScaled = true;
            try {
                const segments = textNode.getStyledTextSegments([
                    'fills',
                    'fontSize',
                    'fontName',
                    'textDecoration',
                    'textCase'
                ]);
                let richText = "";
                for (const segment of segments) {
                    let segmentText = segment.characters;
                    segmentText = segmentText.replace(/&/g, '&amp;')
                        .replace(/</g, '&lt;')
                        .replace(/>/g, '&gt;')
                        .replace(/"/g, '&quot;')
                        .replace(/'/g, '&apos;');
                    let tagsStr = "";
                    if (segment.fills && segment.fills.length > 0) {
                        const fill = segment.fills[0];
                        if (fill.type === 'SOLID') {
                            const r = Math.round(fill.color.r * 255);
                            const g = Math.round(fill.color.g * 255);
                            const b = Math.round(fill.color.b * 255);
                            tagsStr += ` color="rgb(${r},${g},${b})"`;
                        }
                    }
                    if (segment.fontSize !== textNode.fontSize) {
                        tagsStr += ` size="${Math.round(segment.fontSize)}"`;
                    }
                    let wrapped = segmentText;
                    if (tagsStr)
                        wrapped = `<font${tagsStr}>${wrapped}</font>`;
                    if (segment.textDecoration === 'UNDERLINE')
                        wrapped = `<u>${wrapped}</u>`;
                    if (segment.textDecoration === 'STRIKETHROUGH')
                        wrapped = `<s>${wrapped}</s>`;
                    richText += wrapped;
                }
                base.richText = richText;
            }
            catch (e) {
                console.error("Rich text error:", e);
                base.richText = textNode.characters;
            }
        }
        // Forced Image / Whiteout Handling
        if (forceImage || isWhiteout) {
            let exportNode = node;
            let clone = null;
            if (isWhiteout) {
                try {
                    clone = node.clone();
                    // Find all children and the node itself and set their fills to white
                    const nodesToWhite = [clone, ...(clone.findAll ? clone.findAll(() => true) : [])];
                    for (const n of nodesToWhite) {
                        if ('fills' in n) {
                            n.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
                        }
                    }
                    exportNode = clone;
                }
                catch (e) {
                    console.error("Whiteout clone failed:", e);
                }
            }
            const bytes = yield exportNode.exportAsync({ format: 'PNG', constraint: { type: 'SCALE', value: 2 } });
            const imageId = padIndex(imageCounter++);
            const fileName = `${imageId}__${sanitizeName(node.name)}.png`;
            storedImageBytes[fileName] = bytes;
            base.isImage = true;
            base.imageFileName = fileName;
            base.assetId = imageId;
            base.imageIndex = imageList.length;
            imageList.push({ index: base.imageIndex, fileName });
            if (clone)
                clone.remove();
            return base; // Skip children if forced to image
        }
        if (node.type === 'FRAME' && node.layoutMode !== 'NONE') {
            const f = node;
            base.autoLayout = {
                direction: f.layoutMode,
                spacing: f.itemSpacing,
                paddingTop: f.paddingTop,
                paddingBottom: f.paddingBottom,
                paddingLeft: f.paddingLeft,
                paddingRight: f.paddingRight,
                primaryAxisAlign: f.primaryAxisAlignItems,
                counterAxisAlign: f.counterAxisAlignItems,
                wrap: f.layoutWrap,
            };
            base.primaryAxisSizingMode = f.primaryAxisSizingMode;
        }
        if ('fills' in node && Array.isArray(node.fills)) {
            const fills = node.fills;
            const strokes = 'strokes' in node && Array.isArray(node.strokes) ? node.strokes : [];
            const hasComplexFill = fills.some(f => f.type !== 'SOLID' && f.type !== 'GRADIENT_LINEAR' && f.visible !== false);
            const hasComplexStroke = strokes.some(f => f.type !== 'SOLID' && f.type !== 'GRADIENT_LINEAR' && f.visible !== false);
            const effects = 'effects' in node && Array.isArray(node.effects) ? node.effects : [];
            const hasVisibleEffects = effects.some(e => e.visible);
            const exportSettings = 'exportSettings' in node && Array.isArray(node.exportSettings) ? node.exportSettings : [];
            const userWantsFlattenedImage = exportSettings.length > 0 && node.type !== 'TEXT';
            if (userWantsFlattenedImage || (node.type !== 'TEXT' && (hasComplexFill || hasComplexStroke || hasVisibleEffects))) {
                const imageId = padIndex(imageCounter);
                base.isImage = true;
                base.imageIndex = imageCounter;
                base.assetId = imageId;
                base.imageFileName = `${imageId}__${sanitizeName(node.name)}.png`;
                imageList.push({ index: imageCounter, fileName: base.imageFileName });
                imageCounter++;
                try {
                    const bytes = yield node.exportAsync({ format: 'PNG' });
                    // Store bytes in main thread for CORS-free upload later
                    storedImageBytes[base.imageFileName] = bytes;
                    // Notify UI that we found an image (for progress display only)
                    figma.ui.postMessage({ type: 'image-found', name: base.imageFileName, size: bytes.length });
                }
                catch (e) {
                    console.error(`Failed to export image for ${node.name}:`, e);
                }
                if (userWantsFlattenedImage) {
                    return base;
                }
            }
        }
        let maxX = 0;
        let maxY = 0;
        if ('children' in node) {
            for (const child of node.children) {
                const childSchema = yield walkNode(child, absX, absY);
                if (childSchema) {
                    base.children.push(childSchema);
                    if (base.clipsContent) {
                        maxX = Math.max(maxX, childSchema.x + childSchema.width);
                        maxY = Math.max(maxY, childSchema.y + childSchema.height);
                    }
                }
            }
        }
        if (base.clipsContent) {
            base.contentWidth = maxX;
            base.contentHeight = maxY;
        }
        return base;
    });
}
// ── Roblox Upload (via local CORS proxy at localhost:3001) ─────────
// Simple FNV-1a hash for deduplication
function hashBytes(bytes) {
    let h = 0x811c9dc5;
    for (let i = 0; i < bytes.length; i++) {
        h ^= bytes[i];
        h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(16);
}
function sanitizeKey(raw) {
    return raw.replace(/[^\x20-\x7E]/g, '');
}
function stringToBytes(str) {
    const bytes = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) {
        bytes[i] = str.charCodeAt(i) & 0xFF;
    }
    return bytes;
}
function buildMultipartBody(boundary, requestJson, fileBytes, fileName) {
    const crlf = '\r\n';
    const requestPart = stringToBytes(`--${boundary}${crlf}` +
        `Content-Disposition: form-data; name="request"${crlf}` +
        `Content-Type: application/json${crlf}${crlf}` +
        requestJson + crlf);
    const fileHeader = stringToBytes(`--${boundary}${crlf}` +
        `Content-Disposition: form-data; name="fileContent"; filename="${fileName}"${crlf}` +
        `Content-Type: image/png${crlf}${crlf}`);
    const fileFooter = stringToBytes(`${crlf}--${boundary}--${crlf}`);
    const body = new Uint8Array(requestPart.length + fileHeader.length + fileBytes.length + fileFooter.length);
    body.set(requestPart, 0);
    body.set(fileHeader, requestPart.length);
    body.set(fileBytes, requestPart.length + fileHeader.length);
    body.set(fileFooter, requestPart.length + fileHeader.length + fileBytes.length);
    return body;
}
// Extract asset ID from various Roblox API response formats
function extractAssetId(data) {
    // Format 1: { done: true, response: { assetId: "12345" } }
    if (data.done && data.response && data.response.assetId) {
        return `rbxassetid://${data.response.assetId}`;
    }
    // Format 2: { assetId: "12345" } (direct)
    if (data.assetId) {
        return `rbxassetid://${data.assetId}`;
    }
    // Format 3: { done: true, response: { path: "assets/12345" } }
    if (data.done && data.response && data.response.path) {
        const match = data.response.path.match(/assets\/(\d+)/);
        if (match)
            return `rbxassetid://${match[1]}`;
    }
    // Format 4: { response: { assetId: "12345" } } (no done field)
    if (data.response && data.response.assetId) {
        return `rbxassetid://${data.response.assetId}`;
    }
    return null;
}
function uploadToRoblox(fileName, bytes, apiKey, userId) {
    return __awaiter(this, void 0, void 0, function* () {
        const key = sanitizeKey(apiKey);
        const url = 'https://figro-proxy.florian-10d.workers.dev/assets/v1/assets';
        const requestPayload = JSON.stringify({
            assetType: "Decal",
            displayName: fileName.replace('.png', '').substring(0, 50),
            description: "Uploaded via FigmaToRoblox",
            creationContext: {
                creator: { userId: userId }
            }
        });
        const boundary = '----FigmaToRobloxBoundary' + Date.now();
        const body = buildMultipartBody(boundary, requestPayload, bytes, fileName);
        try {
            const response = yield fetch(url, {
                method: 'POST',
                headers: {
                    'x-api-key': key,
                    'Content-Type': `multipart/form-data; boundary=${boundary}`
                },
                body: body
            });
            if (!response.ok) {
                const text = yield response.text();
                console.error(`[FigmaToRoblox] Upload failed: ${response.status} ${text}`);
                return null;
            }
            const data = yield response.json();
            console.log(`[FigmaToRoblox] Upload response for ${fileName}:`, JSON.stringify(data));
            const assetId = extractAssetId(data);
            if (assetId)
                return assetId;
            // Not done yet — need to poll
            if (data.path && data.path.startsWith('operations/')) {
                return yield pollOperation(key, data.path);
            }
            console.warn('[FigmaToRoblox] Could not extract assetId from response:', JSON.stringify(data));
            return null;
        }
        catch (err) {
            console.error('[FigmaToRoblox] Upload error:', err);
            return null;
        }
    });
}
function pollOperation(key, operationPath) {
    return __awaiter(this, void 0, void 0, function* () {
        const url = `https://figro-proxy.florian-10d.workers.dev/assets/v1/${operationPath}`;
        const maxAttempts = 15;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            yield new Promise(r => setTimeout(r, 2000));
            try {
                const res = yield fetch(url, { headers: { 'x-api-key': key } });
                const data = yield res.json();
                console.log(`[FigmaToRoblox] Poll attempt ${attempt}:`, JSON.stringify(data));
                if (data.done) {
                    const assetId = extractAssetId(data);
                    if (assetId)
                        return assetId;
                    console.warn('[FigmaToRoblox] Operation done but no assetId found:', JSON.stringify(data));
                    return null;
                }
                figma.ui.postMessage({ type: 'upload-progress', status: `Processing... (attempt ${attempt}/${maxAttempts})` });
            }
            catch (e) {
                console.error('[FigmaToRoblox] Polling error:', e);
            }
        }
        return null;
    });
}
function hydrateSchemaWithAssetIds(node, assetMap) {
    if (node.isImage && node.imageFileName) {
        const mappedId = assetMap[node.imageFileName];
        node.assetId = mappedId || '';
    }
    if (node.children) {
        for (const child of node.children) {
            hydrateSchemaWithAssetIds(child, assetMap);
        }
    }
}
// ── Plugin UI & Message Handling ───────────────────────────────────
figma.showUI(__html__, { width: 400, height: 620, themeColors: true });
let currentSchema = null;
// Auto-load saved settings when plugin opens
(() => __awaiter(void 0, void 0, void 0, function* () {
    const apiKey = (yield figma.clientStorage.getAsync('robloxApiKey')) || '';
    const userId = (yield figma.clientStorage.getAsync('robloxUserId')) || '';
    figma.ui.postMessage({ type: 'load-settings', apiKey, userId });
}))();
function sendSelection() {
    const selection = figma.currentPage.selection;
    let validCount = 0;
    const validRoots = ['FRAME', 'GROUP', 'COMPONENT', 'INSTANCE', 'SECTION', 'RECTANGLE'];
    for (const node of selection) {
        if (validRoots.indexOf(node.type) !== -1) {
            validCount++;
        }
    }
    figma.ui.postMessage({ type: 'selection-change', selected: selection.length, valid: validCount });
}
figma.on("selectionchange", sendSelection);
figma.ui.onmessage = (msg) => __awaiter(void 0, void 0, void 0, function* () {
    if (msg.type === 'save-settings') {
        if (msg.apiKey !== undefined)
            yield figma.clientStorage.setAsync('robloxApiKey', msg.apiKey);
        if (msg.userId !== undefined)
            yield figma.clientStorage.setAsync('robloxUserId', msg.userId);
        return;
    }
    if (msg.type === 'clear-cache') {
        yield figma.clientStorage.deleteAsync('uploadCache');
        figma.notify("Upload cache cleared.");
        return;
    }
    if (msg.type === 'reset-settings') {
        yield figma.clientStorage.deleteAsync('robloxApiKey');
        yield figma.clientStorage.deleteAsync('robloxUserId');
        figma.notify("Settings reset.");
        return;
    }
    if (msg.type === 'apply-tags') {
        const { tags, applyToDescendants } = msg;
        if (!tags || tags.length === 0)
            return;
        const selection = figma.currentPage.selection;
        if (selection.length === 0) {
            figma.notify("Select at least one layer to apply tags.");
            return;
        }
        const tagStr = tags.join('');
        const applyToNode = (node) => {
            node.name = node.name + tagStr;
            if (applyToDescendants && 'children' in node) {
                for (const child of node.children) {
                    applyToNode(child);
                }
            }
        };
        for (const root of selection) {
            applyToNode(root);
        }
        figma.notify(`Applied tags: ${tagStr}`);
        return;
    }
    if (msg.type === 'reset-tags') {
        const scope = msg.scope;
        const selection = figma.currentPage.selection;
        if (selection.length === 0) {
            figma.notify("Select at least one layer to reset tags.");
            return;
        }
        const knownTags = ['#', '_image', '_button', '_scroll', '_lock', '_ignore', '_hover', '_clicked', '_toggled', '_disabled', '_parent', '_scrollx', '_abs', '_vpf', '_canvas'];
        const resetNode = (node) => {
            let newName = node.name;
            for (const t of knownTags) {
                // global ignorecase replace
                newName = newName.replace(new RegExp(t, 'ig'), '');
            }
            node.name = newName.trim();
        };
        if (scope === 'selection') {
            for (const root of selection)
                resetNode(root);
            figma.notify("Reset tags on selection.");
        }
        else if (scope === 'children') {
            for (const root of selection) {
                if ('children' in root) {
                    const allChildren = root.findAll ? root.findAll(() => true) : [];
                    for (const child of allChildren)
                        resetNode(child);
                }
            }
            figma.notify("Reset tags on children.");
        }
        return;
    }
    if (msg.type === 'export') {
        const selection = figma.currentPage.selection;
        if (selection.length !== 1) {
            figma.notify("Please select exactly one node to export.");
            return;
        }
        const validRoots = ['FRAME', 'GROUP', 'COMPONENT', 'INSTANCE', 'SECTION', 'RECTANGLE'];
        if (validRoots.indexOf(selection[0].type) === -1) {
            figma.notify(`Please select a Frame, Group, Component, or Rectangle. You selected: ${selection[0].type}`);
            return;
        }
        const rootNode = selection[0];
        figma.notify("Exporting...");
        imageCounter = 0;
        imageList = [];
        storedImageBytes = {};
        const rootSchema = yield walkNode(rootNode);
        currentSchema = {
            figmaVersion: "1.0",
            rootWidth: rootNode.width,
            rootHeight: rootNode.height,
            imageOrder: imageList.map(img => img.fileName),
            root: rootSchema
        };
        if (msg.isZipMode) {
            figma.ui.postMessage({
                type: 'export-complete',
                schema: currentSchema,
                isZipMode: true,
                images: storedImageBytes
            });
        }
        else {
            figma.ui.postMessage({
                type: 'export-complete',
                schema: currentSchema,
                imageCount: imageList.length,
                apiKey: msg.apiKey,
                userId: msg.userId
            });
        }
    }
    if (msg.type === 'start-uploads') {
        const { apiKey, userId } = msg;
        const imageNames = Object.keys(storedImageBytes);
        const total = imageNames.length;
        const assetMap = {};
        // Load existing upload cache
        let uploadCache = (yield figma.clientStorage.getAsync('uploadCache')) || {};
        let skippedCount = 0;
        for (let i = 0; i < total; i++) {
            const name = imageNames[i];
            const bytes = storedImageBytes[name];
            const hash = hashBytes(bytes);
            // Check cache first
            if (uploadCache[hash]) {
                assetMap[name] = uploadCache[hash];
                skippedCount++;
                figma.ui.postMessage({ type: 'upload-progress', status: `✓ Cached: ${name} (${i + 1}/${total})` });
                continue;
            }
            figma.ui.postMessage({ type: 'upload-progress', status: `Uploading: ${name} (${i + 1}/${total})` });
            const assetId = yield uploadToRoblox(name, bytes, apiKey, userId);
            if (assetId) {
                assetMap[name] = assetId;
                uploadCache[hash] = assetId;
            }
            else {
                figma.ui.postMessage({ type: 'upload-progress', status: `⚠ Failed: ${name}` });
            }
        }
        // Save updated cache
        yield figma.clientStorage.setAsync('uploadCache', uploadCache);
        // Hydrate schema with asset IDs
        if (currentSchema) {
            hydrateSchemaWithAssetIds(currentSchema.root, assetMap);
        }
        figma.ui.postMessage({
            type: 'uploads-complete',
            schema: currentSchema,
            successCount: Object.keys(assetMap).length,
            totalCount: total,
            skippedCount: skippedCount
        });
        // Free memory
        storedImageBytes = {};
    }
});
