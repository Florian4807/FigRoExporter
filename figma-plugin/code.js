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
let storedImageBytes = {};
function detectRobloxType(node) {
    const name = node.name.toLowerCase();
    const tags = name.split('_').slice(1);
    // Tag-based overrides ALWAYS win over Figma type
    if (tags.includes('ignore'))
        return { type: 'Ignored', color: '#666666' };
    if (tags.includes('canvas'))
        return { type: 'CanvasGroup', color: '#ff9f43' };
    if (tags.includes('image') || tags.includes('img'))
        return { type: 'ImageLabel', color: '#e6a817' };
    if (tags.includes('button') || tags.includes('btn')) {
        if (node.type === 'TEXT')
            return { type: 'TextButton', color: '#4488ff' };
        return { type: 'ImageButton', color: '#4488ff' };
    }
    if (tags.includes('scroll'))
        return { type: 'ScrollingFrame', color: '#aa55cc' };
    if (tags.includes('vpf'))
        return { type: 'ViewportFrame', color: '#cc8833' };
    if (tags.includes('textbox') || tags.includes('input'))
        return { type: 'TextBox', color: '#54a0ff' };
    if (node.type === 'TEXT')
        return { type: 'TextLabel', color: '#44cc88' };
    if (node.type === 'ELLIPSE')
        return { type: 'Frame (Circle)', color: '#888888' };
    if (node.type === 'VECTOR')
        return { type: 'ImageLabel (Vector)', color: '#e6a817' };
    if (node.type === 'GROUP')
        return { type: 'Frame (Group)', color: '#888888' };
    // Check for image fills
    if ('fills' in node) {
        const fills = node.fills;
        if (fills && fills.some(f => f.type === 'IMAGE')) {
            return { type: 'ImageLabel', color: '#e6a817' };
        }
    }
    return { type: 'Frame', color: '#888888' };
}
function buildHierarchy(node) {
    const detected = detectRobloxType(node);
    const result = {
        id: node.id,
        name: node.name,
        type: node.type,
        width: 'width' in node ? node.width : 0,
        height: 'height' in node ? node.height : 0,
        visible: 'visible' in node ? node.visible : true,
        tagType: detected.type,
        tagColor: detected.color,
        children: [],
    };
    if ('children' in node) {
        // Reverse children so visual order matches Figma's layer panel (topmost layer first)
        const children = node.children;
        for (let i = children.length - 1; i >= 0; i--) {
            result.children.push(buildHierarchy(children[i]));
        }
    }
    return result;
}
// ── Node Walking (for export) ───────────────────────────────────────
function walkNode(node_1) {
    return __awaiter(this, arguments, void 0, function* (node, parentAbsX = 0, parentAbsY = 0, parentW = 0, parentH = 0, settings = {}) {
        const absX = 'absoluteTransform' in node ? node.absoluteTransform[0][2] : 0;
        const absY = 'absoluteTransform' in node ? node.absoluteTransform[1][2] : 0;
        const relX = absX - parentAbsX;
        const relY = absY - parentAbsY;
        const nodeW = 'width' in node ? node.width : 0;
        const nodeH = 'height' in node ? node.height : 0;
        const isScrolling = node.type === 'FRAME' && node.clipsContent === true;
        const overflow = node.type === 'FRAME' ? node.overflowDirection : 'NONE';
        const name = node.name;
        const tags = name.split('_').slice(1).map(tag => tag.toLowerCase());
        if (tags.indexOf('ignore') !== -1) {
            return null;
        }
        const forceImage = tags.indexOf('image') !== -1;
        const isWhiteout = tags.indexOf('white') !== -1;
        // Also check if node has image fills (detected as ImageLabel in hierarchy)
        let hasImageFill = false;
        if ('fills' in node && Array.isArray(node.fills)) {
            const fills = node.fills;
            hasImageFill = fills.some(f => f.type === 'IMAGE' && f.visible !== false);
        }
        // If node has image fill OR _image tag, force export as flattened image
        const shouldExportAsImage = forceImage || hasImageFill;
        // Calculate scale values
        const scaleX = parentW > 0 ? relX / parentW : 0;
        const scaleY = parentH > 0 ? relY / parentH : 0;
        const scaleW = parentW > 0 ? nodeW / parentW : 0;
        const scaleH = parentH > 0 ? nodeH / parentH : 0;
        const base = {
            id: node.id,
            name: node.name,
            type: node.type,
            // Offset (pixel) values
            x: relX,
            y: relY,
            width: nodeW,
            height: nodeH,
            // Scale (relative) values
            scaleX: scaleX,
            scaleY: scaleY,
            scaleW: scaleW,
            scaleH: scaleH,
            parentWidth: parentW,
            parentHeight: parentH,
            opacity: 'opacity' in node ? node.opacity : 1,
            visible: 'visible' in node ? node.visible : true,
            rotation: 'rotation' in node ? node.rotation : 0,
            cornerRadius: 'cornerRadius' in node && typeof node.cornerRadius === 'number' ? node.cornerRadius : 0,
            fills: 'fills' in node && Array.isArray(node.fills) ? node.fills : [],
            strokes: 'strokes' in node && Array.isArray(node.strokes) ? node.strokes : [],
            strokeWeight: 'strokeWeight' in node && typeof node.strokeWeight === 'number' ? node.strokeWeight : 0,
            children: [],
            tags: tags,
            isImage: shouldExportAsImage,
            clipsContent: isScrolling,
            overflowDirection: overflow,
            applyAspectRatio: settings.applyAspectRatio || false,
        };
        if (node.type === 'TEXT') {
            const textNode = node;
            base.characters = textNode.characters;
            base.fontSize = textNode.fontSize;
            base.fontName = textNode.fontName;
            base.textAlignHorizontal = textNode.textAlignHorizontal;
            base.textAlignVertical = textNode.textAlignVertical;
            base.textScaled = true;
            base.textCase = textNode.textCase !== figma.mixed ? textNode.textCase : undefined;
            base.textColor = textNode.fills;
            try {
                const segments = textNode.getStyledTextSegments([
                    'fills',
                    'fontSize',
                    'fontWeight',
                    'fontName',
                    'textDecoration',
                    'textCase'
                ]);
                base.textSegments = [];
                let richText = "";
                for (const segment of segments) {
                    let segmentText = segment.characters;
                    // Apply text case
                    const rawCase = segment.textCase !== figma.mixed ? segment.textCase :
                        (textNode.textCase !== figma.mixed ? textNode.textCase : undefined);
                    const segmentCase = typeof rawCase === 'string' ? rawCase : undefined;
                    if (segmentCase === 'UPPER') {
                        segmentText = segmentText.toUpperCase();
                    }
                    else if (segmentCase === 'LOWER') {
                        segmentText = segmentText.toLowerCase();
                    }
                    else if (segmentCase === 'TITLE') {
                        segmentText = segmentText.replace(/\w\S*/g, function (txt) {
                            return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
                        });
                    }
                    // Escape XML entities
                    segmentText = segmentText.replace(/&/g, '&amp;')
                        .replace(/</g, '&lt;')
                        .replace(/>/g, '&gt;')
                        .replace(/"/g, '&quot;')
                        .replace(/'/g, '&apos;');
                    // Build segment data
                    const segmentData = {
                        characters: segment.characters,
                    };
                    let tagsStr = "";
                    if (segment.fills && segment.fills.length > 0) {
                        const fill = segment.fills[0];
                        if (fill.type === 'SOLID') {
                            const r = Math.round(fill.color.r * 255);
                            const g = Math.round(fill.color.g * 255);
                            const b = Math.round(fill.color.b * 255);
                            tagsStr += ` color="rgb(${r},${g},${b})"`;
                            segmentData.color = {
                                r: fill.color.r,
                                g: fill.color.g,
                                b: fill.color.b,
                                a: fill.opacity || 1
                            };
                        }
                    }
                    if (segment.fontSize !== textNode.fontSize) {
                        tagsStr += ` size="${Math.round(segment.fontSize)}"`;
                        segmentData.fontSize = segment.fontSize;
                    }
                    if (segment.fontWeight) {
                        segmentData.fontWeight = segment.fontWeight;
                    }
                    let wrapped = segmentText;
                    if (tagsStr)
                        wrapped = `<font${tagsStr}>${wrapped}</font>`;
                    if (segment.textDecoration === 'UNDERLINE') {
                        wrapped = `<u>${wrapped}</u>`;
                        segmentData.textDecoration = 'UNDERLINE';
                    }
                    else if (segment.textDecoration === 'STRIKETHROUGH') {
                        wrapped = `<s>${wrapped}</s>`;
                        segmentData.textDecoration = 'STRIKETHROUGH';
                    }
                    if (segmentCase) {
                        segmentData.textCase = segmentCase;
                    }
                    base.textSegments.push(segmentData);
                    richText += wrapped;
                }
                // Only set richText if there are actual style differences
                if (segments.length > 1) {
                    base.richText = richText;
                }
            }
            catch (e) {
                console.error("Rich text error:", e);
                base.richText = textNode.characters;
            }
        }
        // Capture stroke info for non-text nodes
        if (node.type !== 'TEXT' && 'strokeAlign' in node) {
            base.strokeAlign = node.strokeAlign;
            base.strokeJoin = node.strokeJoin;
        }
        // Forced Image / Whiteout Handling
        if (shouldExportAsImage || isWhiteout) {
            let exportNode = node;
            let clone = null;
            if (isWhiteout) {
                try {
                    clone = node.clone();
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
            return base;
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
                    storedImageBytes[base.imageFileName] = bytes;
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
                const childSchema = yield walkNode(child, absX, absY, nodeW, nodeH, settings);
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
// ── Roblox Upload (via Cloudflare proxy) ────────────────────────────
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
function extractAssetId(data) {
    if (data.done && data.response && data.response.assetId) {
        return `rbxassetid://${data.response.assetId}`;
    }
    if (data.assetId) {
        return `rbxassetid://${data.assetId}`;
    }
    if (data.done && data.response && data.response.path) {
        const match = data.response.path.match(/assets\/(\d+)/);
        if (match)
            return `rbxassetid://${match[1]}`;
    }
    if (data.response && data.response.assetId) {
        return `rbxassetid://${data.response.assetId}`;
    }
    return null;
}
function uploadToRoblox(fileName, bytes, apiKey, userId) {
    return __awaiter(this, void 0, void 0, function* () {
        const key = apiKey.trim();
        const url = 'https://figro-proxy.florian-10d.workers.dev/assets/v1/assets';
        const requestPayload = JSON.stringify({
            assetType: "Image",
            displayName: fileName.replace('.png', '').substring(0, 50),
            description: "Uploaded via FigmaToRoblox",
            creationContext: {
                creator: { userId: userId }
            }
        });
        const boundary = '----FigmaToRobloxBoundary' + Date.now();
        const body = buildMultipartBody(boundary, requestPayload, bytes, fileName);
        const headers = {
            'Content-Type': `multipart/form-data; boundary=${boundary}`
        };
        // OAuth tokens start with "eyJ", API keys start with "RBX-"
        if (key.startsWith('eyJ')) {
            headers['Authorization'] = `Bearer ${key}`;
            console.log(`[FigmaToRoblox] Using Bearer auth, key prefix: ${key.substring(0, 20)}...`);
        }
        else {
            headers['x-api-key'] = key;
            console.log(`[FigmaToRoblox] Using x-api-key, key prefix: ${key.substring(0, 20)}...`);
        }
        try {
            const response = yield fetch(url, {
                method: 'POST',
                headers: headers,
                body: body
            });
            if (!response.ok) {
                const text = yield response.text();
                console.error(`[FigmaToRoblox] Upload failed: ${response.status} ${text}`);
                figma.ui.postMessage({ type: 'log', message: `Upload failed: ${response.status} - Key starts with: ${key.substring(0, 10)}...`, logType: 'e' });
                return null;
            }
            const data = yield response.json();
            console.log(`[FigmaToRoblox] Upload response for ${fileName}:`, JSON.stringify(data));
            const assetId = extractAssetId(data);
            if (assetId)
                return assetId;
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
        const pollHeaders = {};
        if (key.startsWith('eyJ')) {
            pollHeaders['Authorization'] = `Bearer ${key}`;
        }
        else {
            pollHeaders['x-api-key'] = key;
        }
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            yield new Promise(r => setTimeout(r, 1000));
            try {
                const res = yield fetch(url, { headers: pollHeaders });
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
figma.showUI(__html__, { width: 1400, height: 900, themeColors: true });
let currentSchema = null;
let currentSectionId = null;
let currentSectionNode = null;
let highlightedNodeId = null;
let currentHierarchy = null;
// Auto-load saved settings
(() => __awaiter(void 0, void 0, void 0, function* () {
    const apiKey = (yield figma.clientStorage.getAsync('robloxApiKey')) || '';
    const userId = (yield figma.clientStorage.getAsync('robloxUserId')) || '';
    const robloxUsername = (yield figma.clientStorage.getAsync('robloxUsername')) || '';
    figma.ui.postMessage({ type: 'load-settings', apiKey, userId, robloxUsername });
}))();
// Send workspace sections (top-level frames on current page)
function sendSections() {
    const page = figma.currentPage;
    const sections = [];
    for (const child of page.children) {
        if (child.type === 'FRAME' || child.type === 'COMPONENT' || child.type === 'GROUP') {
            sections.push({
                id: child.id,
                name: child.name,
                width: 'width' in child ? child.width : 0,
                height: 'height' in child ? child.height : 0,
                childCount: 'children' in child ? child.children.length : 0,
            });
        }
    }
    figma.ui.postMessage({ type: 'sections-list', sections });
}
// Send selection details + hierarchy
function sendSelection() {
    const selection = figma.currentPage.selection;
    if (selection.length === 0) {
        figma.ui.postMessage({
            type: 'selection-change',
            selected: 0,
            valid: 0,
            hierarchy: null,
            selectedNode: null,
        });
        return;
    }
    const validRoots = ['FRAME', 'GROUP', 'COMPONENT', 'INSTANCE', 'SECTION', 'RECTANGLE'];
    let validCount = 0;
    for (const node of selection) {
        if (validRoots.indexOf(node.type) !== -1)
            validCount++;
    }
    const firstNode = selection[0];
    const isSectionRoot = selection.length === 1 && firstNode.id === currentSectionId;
    // If selecting the section root, rebuild hierarchy from it
    if (isSectionRoot) {
        currentHierarchy = buildHierarchy(firstNode);
    }
    else if (selection.length === 1 && currentSectionNode) {
        // User selected a child in Figma's canvas — find the section root and rebuild
        const selNode = selection[0];
        const absX = 'absoluteTransform' in selNode ? selNode.absoluteTransform[0][2] : 0;
        const absY = 'absoluteTransform' in selNode ? selNode.absoluteTransform[1][2] : 0;
        const rootAbsX = 'absoluteTransform' in currentSectionNode ? currentSectionNode.absoluteTransform[0][2] : 0;
        const rootAbsY = 'absoluteTransform' in currentSectionNode ? currentSectionNode.absoluteTransform[1][2] : 0;
        // If the selected node is inside the current section, rebuild hierarchy from section root
        if (Math.abs(absX - rootAbsX) < 1 && Math.abs(absY - rootAbsY) < 1) {
            currentHierarchy = buildHierarchy(currentSectionNode);
        }
    }
    // Selected node detail
    const selectedNode = selection.length === 1 ? Object.assign(Object.assign({ id: firstNode.id, name: firstNode.name, width: 'width' in firstNode ? firstNode.width : 0, height: 'height' in firstNode ? firstNode.height : 0 }, detectRobloxType(firstNode)), { figmaType: firstNode.type }) : null;
    figma.ui.postMessage({
        type: 'selection-change',
        selected: selection.length,
        valid: validCount,
        hierarchy: currentHierarchy,
        selectedNode,
        highlightedNodeId: selection.length === 1 ? firstNode.id : highlightedNodeId,
    });
    // Only export preview if this is the section root
    if (isSectionRoot && firstNode.width <= 3000 && firstNode.height <= 3000) {
        exportPreview(firstNode);
    }
}
function exportPreview(node) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const bytes = yield node.exportAsync({ format: 'PNG', constraint: { type: 'SCALE', value: 0.5 } });
            const base64 = figma.base64Encode(bytes);
            figma.ui.postMessage({
                type: 'preview-image',
                nodeId: node.id,
                nodeName: node.name,
                base64: `data:image/png;base64,${base64}`,
                sectionWidth: node.width,
                sectionHeight: node.height,
            });
        }
        catch (e) {
            // Preview export failed silently
        }
    });
}
figma.on("selectionchange", sendSelection);
figma.on("currentpagechange", sendSections);
// Initial sends
sendSections();
sendSelection();
figma.ui.onmessage = (msg) => __awaiter(void 0, void 0, void 0, function* () {
    if (msg.type === 'save-settings') {
        if (msg.apiKey !== undefined)
            yield figma.clientStorage.setAsync('robloxApiKey', msg.apiKey);
        if (msg.userId !== undefined)
            yield figma.clientStorage.setAsync('robloxUserId', msg.userId);
        if (msg.robloxUsername !== undefined)
            yield figma.clientStorage.setAsync('robloxUsername', msg.robloxUsername);
        if (msg.profiles !== undefined)
            yield figma.clientStorage.setAsync('robloxProfiles', msg.profiles);
        if (msg.activeProfile !== undefined)
            yield figma.clientStorage.setAsync('activeProfile', msg.activeProfile);
        return;
    }
    if (msg.type === 'load-profiles') {
        const profiles = (yield figma.clientStorage.getAsync('robloxProfiles')) || {};
        const activeProfile = (yield figma.clientStorage.getAsync('activeProfile')) || null;
        figma.ui.postMessage({ type: 'profiles-loaded', profiles, activeProfile });
        return;
    }
    if (msg.type === 'open-url') {
        console.log('Opening URL:', msg.url);
        figma.openExternal(msg.url);
        return;
    }
    if (msg.type === 'delete-profile') {
        const profiles = (yield figma.clientStorage.getAsync('robloxProfiles')) || {};
        delete profiles[msg.profileId];
        yield figma.clientStorage.setAsync('robloxProfiles', profiles);
        const activeProfile = (yield figma.clientStorage.getAsync('activeProfile')) || null;
        figma.ui.postMessage({ type: 'profiles-loaded', profiles, activeProfile });
        return;
    }
    if (msg.type === 'test-connection') {
        const { apiKey, userId } = msg;
        if (!apiKey || !userId) {
            figma.ui.postMessage({ type: 'connection-result', success: false, error: 'Missing API key or User ID' });
            return;
        }
        try {
            const headers = {};
            if (apiKey.startsWith('eyJ')) {
                headers['Authorization'] = `Bearer ${apiKey.trim()}`;
            }
            else {
                headers['x-api-key'] = apiKey.trim();
            }
            const res = yield fetch(`https://figro-proxy.florian-10d.workers.dev/assets/v1/assets?assetType=Image&limit=1`, {
                method: 'GET',
                headers,
            });
            if (res.ok) {
                figma.ui.postMessage({
                    type: 'connection-result',
                    success: true,
                    userId,
                });
            }
            else {
                const text = yield res.text();
                figma.ui.postMessage({ type: 'connection-result', success: false, error: `API error: ${res.status} ${text}` });
            }
        }
        catch (err) {
            figma.ui.postMessage({ type: 'connection-result', success: false, error: 'Connection failed' });
        }
        return;
    }
    if (msg.type === 'clear-cache') {
        yield figma.clientStorage.deleteAsync('uploadCache');
        figma.notify("Upload cache cleared.");
        figma.ui.postMessage({ type: 'log', message: 'Upload cache cleared.' });
        return;
    }
    if (msg.type === 'reset-settings') {
        yield figma.clientStorage.deleteAsync('robloxApiKey');
        yield figma.clientStorage.deleteAsync('robloxUserId');
        yield figma.clientStorage.deleteAsync('robloxUsername');
        figma.notify("Settings reset.");
        figma.ui.postMessage({ type: 'log', message: 'Settings reset.' });
        return;
    }
    if (msg.type === 'logout') {
        yield figma.clientStorage.deleteAsync('robloxUserId');
        yield figma.clientStorage.deleteAsync('robloxUsername');
        figma.ui.postMessage({ type: 'logged-out' });
        figma.notify("Logged out.");
        return;
    }
    // ── Section Selection ─────────────────────────────────────────
    if (msg.type === 'select-section') {
        const node = figma.getNodeById(msg.sectionId);
        if (node && ('children' in node)) {
            currentSectionId = msg.sectionId;
            currentSectionNode = node;
            highlightedNodeId = null;
            figma.currentPage.selection = [node];
        }
        return;
    }
    // ── Select child node by ID ───────────────────────────────────
    if (msg.type === 'select-node') {
        const node = figma.getNodeById(msg.nodeId);
        if (node) {
            highlightedNodeId = msg.nodeId;
            figma.currentPage.selection = [node];
            // Get node position relative to the section root
            let relX = 0, relY = 0;
            if ('absoluteTransform' in node) {
                const absX = node.absoluteTransform[0][2];
                const absY = node.absoluteTransform[1][2];
                if (currentSectionNode && 'absoluteTransform' in currentSectionNode) {
                    const rootX = currentSectionNode.absoluteTransform[0][2];
                    const rootY = currentSectionNode.absoluteTransform[1][2];
                    relX = absX - rootX;
                    relY = absY - rootY;
                }
            }
            figma.ui.postMessage({
                type: 'node-highlighted',
                nodeId: msg.nodeId,
                nodeName: node.name,
                relX,
                relY,
                nodeWidth: 'width' in node ? node.width : 0,
                nodeHeight: 'height' in node ? node.height : 0,
                hierarchy: currentHierarchy,
            });
        }
        return;
    }
    // ── Apply tags to selected nodes ──────────────────────────────
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
        figma.ui.postMessage({ type: 'log', message: `Applied tags: ${tagStr}` });
        // Refresh selection to update hierarchy
        setTimeout(sendSelection, 100);
        return;
    }
    // ── Set node type (single tag shortcut) ───────────────────────
    if (msg.type === 'set-node-type') {
        const { nodeId, robloxType } = msg;
        const node = figma.getNodeById(nodeId);
        if (!node)
            return;
        // Remove existing type tags (be more comprehensive)
        const typeTags = ['_image', '_button', '_button_image', '_scroll', '_ignore', '_vpf', '_canvas', '_abs', '_hover', '_clicked', '_toggled', '_disabled', '_parent', '_scrollx', '_lock'];
        let cleanName = node.name;
        // Remove all type tags at once with a single regex
        const tagRegex = new RegExp('(_image|_button|_button_image|_scroll|_ignore|_vpf|_canvas|_abs|_hover|_clicked|_toggled|_disabled|_parent|_scrollx|_lock)', 'gi');
        cleanName = cleanName.replace(tagRegex, '');
        cleanName = cleanName.replace(/#/g, '').trim();
        // Remove any duplicate underscores
        cleanName = cleanName.replace(/_+/g, '_').replace(/^_|_$/g, '');
        // Map Roblox type to tag
        const typeToTag = {
            'Frame': '',
            'CanvasGroup': '_canvas',
            'TextLabel': '',
            'TextButton': '_button',
            'TextBox': '',
            'ImageLabel': '_image',
            'ImageButton': '_button_image',
            'ScrollingFrame': '_scroll',
            'ViewportFrame': '_vpf',
            'Ignored': '_ignore',
        };
        const tag = typeToTag[robloxType] || '';
        // Apply the tag to the Figma node name
        node.name = cleanName + (tag ? '_' + tag.replace(/_/g, '') : '');
        figma.notify(`Set "${cleanName}" → ${robloxType}`);
        figma.ui.postMessage({ type: 'log', message: `Set "${cleanName}" → ${robloxType}` });
        // Force Figma to process the name change before rebuilding hierarchy
        figma.root.children; // Touch the tree
        // Rebuild hierarchy from the section root and send it to the UI
        if (currentSectionNode) {
            currentHierarchy = buildHierarchy(currentSectionNode);
            figma.ui.postMessage({
                type: 'hierarchy-updated',
                hierarchy: currentHierarchy,
                selectedNodeId: nodeId,
            });
        }
        return;
    }
    // ── Reset tags ────────────────────────────────────────────────
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
                newName = newName.replace(new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig'), '');
            }
            node.name = newName.trim();
        };
        if (scope === 'selection') {
            for (const root of selection)
                resetNode(root);
            figma.notify("Reset tags on selection.");
            figma.ui.postMessage({ type: 'log', message: 'Reset tags on selection.' });
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
            figma.ui.postMessage({ type: 'log', message: 'Reset tags on children.' });
        }
        setTimeout(sendSelection, 100);
        return;
    }
    // ── Export ─────────────────────────────────────────────────────
    if (msg.type === 'export') {
        const selection = figma.currentPage.selection;
        if (selection.length !== 1) {
            figma.notify("Please select exactly one node to export.");
            figma.ui.postMessage({ type: 'log', message: 'Error: Select exactly one node.' });
            return;
        }
        const validRoots = ['FRAME', 'GROUP', 'COMPONENT', 'INSTANCE', 'SECTION', 'RECTANGLE'];
        if (validRoots.indexOf(selection[0].type) === -1) {
            figma.notify(`Please select a Frame, Group, Component, or Rectangle. You selected: ${selection[0].type}`);
            figma.ui.postMessage({ type: 'log', message: `Error: Invalid type ${selection[0].type}` });
            return;
        }
        const rootNode = selection[0];
        figma.notify("Exporting...");
        figma.ui.postMessage({ type: 'log', message: `Exporting "${rootNode.name}"...` });
        imageCounter = 0;
        imageList = [];
        storedImageBytes = {};
        // Export settings from UI
        const exportSettings = {
            positionMode: msg.positionMode || 'scale',
            applyAspectRatio: msg.applyAspectRatio || false,
        };
        const rootSchema = yield walkNode(rootNode, 0, 0, 0, 0, exportSettings);
        currentSchema = {
            figmaVersion: "1.0",
            rootWidth: rootNode.width,
            rootHeight: rootNode.height,
            positionMode: exportSettings.positionMode,
            applyAspectRatio: exportSettings.applyAspectRatio,
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
    // ── Start Uploads ─────────────────────────────────────────────
    if (msg.type === 'start-uploads') {
        const { apiKey, userId } = msg;
        const imageNames = Object.keys(storedImageBytes);
        const total = imageNames.length;
        const assetMap = {};
        let uploadCache = (yield figma.clientStorage.getAsync('uploadCache')) || {};
        let skippedCount = 0;
        const batchSize = 5;
        for (let batchStart = 0; batchStart < total; batchStart += batchSize) {
            const batch = imageNames.slice(batchStart, batchStart + batchSize);
            const uploadPromises = batch.map((name) => __awaiter(void 0, void 0, void 0, function* () {
                const bytes = storedImageBytes[name];
                // Cache by filename - if same image filename was uploaded before, reuse the asset ID
                if (uploadCache[name]) {
                    assetMap[name] = uploadCache[name];
                    skippedCount++;
                    figma.ui.postMessage({ type: 'upload-progress', status: `Cached: ${name}` });
                    figma.ui.postMessage({ type: 'log', message: `Cached: ${name} → ${uploadCache[name]}` });
                    return null;
                }
                figma.ui.postMessage({ type: 'upload-progress', status: `Uploading: ${name}` });
                figma.ui.postMessage({ type: 'log', message: `Uploading: ${name}` });
                const assetId = yield uploadToRoblox(name, bytes, apiKey, userId);
                if (assetId) {
                    assetMap[name] = assetId;
                    uploadCache[name] = assetId;
                    figma.ui.postMessage({ type: 'log', message: `Uploaded: ${name} → ${assetId}` });
                }
                else {
                    figma.ui.postMessage({ type: 'upload-progress', status: `Failed: ${name}` });
                    figma.ui.postMessage({ type: 'log', message: `Failed: ${name}` });
                }
                return null;
            }));
            yield Promise.all(uploadPromises);
        }
        yield figma.clientStorage.setAsync('uploadCache', uploadCache);
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
        console.log('[FigmaToRoblox] Asset map:', JSON.stringify(assetMap));
        figma.ui.postMessage({
            type: 'log',
            message: `Done! ${Object.keys(assetMap).length}/${total} uploaded, ${skippedCount} cached. Assets: ${JSON.stringify(assetMap)}`
        });
        storedImageBytes = {};
    }
    // ── Refresh sections ──────────────────────────────────────────
    if (msg.type === 'refresh-sections') {
        sendSections();
        return;
    }
});
