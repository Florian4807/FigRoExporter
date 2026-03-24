# FigmaToRoblox Plugin — Overview

## What This Is

A two-part plugin system that bridges Figma UI design directly into Roblox Studio. The user designs a UI in Figma, configures their Roblox Open Cloud API key, and exports it with the Figma plugin (getting a single JSON schema). The plugin automatically uploads all flattened images to Roblox natively and embeds the returned Asset IDs. The user then pastes the JSON into the Roblox plugin to instantly reconstruct the exact UI under StarterGui.

---

## Repository Structure

```
figma-to-roblox/
├── figma-plugin/
│   ├── manifest.json         # Figma plugin manifest
│   ├── code.ts               # Plugin backend (runs in Figma sandbox)
│   └── ui.html               # Plugin UI (iframe, has DOM access)
│
└── roblox-plugin/
    └── FigmaImporter.lua     # Single Lua script, loaded as a Studio Plugin
```

---

## Part 1: Figma Plugin

**Language:** TypeScript (compiled to JS) + HTML/CSS/JS for the UI panel  
**API:** Figma Plugin API (`figma.*`) + Roblox Open Cloud Assets API  
**Dependencies:** JSZip (optional/legacy, transitioning to pure JSON output)

### How It Works

1. User selects a Frame in Figma and clicks "Export" in the plugin panel.
2. `code.ts` receives the trigger via `figma.ui.onmessage`.
3. It calls a recursive `walkNode(node)` function starting from the selected frame.
4. For each node it records a JSON object (see Schema below).
5. Nodes of type `IMAGE` or `RECTANGLE` with an image fill are exported as PNG bytes via `node.exportAsync({ format: 'PNG' })`.
6. All data is sent to `ui.html` via `figma.ui.postMessage({ json, images })`.
7. `ui.html` sends each image payload to `https://apis.roblox.com/assets/v1/assets` using the user's provided Open Cloud API Key.
8. `ui.html` receives the `rbxassetid://` strings back and splices them into the respective nodes in the JSON structure.
9. `ui.html` displays the final baked JSON in a textarea (user can copy it or save it as `layout.json`).

### manifest.json

```json
{
  "name": "FigmaToRoblox",
  "id": "figma-to-roblox-plugin",
  "api": "1.0.0",
  "main": "code.js",
  "ui": "ui.html",
  "editorType": ["figma"]
}
```

### Node Walking Logic (`code.ts`)

```typescript
async function walkNode(node: SceneNode): Promise<NodeSchema> {
  const base = {
    id: node.id,
    name: node.name,
    type: node.type,        // "FRAME", "TEXT", "RECTANGLE", "ELLIPSE", "GROUP", "VECTOR", etc.
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    opacity: node.opacity,
    visible: node.visible,
    rotation: node.rotation,
    cornerRadius: 'cornerRadius' in node ? node.cornerRadius : 0,
    children: [],
    fills: 'fills' in node ? node.fills : [],
    strokes: 'strokes' in node ? node.strokes : [],
    strokeWeight: 'strokeWeight' in node ? node.strokeWeight : 0,
    // TEXT-specific
    characters: node.type === 'TEXT' ? node.characters : undefined,
    fontSize: node.type === 'TEXT' ? node.fontSize : undefined,
    fontName: node.type === 'TEXT' ? node.fontName : undefined,
    fontWeight: node.type === 'TEXT' ? node.fontWeight : undefined,
    textAlignHorizontal: node.type === 'TEXT' ? node.textAlignHorizontal : undefined,
    textAlignVertical: node.type === 'TEXT' ? node.textAlignVertical : undefined,
    textColor: node.type === 'TEXT' ? node.fills : undefined,
    // IMAGE flag
    isImage: false,
    imageFileName: undefined as string | undefined,
  };

  // Detect image fills
  if ('fills' in node) {
    const imageFill = (node.fills as Paint[]).find(f => f.type === 'IMAGE');
    if (imageFill) {
      base.isImage = true;
      base.imageFileName = `${sanitizeName(node.name)}.png`;
      // Export bytes — sent separately in the images map
    }
  }

  // Recurse
  if ('children' in node) {
    for (const child of node.children) {
      base.children.push(await walkNode(child));
    }
  }

  return base;
}
```

Image bytes are collected in a `Map<string, Uint8Array>` keyed by `imageFileName` and sent alongside the JSON.

### ui.html Responsibilities

- Receive `postMessage` from `code.ts`
- Display JSON in scrollable `<textarea>` with a Copy button
- "Download ZIP" button:
  - Uses JSZip: `import JSZip from 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'`
  - Adds each PNG from the images map: `zip.file(name, uint8array)`
  - Adds `layout.json`: `zip.file('layout.json', JSON.stringify(schema, null, 2))`
  - Triggers browser download via a blob URL

---

## Part 2: Roblox Studio Plugin

**Language:** Luau (Roblox's Lua dialect)  
**API:** Roblox Plugin API, `game:GetService("HttpService")`, `Instance.new()`  
**Entry point:** `FigmaImporter.lua` — installed as a Studio Plugin (place in `%LOCALAPPDATA%\Roblox\Plugins\` or publish via Studio)

### How It Works

1. A toolbar button opens a `PluginGui` docked panel.
2. Panel contains a `TextBox` (paste JSON here) and an "Import" button.
3. On click, the script JSON-decodes the pasted string.
4. It reads the `layout.json` root node and begins recursive UI construction.
5. All images are already embedded in the JSON as `rbxassetid://` references (generated by Figma's Open Cloud API calls).
6. The reconstructed UI is placed under `game.StarterGui` as a `ScreenGui`.

### JSON → Roblox Instance Mapping

| JSON `type`              | Roblox Instance     | Notes                                      |
|--------------------------|---------------------|--------------------------------------------|
| `FRAME`                  | `Frame`             | BackgroundColor from fills                 |
| `RECTANGLE` (no image)   | `Frame`             | Same as FRAME                              |
| `RECTANGLE` (isImage)    | `ImageLabel`        | Image set directly to `assetId` string     |
| `TEXT`                   | `TextLabel`         | Text, font, size, color mapped             |
| `ELLIPSE`                | `Frame` + `UICorner`| CornerRadius set to `UDim.new(1, 0)`       |
| `GROUP` / `VECTOR`       | `Frame`             | Transparent background, recurse children   |

### Coordinate Conversion

Figma uses absolute pixel coordinates. Roblox uses scale-based `UDim2`.

```lua
-- rootW, rootH = width/height of the top-level Frame node
local function toUDim2Size(node, parentW, parentH)
    return UDim2.new(node.width / parentW, 0, node.height / parentH, 0)
end

local function toUDim2Position(node, parentW, parentH)
    return UDim2.new(node.x / parentW, 0, node.y / parentH, 0)
end
```

Each recursive call passes the **parent node's** width and height as the coordinate space, not the root's.

### Color Conversion

Figma fills use `{ r, g, b }` in 0–1 range. Roblox uses `Color3`.

```lua
local function figmaColorToColor3(fill)
    if fill and fill.type == "SOLID" and fill.color then
        return Color3.new(fill.color.r, fill.color.g, fill.color.b)
    end
    return Color3.new(1, 1, 1)
end
```

### UICorner

Applied whenever `cornerRadius > 0`:

```lua
local corner = Instance.new("UICorner")
corner.CornerRadius = UDim.new(0, node.cornerRadius)
corner.Parent = obj
```

### UIAspectRatioConstraint

Applied to the **root ScreenGui Frame only** (the top-level Figma frame), preserving the original aspect ratio on any screen size:

```lua
local arc = Instance.new("UIAspectRatioConstraint")
arc.AspectRatio = rootNode.width / rootNode.height
arc.AspectType = Enum.AspectType.FitWithinMaxSize
arc.DominantAxis = Enum.DominantAxis.Width
arc.Parent = rootFrame
```

### Image Uploading

PNGs are automatically uploaded to your Roblox account / universe strictly via the **Roblox Open Cloud API**. Users submit an API key once in the Figma plugin:
1. `ui.html` packages each raw image buffer as `multipart/form-data`.
2. Figma performs the request and tracks the `assetId`.
3. The generated `id` lives directly in `node.assetId` for instant hydration in Studio!

### Full Recursive Builder (Pseudocode)

```lua
local function buildUI(node, parentInstance, parentW, parentH)
    local obj

    if node.type == "TEXT" then
        obj = Instance.new("TextLabel")
        obj.Text = node.characters or ""
        obj.TextSize = node.fontSize or 14
        obj.TextColor3 = figmaColorToColor3(node.textColor and node.textColor[1])
        obj.BackgroundTransparency = 1
        obj.TextXAlignment = mapTextAlign(node.textAlignHorizontal)
        obj.Font = Enum.Font.GothamMedium  -- map fontWeight if needed
    elseif node.isImage then
        obj = Instance.new("ImageLabel")
        obj.Image = node.assetId or ""
        obj.BackgroundTransparency = 1
        obj.ScaleType = Enum.ScaleType.Fit
    elseif node.type == "ELLIPSE" then
        obj = Instance.new("Frame")
        local corner = Instance.new("UICorner")
        corner.CornerRadius = UDim.new(1, 0)
        corner.Parent = obj
    else
        obj = Instance.new("Frame")
    end

    obj.Name = node.name
    obj.Size = toUDim2Size(node, parentW, parentH)
    obj.Position = toUDim2Position(node, parentW, parentH)
    obj.Visible = node.visible ~= false
    obj.BackgroundTransparency = 1 - (node.opacity or 1)

    if obj:IsA("Frame") or obj:IsA("ImageLabel") then
        local fill = node.fills and node.fills[1]
        if fill and fill.type == "SOLID" then
            obj.BackgroundColor3 = figmaColorToColor3(fill)
            obj.BackgroundTransparency = 1 - ((fill.opacity or 1) * (node.opacity or 1))
        end
    end

    if node.cornerRadius and node.cornerRadius > 0 and not node.type == "ELLIPSE" then
        local corner = Instance.new("UICorner")
        corner.CornerRadius = UDim.new(0, node.cornerRadius)
        corner.Parent = obj
    end

    obj.Parent = parentInstance

    if node.children then
        for _, child in ipairs(node.children) do
            buildUI(child, obj, node.width, node.height)
        end
    end
end
```

---

## JSON Schema (`layout.json`)

```jsonc
{
  "figmaVersion": "1.0",
  "rootWidth": 1920,
  "rootHeight": 1080,
  "root": {
    "id": "1:2",
    "name": "MainMenu",
    "type": "FRAME",
    "x": 0,
    "y": 0,
    "width": 1920,
    "height": 1080,
    "opacity": 1,
    "visible": true,
    "rotation": 0,
    "cornerRadius": 0,
    "isImage": false,
    "fills": [{ "type": "SOLID", "color": { "r": 0.1, "g": 0.1, "b": 0.1 }, "opacity": 1 }],
    "strokes": [],
    "strokeWeight": 0,
    "children": [
      {
        "id": "1:3",
        "name": "Title",
        "type": "TEXT",
        "x": 100,
        "y": 50,
        "width": 400,
        "height": 60,
        "opacity": 1,
        "visible": true,
        "rotation": 0,
        "cornerRadius": 0,
        "isImage": false,
        "characters": "Hello World",
        "fontSize": 48,
        "fontName": { "family": "Inter", "style": "Bold" },
        "textAlignHorizontal": "CENTER",
        "textAlignVertical": "CENTER",
        "textColor": [{ "type": "SOLID", "color": { "r": 1, "g": 1, "b": 1 }, "opacity": 1 }],
        "fills": [],
        "strokes": [],
        "strokeWeight": 0,
        "children": []
      }
    ]
  }
}
```

---

## Key Implementation Notes

- **Name sanitization:** Both plugins must use the same name sanitization function (e.g. `node.name.replace(/[^a-zA-Z0-9_]/g, '_')`). This is how PNG filenames in the ZIP are matched to asset names in Studio.
- **Invisible nodes:** Respect `node.visible === false` — still create the Instance but set `Visible = false`.
- **Rotation:** Roblox 2D UI does not support arbitrary rotation on most GuiObjects. Warn the user or skip rotation. Applies to non-zero `node.rotation` values.
- **Groups:** Figma `GROUP` nodes have no background. Create a transparent `Frame` container and recurse.
- **Mixed corner radius:** Some Figma nodes have per-corner radii (`topLeftRadius`, etc.). Roblox `UICorner` only supports uniform radius — use the average or the largest value and note the limitation.
- **Fonts:** Figma fonts don't map 1:1 to Roblox `Enum.Font`. Include a font mapping table (e.g. `Inter Bold → GothamBold`, `Inter Regular → Gotham`). Fall back to `GothamMedium` for unmapped fonts.
- **Stroke/Border:** Roblox Frames support `BorderSizePixel` and `BorderColor3`. Map Figma `strokes` to these. For more complex strokes, use a `UIStroke` Instance instead.
- **Z-ordering:** Figma children are ordered back-to-front. Roblox renders GuiObjects in the order they appear as children, which is also back-to-front — so the order from `node.children` maps correctly without modification.
- **Performance:** For large frames with many children, the Roblox plugin may be slow. Process nodes synchronously in a loop; no need for async since Studio plugins run on the main thread.

---

## User Workflow Summary

1. Design UI in Figma inside a single top-level Frame.
2. Open the FigmaToRoblox plugin panel, input your Open Cloud API Key.
3. Select the Frame and click **Export**.
4. The plugin automatically generates PNGs, pushes them to Roblox, and injects the `rbxassetid://` links back into the JSON representation.
5. In Roblox Studio, open the FigmaToRoblox Studio plugin panel.
6. Paste the contents of `layout.json` into the text box and click **Import**.
7. The UI appears under `StarterGui` as a `ScreenGui` with full hierarchy, colors, corners, text, images, auto layouts, and scrolling frames intact locally via native API references.