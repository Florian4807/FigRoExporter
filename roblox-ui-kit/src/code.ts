// figma plugin logic
figma.showUI(__html__, { width: 340, height: 750, themeColors: true });

interface PluginState {
    canvasId: string | null;
    canvasW: number;
    canvasH: number;
}

let state: PluginState = {
    canvasId: null,
    canvasW: 1920,
    canvasH: 1080
};

// Start logic
async function init() {
    // Read cached state
    const cached = await figma.clientStorage.getAsync('roblox_ui_state');
    if (cached) {
        state = { ...state, ...cached };
    }
    scanForCanvas();

    // Attempt loading standard inter fonts proactively
    try {
        await Promise.all([
            figma.loadFontAsync({ family: "Inter", style: "Regular" }),
            figma.loadFontAsync({ family: "Inter", style: "Bold" })
        ]);
    } catch (e) { }
}

function scanForCanvas() {
    // Look for RobloxCanvas_
    const p = figma.currentPage;
    let found = false;
    for (const node of p.children) {
        if (node.type === 'FRAME' && node.name.startsWith('RobloxCanvas_')) {
            state.canvasId = node.id;
            state.canvasW = node.width;
            state.canvasH = node.height;
            found = true;
            break;
        }
    }
    if (!found) state.canvasId = null;
    syncUI();
}

function saveState() {
    figma.clientStorage.setAsync('roblox_ui_state', state);
}

function syncUI() {
    figma.ui.postMessage({ type: 'stateUpdate', state });
}

function getCanvas(): FrameNode | null {
    if (!state.canvasId) return null;
    const node = figma.getNodeById(state.canvasId);
    if (node && node.type === 'FRAME') return node as FrameNode;
    state.canvasId = null;
    return null;
}

// Helper for converting hex color #RRGGBB to figma RGB {r, g, b} (0-1)
function hexToRgb(hex: string) {
    let r = 0, g = 0, b = 0;
    if (hex.length === 7) {
        r = parseInt(hex.substring(1, 3), 16) / 255;
        g = parseInt(hex.substring(3, 5), 16) / 255;
        b = parseInt(hex.substring(5, 7), 16) / 255;
    }
    return { r, g, b };
}

figma.ui.onmessage = msg => {
    if (msg.type === 'create-canvas') {
        const p = figma.currentPage;
        const frame = figma.createFrame();
        frame.name = `RobloxCanvas_${msg.w}x${msg.h}`;
        frame.resize(msg.w, msg.h);
        frame.x = 0;
        frame.y = 0;
        frame.fills = [{ type: 'SOLID', color: { r: 0.1, g: 0.1, b: 0.15 } }];
        frame.clipsContent = true;
        p.appendChild(frame);

        state.canvasId = frame.id;
        state.canvasW = msg.w;
        state.canvasH = msg.h;
        saveState();
        syncUI();
    } else if (msg.type === 'spawn-frame') {
        const cvs = getCanvas();
        if (!cvs) {
            figma.notify("No Canvas found. Create one first.");
            return;
        }

        const f = figma.createFrame();
        f.name = `${msg.fType}_`;

        let fw = msg.w;
        let fh = msg.h;
        if (msg.mode === '%') {
            fw = (msg.w / 100) * state.canvasW;
            fh = (msg.h / 100) * state.canvasH;
        }
        f.resize(fw, fh);

        // Apply styling
        if (msg.radius !== undefined) f.cornerRadius = msg.radius;
        if (msg.fillHex) {
            f.fills = [{ type: 'SOLID', color: hexToRgb(msg.fillHex) }];
        }
        if (msg.strokeColor && msg.strokeWeight > 0) {
            f.strokes = [{ type: 'SOLID', color: hexToRgb(msg.strokeColor) }];
            f.strokeWeight = msg.strokeWeight;
        } else {
            f.strokes = [];
            f.strokeWeight = 0;
        }

        // positioning based on anchor inside cvs
        calculateAndApplyAnchor(f, fw, fh, msg.ax, msg.ay, state.canvasW, state.canvasH);

        f.setPluginData('isRobloxFrame', 'true');
        f.setPluginData('anchorX', msg.ax);
        f.setPluginData('anchorY', msg.ay);
        f.setPluginData('fillHex', msg.fillHex || '#333333');
        if (msg.mode === '%') {
            f.setPluginData('percentW', msg.w.toString());
            f.setPluginData('percentH', msg.h.toString());
            f.setPluginData('sizeMode', '%');
        } else {
            f.setPluginData('sizeMode', 'px');
        }

        cvs.appendChild(f);
        figma.currentPage.selection = [f];
    } else if (msg.type === 'spawn-text') {
        const cvs = getCanvas();
        if (!cvs) { figma.notify("Need a Canvas first."); return; }

        const t = figma.createText();
        t.characters = msg.textContent || "TextLabel";
        t.name = `${msg.tType}_`;

        let fw = msg.w; let fh = msg.h;
        if (msg.mode === '%') {
            fw = (msg.w / 100) * state.canvasW;
            fh = (msg.h / 100) * state.canvasH;
        }
        t.resize(fw, fh);

        if (msg.textColorHex) {
            t.fills = [{ type: 'SOLID', color: hexToRgb(msg.textColorHex) }];
        }

        if (msg.textSize) {
            t.fontSize = msg.textSize;
        }

        t.textAlignHorizontal = "CENTER";
        t.textAlignVertical = "CENTER";

        // positioning
        calculateAndApplyAnchor(t, fw, fh, msg.ax, msg.ay, state.canvasW, state.canvasH);

        t.setPluginData('isRobloxFrame', 'true');
        t.setPluginData('isText', 'true');

        var targetParent = figma.currentPage.selection[0] || cvs;
        if (targetParent.type === 'FRAME' || targetParent.type === 'COMPONENT') {
            (targetParent as FrameNode).appendChild(t);
        } else {
            cvs.appendChild(t);
        }

        figma.currentPage.selection = [t];
    } else if (msg.type === 'toggle-safezone') {
        const cvs = getCanvas();
        if (!cvs) return;
        let existing = cvs.findChild(n => n.name === 'SafeZone_ignore');
        if (existing) {
            if (!msg.enabled) existing.remove();
        } else if (msg.enabled) {
            const sz = figma.createFrame();
            sz.name = 'SafeZone_ignore';
            sz.resize(state.canvasW, state.canvasH - 72);
            sz.y = 72;
            sz.x = 0;
            sz.fills = [];
            sz.strokes = [{ type: 'SOLID', color: { r: 0, g: 1, b: 0 }, opacity: 0.5 }];
            sz.strokeWeight = 2;
            sz.clipsContent = true;
            sz.locked = true;
            sz.setPluginData('isRobloxFrame', 'true');
            cvs.appendChild(sz);
        }
    } else if (msg.type === 'update-selected') {
        const sel = figma.currentPage.selection[0];
        if (sel && sel.type === 'FRAME' && sel.getPluginData('isRobloxFrame')) {
            const cvs = getCanvas();
            if (!cvs) return;

            let fw = msg.w;
            let fh = msg.h;
            if (msg.mode === '%') {
                fw = (msg.w / 100) * state.canvasW;
                fh = (msg.h / 100) * state.canvasH;
                sel.setPluginData('percentW', msg.w.toString());
                sel.setPluginData('percentH', msg.h.toString());
            }
            sel.resize(fw, fh);
            sel.setPluginData('sizeMode', msg.mode);

            // Handle new styling
            if (msg.radius !== undefined) sel.cornerRadius = msg.radius;
            if (msg.fillHex) {
                sel.fills = [{ type: 'SOLID', color: hexToRgb(msg.fillHex) }];
                sel.setPluginData('fillHex', msg.fillHex);
            }
            if (msg.strokeColor && msg.strokeWeight > 0) {
                sel.strokes = [{ type: 'SOLID', color: hexToRgb(msg.strokeColor) }];
                sel.strokeWeight = msg.strokeWeight;
                sel.setPluginData('strokeColor', msg.strokeColor);
            } else if (msg.strokeWeight === 0) {
                sel.strokes = [];
                sel.strokeWeight = 0;
                sel.setPluginData('strokeColor', '');
            }

            if (msg.ax && msg.ay) {
                sel.setPluginData('anchorX', msg.ax);
                sel.setPluginData('anchorY', msg.ay);
                calculateAndApplyAnchor(sel, fw, fh, msg.ax, msg.ay, state.canvasW, state.canvasH);
            }
        }
    } else if (msg.type === 'nudge-selected') {
        const sel = figma.currentPage.selection[0];
        if (sel && sel.type === 'FRAME' && sel.getPluginData('isRobloxFrame')) {
            sel.x += msg.dx;
            sel.y += msg.dy;
        }
    } else if (msg.type === 'center-selected') {
        const sel = figma.currentPage.selection[0];
        if (sel && sel.type === 'FRAME' && sel.getPluginData('isRobloxFrame')) {
            const cvs = getCanvas();
            if (!cvs) return;
            if (msg.dir === 'H' || msg.dir === 'HV') sel.x = (state.canvasW - sel.width) / 2;
            if (msg.dir === 'V' || msg.dir === 'HV') sel.y = (state.canvasH - sel.height) / 2;
        }
    } else if (msg.type === 'quick-action') {
        const sel = figma.currentPage.selection[0];
        if (sel && sel.type === 'FRAME' && sel.getPluginData('isRobloxFrame')) {
            const cvs = getCanvas();
            if (!cvs) return;

            if (msg.action === 'fill') {
                const p = sel.parent;
                if (p && p.type === 'FRAME') {
                    sel.resize(p.width, p.height);
                    sel.x = 0; sel.y = 0;
                    sel.setPluginData('percentW', '100');
                    sel.setPluginData('percentH', '100');
                    sel.setPluginData('sizeMode', '%');
                }
            } else if (msg.action === 'listlayout') {
                sel.name = sel.name.includes('UIListLayout') ? sel.name.replace('_UIListLayout', '') : sel.name + '_UIListLayout';
                sel.layoutMode = sel.layoutMode === "NONE" ? "VERTICAL" : "NONE";
                figma.notify(sel.layoutMode !== "NONE" ? "Added UIListLayout" : "Removed UIListLayout");
            } else if (msg.action === 'aspectratio') {
                sel.name = sel.name.includes('UIAspectRatio') ? sel.name.replace('_UIAspectRatio', '') : sel.name + '_UIAspectRatio';
                figma.notify("Toggled AspectRatio tag");
            }
        }
    }
};

function calculateAndApplyAnchor(node: SceneNode, w: number, h: number, ax: string, ay: string, cw: number, ch: number) {
    if (ax === 'left') node.x = 0;
    else if (ax === 'center') node.x = (cw - w) / 2;
    else if (ax === 'right') node.x = cw - w;

    if (ay === 'top') node.y = 0;
    else if (ay === 'center') node.y = (ch - h) / 2;
    else if (ay === 'bottom') node.y = ch - h;
}

figma.on('selectionchange', () => {
    const sel = figma.currentPage.selection[0];
    if (sel && sel.type === 'FRAME' && sel.getPluginData('isRobloxFrame')) {
        let mode = sel.getPluginData('sizeMode') || 'px';
        let w = sel.width;
        let h = sel.height;
        if (mode === '%') {
            w = parseFloat(sel.getPluginData('percentW') || "0");
            h = parseFloat(sel.getPluginData('percentH') || "0");
        }
        figma.ui.postMessage({
            type: 'selectionUpdate',
            active: true,
            w, h, mode,
            ax: sel.getPluginData('anchorX'),
            ay: sel.getPluginData('anchorY'),
            radius: typeof sel.cornerRadius === 'number' ? sel.cornerRadius : 0,
            fillHex: sel.getPluginData('fillHex') || '#333333',
            strokeColor: sel.getPluginData('strokeColor') || '#ffffff',
            strokeWeight: sel.strokeWeight || 0
        });
    } else {
        figma.ui.postMessage({ type: 'selectionUpdate', active: false });
    }
});

// Run init
init();
