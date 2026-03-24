function sanitizeName(name: string): string {
    return name.replace(/[^a-zA-Z0-9]/g, '_');
}

function padIndex(index: number): string {
    return index < 10 ? '00' + index : index < 100 ? '0' + index : String(index);
}

interface NodeSchema {
    id: string;
    name: string;
    type: string;
    x: number;
    y: number;
    width: number;
    height: number;
    opacity: number;
    visible: boolean;
    rotation: number;
    cornerRadius: number;
    children: NodeSchema[];
    fills: readonly Paint[];
    strokes: readonly Paint[];
    strokeWeight: number;

    characters?: string;
    fontSize?: number;
    fontName?: FontName;
    fontWeight?: string;
    textAlignHorizontal?: string;
    textAlignVertical?: string;
    textColor?: readonly Paint[];

    isImage: boolean;
    imageFileName?: string;
    imageIndex?: number;
    assetId?: string;
    // Phase 2: Scrolling & Layout
    clipsContent?: boolean;
    overflowDirection?: string;
    contentWidth?: number;
    contentHeight?: number;
    textScaled?: boolean;

    autoLayout?: {
        direction: string;
        spacing: number;
        paddingTop: number;
        paddingBottom: number;
        paddingLeft: number;
        paddingRight: number;
        primaryAxisAlign: string;
        counterAxisAlign: string;
        wrap: string;
    };
    primaryAxisSizingMode?: string;
    tags: string[];
    richText?: string;
}

let imageCounter = 0;
let imageList: { index: number, fileName: string }[] = [];
// Store image bytes in the main thread so we can upload from here (no CORS)
let storedImageBytes: { [name: string]: Uint8Array } = {};

async function walkNode(node: SceneNode, parentAbsX: number = 0, parentAbsY: number = 0): Promise<NodeSchema | null> {
    const absX = 'absoluteTransform' in node ? node.absoluteTransform[0][2] : 0;
    const absY = 'absoluteTransform' in node ? node.absoluteTransform[1][2] : 0;

    const relX = absX - parentAbsX;
    const relY = absY - parentAbsY;

    const isScrolling = node.type === 'FRAME' && (node as FrameNode).clipsContent === true;
    const overflow = node.type === 'FRAME' ? (node as FrameNode).overflowDirection : 'NONE';

    const name = node.name;
    const tags = name.split('_').slice(1).map(tag => tag.toLowerCase());

    // Check for _ignore
    if (tags.indexOf('ignore') !== -1) {
        return null;
    }

    const forceImage = tags.indexOf('image') !== -1;
    const isWhiteout = tags.indexOf('white') !== -1;

    const base: NodeSchema = {
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
        cornerRadius: 'cornerRadius' in node && typeof (node as any).cornerRadius === 'number' ? (node as any).cornerRadius : 0,
        fills: 'fills' in node && Array.isArray((node as any).fills) ? (node as any).fills : [],
        strokes: 'strokes' in node && Array.isArray((node as any).strokes) ? (node as any).strokes : [],
        strokeWeight: 'strokeWeight' in node && typeof (node as any).strokeWeight === 'number' ? (node as any).strokeWeight : 0,
        children: [],
        tags: tags,
        isImage: forceImage,
        clipsContent: isScrolling,
        overflowDirection: overflow,
    };

    if (node.type === 'TEXT') {
        const textNode = node as TextNode;
        base.characters = textNode.characters;
        base.fontSize = textNode.fontSize as number;
        base.fontName = textNode.fontName as FontName;
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

                if (segment.fills && (segment.fills as Paint[]).length > 0) {
                    const fill = (segment.fills as Paint[])[0];
                    if (fill.type === 'SOLID') {
                        const r = Math.round(fill.color.r * 255);
                        const g = Math.round(fill.color.g * 255);
                        const b = Math.round(fill.color.b * 255);
                        tagsStr += ` color="rgb(${r},${g},${b})"`;
                    }
                }

                if (segment.fontSize !== textNode.fontSize) {
                    tagsStr += ` size="${Math.round(segment.fontSize as number)}"`;
                }

                let wrapped = segmentText;
                if (tagsStr) wrapped = `<font${tagsStr}>${wrapped}</font>`;
                if (segment.textDecoration === 'UNDERLINE') wrapped = `<u>${wrapped}</u>`;
                if (segment.textDecoration === 'STRIKETHROUGH') wrapped = `<s>${wrapped}</s>`;

                richText += wrapped;
            }
            base.richText = richText;
        } catch (e) {
            console.error("Rich text error:", e);
            base.richText = textNode.characters;
        }
    }


    // Forced Image / Whiteout Handling
    if (forceImage || isWhiteout) {
        let exportNode = node;
        let clone: SceneNode | null = null;

        if (isWhiteout) {
            try {
                clone = node.clone();
                // Find all children and the node itself and set their fills to white
                const nodesToWhite = [clone, ...((clone as any).findAll ? (clone as any).findAll(() => true) : [])];
                for (const n of nodesToWhite) {
                    if ('fills' in n) {
                        n.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
                    }
                }
                exportNode = clone;
            } catch (e) {
                console.error("Whiteout clone failed:", e);
            }
        }

        const bytes = await exportNode.exportAsync({ format: 'PNG', constraint: { type: 'SCALE', value: 2 } });
        const imageId = padIndex(imageCounter++);
        const fileName = `${imageId}__${sanitizeName(node.name)}.png`;
        storedImageBytes[fileName] = bytes;

        base.isImage = true;
        base.imageFileName = fileName;
        base.assetId = imageId;
        base.imageIndex = imageList.length;
        imageList.push({ index: base.imageIndex, fileName });

        if (clone) clone.remove();
        return base; // Skip children if forced to image
    }

    if (node.type === 'FRAME' && (node as FrameNode).layoutMode !== 'NONE') {
        const f = node as FrameNode;
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

    if ('fills' in node && Array.isArray((node as any).fills)) {
        const fills = (node as any).fills as ReadonlyArray<Paint>;
        const strokes = 'strokes' in node && Array.isArray((node as any).strokes) ? (node as any).strokes as ReadonlyArray<Paint> : [];

        const hasComplexFill = fills.some(f => f.type !== 'SOLID' && f.type !== 'GRADIENT_LINEAR' && f.visible !== false);
        const hasComplexStroke = strokes.some(f => f.type !== 'SOLID' && f.type !== 'GRADIENT_LINEAR' && f.visible !== false);

        const effects = 'effects' in node && Array.isArray((node as any).effects) ? (node as any).effects as ReadonlyArray<Effect> : [];
        const hasVisibleEffects = effects.some(e => e.visible);

        const exportSettings = 'exportSettings' in node && Array.isArray((node as any).exportSettings) ? (node as any).exportSettings as ReadonlyArray<ExportSettings> : [];
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
                const bytes = await node.exportAsync({ format: 'PNG' });
                // Store bytes in main thread for CORS-free upload later
                storedImageBytes[base.imageFileName] = bytes;
                // Notify UI that we found an image (for progress display only)
                figma.ui.postMessage({ type: 'image-found', name: base.imageFileName, size: bytes.length });
            } catch (e) {
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
        for (const child of (node as any).children) {
            const childSchema = await walkNode(child, absX, absY);
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
}

// ── Roblox Upload (via local CORS proxy at localhost:3001) ─────────

// Simple FNV-1a hash for deduplication
function hashBytes(bytes: Uint8Array): string {
    let h = 0x811c9dc5;
    for (let i = 0; i < bytes.length; i++) {
        h ^= bytes[i];
        h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(16);
}

function sanitizeKey(raw: string): string {
    return raw.replace(/[^\x20-\x7E]/g, '');
}

function stringToBytes(str: string): Uint8Array {
    const bytes = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) {
        bytes[i] = str.charCodeAt(i) & 0xFF;
    }
    return bytes;
}

function buildMultipartBody(boundary: string, requestJson: string, fileBytes: Uint8Array, fileName: string): Uint8Array {
    const crlf = '\r\n';

    const requestPart = stringToBytes(
        `--${boundary}${crlf}` +
        `Content-Disposition: form-data; name="request"${crlf}` +
        `Content-Type: application/json${crlf}${crlf}` +
        requestJson + crlf
    );

    const fileHeader = stringToBytes(
        `--${boundary}${crlf}` +
        `Content-Disposition: form-data; name="fileContent"; filename="${fileName}"${crlf}` +
        `Content-Type: image/png${crlf}${crlf}`
    );

    const fileFooter = stringToBytes(`${crlf}--${boundary}--${crlf}`);

    const body = new Uint8Array(requestPart.length + fileHeader.length + fileBytes.length + fileFooter.length);
    body.set(requestPart, 0);
    body.set(fileHeader, requestPart.length);
    body.set(fileBytes, requestPart.length + fileHeader.length);
    body.set(fileFooter, requestPart.length + fileHeader.length + fileBytes.length);

    return body;
}

// Extract asset ID from various Roblox API response formats
function extractAssetId(data: any): string | null {
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
        if (match) return `rbxassetid://${match[1]}`;
    }
    // Format 4: { response: { assetId: "12345" } } (no done field)
    if (data.response && data.response.assetId) {
        return `rbxassetid://${data.response.assetId}`;
    }
    return null;
}

async function uploadToRoblox(fileName: string, bytes: Uint8Array, apiKey: string, userId: string): Promise<string | null> {
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
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'x-api-key': key,
                'Content-Type': `multipart/form-data; boundary=${boundary}`
            },
            body: body
        });

        if (!response.ok) {
            const text = await response.text();
            console.error(`[FigmaToRoblox] Upload failed: ${response.status} ${text}`);
            return null;
        }

        const data = await response.json();
        console.log(`[FigmaToRoblox] Upload response for ${fileName}:`, JSON.stringify(data));

        const assetId = extractAssetId(data);
        if (assetId) return assetId;

        // Not done yet — need to poll
        if (data.path && data.path.startsWith('operations/')) {
            return await pollOperation(key, data.path);
        }

        console.warn('[FigmaToRoblox] Could not extract assetId from response:', JSON.stringify(data));
        return null;
    } catch (err) {
        console.error('[FigmaToRoblox] Upload error:', err);
        return null;
    }
}

async function pollOperation(key: string, operationPath: string): Promise<string | null> {
    const url = `https://figro-proxy.florian-10d.workers.dev/assets/v1/${operationPath}`;
    const maxAttempts = 15;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        await new Promise(r => setTimeout(r, 2000));
        try {
            const res = await fetch(url, { headers: { 'x-api-key': key } });
            const data = await res.json();
            console.log(`[FigmaToRoblox] Poll attempt ${attempt}:`, JSON.stringify(data));
            if (data.done) {
                const assetId = extractAssetId(data);
                if (assetId) return assetId;
                console.warn('[FigmaToRoblox] Operation done but no assetId found:', JSON.stringify(data));
                return null;
            }
            figma.ui.postMessage({ type: 'upload-progress', status: `Processing... (attempt ${attempt}/${maxAttempts})` });
        } catch (e) {
            console.error('[FigmaToRoblox] Polling error:', e);
        }
    }
    return null;
}

function hydrateSchemaWithAssetIds(node: any, assetMap: { [name: string]: string }) {
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

let currentSchema: any = null;

// Auto-load saved settings when plugin opens
(async () => {
    const apiKey = await figma.clientStorage.getAsync('robloxApiKey') || '';
    const userId = await figma.clientStorage.getAsync('robloxUserId') || '';
    figma.ui.postMessage({ type: 'load-settings', apiKey, userId });
})();

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

figma.ui.onmessage = async (msg) => {
    if (msg.type === 'save-settings') {
        if (msg.apiKey !== undefined) await figma.clientStorage.setAsync('robloxApiKey', msg.apiKey);
        if (msg.userId !== undefined) await figma.clientStorage.setAsync('robloxUserId', msg.userId);
        return;
    }

    if (msg.type === 'clear-cache') {
        await figma.clientStorage.deleteAsync('uploadCache');
        figma.notify("Upload cache cleared.");
        return;
    }

    if (msg.type === 'reset-settings') {
        await figma.clientStorage.deleteAsync('robloxApiKey');
        await figma.clientStorage.deleteAsync('robloxUserId');
        figma.notify("Settings reset.");
        return;
    }

    if (msg.type === 'apply-tags') {
        const { tags, applyToDescendants } = msg;
        if (!tags || tags.length === 0) return;

        const selection = figma.currentPage.selection;
        if (selection.length === 0) {
            figma.notify("Select at least one layer to apply tags.");
            return;
        }

        const tagStr = tags.join('');

        const applyToNode = (node: SceneNode) => {
            node.name = node.name + tagStr;
            if (applyToDescendants && 'children' in node) {
                for (const child of (node as any).children) {
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

        const resetNode = (node: SceneNode) => {
            let newName = node.name;
            for (const t of knownTags) {
                // global ignorecase replace
                newName = newName.replace(new RegExp(t, 'ig'), '');
            }
            node.name = newName.trim();
        };

        if (scope === 'selection') {
            for (const root of selection) resetNode(root);
            figma.notify("Reset tags on selection.");
        } else if (scope === 'children') {
            for (const root of selection) {
                if ('children' in root) {
                    const allChildren = (root as any).findAll ? (root as any).findAll(() => true) : [];
                    for (const child of allChildren) resetNode(child);
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

        const rootSchema = await walkNode(rootNode);

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
        } else {
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
        const assetMap: { [name: string]: string } = {};

        // Load existing upload cache
        let uploadCache: { [hash: string]: string } = (await figma.clientStorage.getAsync('uploadCache')) || {};

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

            const assetId = await uploadToRoblox(name, bytes, apiKey, userId);
            if (assetId) {
                assetMap[name] = assetId;
                uploadCache[hash] = assetId;
            } else {
                figma.ui.postMessage({ type: 'upload-progress', status: `⚠ Failed: ${name}` });
            }
        }

        // Save updated cache
        await figma.clientStorage.setAsync('uploadCache', uploadCache);

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
};
