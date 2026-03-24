local HttpService = game:GetService("HttpService")
local ServerStorage = game:GetService("ServerStorage")
local StarterGui = game:GetService("StarterGui")
local MarketplaceService = game:GetService("MarketplaceService")

local pool = {} -- [imageId] -> textureId

-- Bloxporter-style pool builder for manually inserted Decals
local function loadDecal(item)
    if not item:IsA("Decal") then return end
    
    local loadedFolder = ServerStorage:FindFirstChild("Loaded")
    if not loadedFolder or not loadedFolder:IsA("Folder") then
        loadedFolder = Instance.new("Folder")
        loadedFolder.Name = "Loaded"
        loadedFolder.Parent = ServerStorage
    end
    
    local success
    for i = 1, 5 do
        success = pcall(function()
            if item:GetAttribute("Id") then 
                pool[item:GetAttribute("Id")] = item.Texture 
                return true 
            end

            local textureIdStr = string.split(item.Texture, "rbxassetid://")[2]
            if not textureIdStr then return false end

            local data = MarketplaceService:GetProductInfo(
                tonumber(textureIdStr),
                Enum.InfoType.Asset
            )

            -- Handle names with or without "Images/" prefix just in case
            local info = string.split(data.Name, "Images/")[2] or data.Name
            local id = string.split(info, "__")[1]

            if id then
                pool[id] = item.Texture
                item:SetAttribute("Id", id)
            end
        end)
        
        if success then
            item.Parent = loadedFolder
            return
        else
            task.wait(0.25)
        end
    end
    warn("[FigRoImporter] Failed to load Decal mapping for " .. tostring(item.Texture))
end

local function scanLoadedDecals()
    local loadedFolder = ServerStorage:FindFirstChild("Loaded")
    if loadedFolder then
        for _, child in ipairs(loadedFolder:GetChildren()) do
            if child:IsA("Decal") then
                local id = child:GetAttribute("Id")
                if id then
                    pool[id] = child.Texture
                end
            end
        end
    end
end

workspace.ChildAdded:Connect(function(child)
    if child:IsA("Decal") then
        task.spawn(loadDecal, child)
    end
end)

-- Initialize toolbar and button
local toolbar = plugin:CreateToolbar("FigRoImporter")
local button = toolbar:CreateButton(
    "Import UI",
    "Import decoded JSON from FigRoExporter",
    "rbxassetid://1507949215" -- Example icon
)

-- Create the Plugin GUI
local widgetInfo = DockWidgetPluginGuiInfo.new(
    Enum.InitialDockState.Float,
    false, -- init enabled
    false, -- override prev state
    300, 400,
    250, 200
)

local pluginGui = plugin:CreateDockWidgetPluginGui("FigRoImporterGUI", widgetInfo)
pluginGui.Title = "FigRoImporter"

local background = Instance.new("Frame")
background.Size = UDim2.new(1, 0, 1, 0)
background.Parent = pluginGui

local padding = Instance.new("UIPadding")
padding.PaddingTop = UDim.new(0, 16)
padding.PaddingBottom = UDim.new(0, 16)
padding.PaddingLeft = UDim.new(0, 16)
padding.PaddingRight = UDim.new(0, 16)
padding.Parent = background

local listLayout = Instance.new("UIListLayout")
listLayout.Padding = UDim.new(0, 12)
listLayout.SortOrder = Enum.SortOrder.LayoutOrder
listLayout.Parent = background

local title = Instance.new("TextLabel")
title.Text = "Paste layout.json here:"
title.BackgroundTransparency = 1
title.Size = UDim2.new(1, 0, 0, 24)
title.Font = Enum.Font.BuilderSansBold
title.TextSize = 16
title.TextXAlignment = Enum.TextXAlignment.Left
title.LayoutOrder = 1
title.Parent = background

local inputContainer = Instance.new("Frame")
inputContainer.BackgroundTransparency = 1
inputContainer.Size = UDim2.new(1, 0, 1, -84) -- Takes remaining space
inputContainer.LayoutOrder = 2
inputContainer.Parent = background

local inputField = Instance.new("TextBox")
inputField.Size = UDim2.new(1, 0, 1, 0)
inputField.Text = ""
inputField.PlaceholderText = '{"figmaVersion": "1.0", ...}'
inputField.TextWrapped = true
inputField.TextXAlignment = Enum.TextXAlignment.Left
inputField.TextYAlignment = Enum.TextYAlignment.Top
inputField.ClearTextOnFocus = false
inputField.Font = Enum.Font.Code
inputField.TextSize = 12
inputField.Parent = inputContainer

local inputCorner = Instance.new("UICorner")
inputCorner.CornerRadius = UDim.new(0, 6)
inputCorner.Parent = inputField

local inputPadding = Instance.new("UIPadding")
inputPadding.PaddingTop = UDim.new(0, 8)
inputPadding.PaddingBottom = UDim.new(0, 8)
inputPadding.PaddingLeft = UDim.new(0, 8)
inputPadding.PaddingRight = UDim.new(0, 8)
inputPadding.Parent = inputField

local inputStroke = Instance.new("UIStroke")
inputStroke.ApplyStrokeMode = Enum.ApplyStrokeMode.Border
inputStroke.Thickness = 1
inputStroke.Parent = inputField

local importButton = Instance.new("TextButton")
importButton.Size = UDim2.new(1, 0, 0, 40)
importButton.Text = "Import UI"
importButton.Font = Enum.Font.BuilderSansExtraBold
importButton.TextSize = 16
importButton.LayoutOrder = 3
importButton.AutoButtonColor = true
importButton.Parent = background

local btnCorner = Instance.new("UICorner")
btnCorner.CornerRadius = UDim.new(0, 6)
btnCorner.Parent = importButton

local btnStroke = Instance.new("UIStroke")
btnStroke.ApplyStrokeMode = Enum.ApplyStrokeMode.Border
btnStroke.Thickness = 1
btnStroke.Parent = importButton

-- Theme Support Hook
local function updateTheme()
    local theme = settings().Studio.Theme
    background.BackgroundColor3 = theme:GetColor(Enum.StudioStyleGuideColor.MainBackground)
    
    title.TextColor3 = theme:GetColor(Enum.StudioStyleGuideColor.MainText)
    
    inputField.BackgroundColor3 = theme:GetColor(Enum.StudioStyleGuideColor.InputFieldBackground)
    inputField.TextColor3 = theme:GetColor(Enum.StudioStyleGuideColor.MainText)
    inputField.PlaceholderColor3 = theme:GetColor(Enum.StudioStyleGuideColor.DimmedText)
    inputStroke.Color = theme:GetColor(Enum.StudioStyleGuideColor.Border)
    
    importButton.BackgroundColor3 = theme:GetColor(Enum.StudioStyleGuideColor.DialogButton)
    importButton.TextColor3 = theme:GetColor(Enum.StudioStyleGuideColor.DialogButtonText)
    btnStroke.Color = theme:GetColor(Enum.StudioStyleGuideColor.Border)
end

updateTheme()
settings().Studio.ThemeChanged:Connect(updateTheme)

-- Toggle UI on toolbar button click
button.Click:Connect(function()
    pluginGui.Enabled = not pluginGui.Enabled
end)

--------------------------------------------------------------------------------
-- Helpers
--------------------------------------------------------------------------------

local function toUDim2Size(node, parentW, parentH)
    if parentW == 0 or parentH == 0 then return UDim2.new(0, node.width, 0, node.height) end
    return UDim2.new(node.width / parentW, 0, node.height / parentH, 0)
end

local function toUDim2Position(node, parentW, parentH)
    if parentW == 0 or parentH == 0 then return UDim2.new(0, node.x, 0, node.y) end
    return UDim2.new(node.x / parentW, 0, node.y / parentH, 0)
end

local function figmaColorToColor3(fill)
    if fill and fill.type == "SOLID" and fill.color then
        return Color3.new(fill.color.r, fill.color.g, fill.color.b)
    end
    return Color3.new(1, 1, 1)
end

local function mapTextAlign(alignVertical, alignHorizontal)
    local xAlign = Enum.TextXAlignment.Center
    local yAlign = Enum.TextYAlignment.Center

    if alignHorizontal == "LEFT" then xAlign = Enum.TextXAlignment.Left
    elseif alignHorizontal == "RIGHT" then xAlign = Enum.TextXAlignment.Right end

    if alignVertical == "TOP" then yAlign = Enum.TextYAlignment.Top
    elseif alignVertical == "BOTTOM" then yAlign = Enum.TextYAlignment.Bottom end

    return xAlign, yAlign
end

-- Font ID table (sourced from Bloxporter / Roblox marketplace IDs)
local FONT_IDS = {
    Akronim = 12187368317,
    AreYouSerious = 12187363616,
    Audiowide = 12187360881,
    Barlow = 12187372847,
    Barrio = 12187371991,
    Blaka = 12187365104,
    BungeeInline = 12187370000,
    BungeeShade = 12187367666,
    Cairo = 12187377099,
    Caveat = 12187369802,
    DancingScript = 8764312106,
    FiraSans = 12187374954,
    FuzzyBubbles = 11322590111,
    Hind = 12187361116,
    HindSiliguri = 12187361378,
    Inter = 12187365364,
    Kanit = 12187373592,
    Lato = 11598289817,
    LibreBaskerville = 12187365769,
    Lobster = 8836875837,
    Lora = 12187366657,
    Montserrat = 11702779517,
    Mukta = 12187365559,
    Mulish = 12187372629,
    NanumGothic = 12187361718,
    NotoSans = 12187370747,
    NunitoSans = 12187363368,
    OpenSans = 11598121416,
    Pacifico = 12187367362,
    PlayfairDisplay = 12187374765,
    Poppins = 11702779409,
    Quicksand = 12187371324,
    Raleway = 11702779240,
    RobotoSlab = 12187368625,
    Rubik = 12187365977,
    Silkscreen = 12187371840,
    Sono = 12187374537,
    Teko = 12187376174,
    WorkSans = 12187373327,
}

-- Weight name → Roblox FontWeight
local WEIGHT_MAP = {
    Thin       = Enum.FontWeight.Thin,
    ExtraLight = Enum.FontWeight.ExtraLight,
    Light      = Enum.FontWeight.Light,
    Regular    = Enum.FontWeight.Regular,
    Medium     = Enum.FontWeight.Medium,
    SemiBold   = Enum.FontWeight.SemiBold,
    Bold       = Enum.FontWeight.Bold,
    ExtraBold  = Enum.FontWeight.ExtraBold,
    Black      = Enum.FontWeight.Heavy,
}

local function getWeight(styleStr)
    if not styleStr then return Enum.FontWeight.Regular end
    for k, v in pairs(WEIGHT_MAP) do
        if styleStr:lower():find(k:lower()) then return v end
    end
    return Enum.FontWeight.Regular
end

local function getStyle(styleStr)
    if styleStr and styleStr:lower():find("italic") then
        return Enum.FontStyle.Italic
    end
    return Enum.FontStyle.Normal
end

-- Normalize font family name to match table keys (remove spaces)
local function normalizeFontName(name)
    return (name or ""):gsub("%s+", "")
end

local function mapFont(fontName)
    if not fontName or not fontName.family then
        return Font.fromEnum(Enum.Font.GothamMedium)
    end

    local key = normalizeFontName(fontName.family)
    local style = fontName.style or ""
    local weight = getWeight(style)
    local fontStyle = getStyle(style)

    local fontId = FONT_IDS[key]
    if fontId then
        return Font.fromId(fontId, weight, fontStyle)
    end

    -- Fallback to named fonts Roblox knows about
    local ok, result = pcall(function()
        return Font.fromName(fontName.family, weight, fontStyle)
    end)
    if ok then return result end

    -- Final fallback
    return Font.fromEnum(Enum.Font.GothamMedium)
end

--------------------------------------------------------------------------------
-- Builder
--------------------------------------------------------------------------------

local function applyGradient(fill, parent)
    if not fill or not fill.gradientStops then return end
    
    local gradient = Instance.new("UIGradient")
    local colorSeq = {}
    local transSeq = {}
    
    for _, stop in ipairs(fill.gradientStops) do
        local time = math.clamp(stop.position, 0, 1)
        table.insert(colorSeq, ColorSequenceKeypoint.new(
            time,
            Color3.new(stop.color.r, stop.color.g, stop.color.b)
        ))
        table.insert(transSeq, NumberSequenceKeypoint.new(
            time,
            1 - (stop.color.a or 1)
        ))
    end
    
    -- Ensure 0 and 1 keys
    if #colorSeq > 0 then
        if colorSeq[1].Time > 0 then table.insert(colorSeq, 1, ColorSequenceKeypoint.new(0, colorSeq[1].Value)) end
        if colorSeq[#colorSeq].Time < 1 then table.insert(colorSeq, ColorSequenceKeypoint.new(1, colorSeq[#colorSeq].Value)) end
        pcall(function() gradient.Color = ColorSequence.new(colorSeq) end)
    end
    if #transSeq > 0 then
        if transSeq[1].Time > 0 then table.insert(transSeq, 1, NumberSequenceKeypoint.new(0, transSeq[1].Value)) end
        if transSeq[#transSeq].Time < 1 then table.insert(transSeq, NumberSequenceKeypoint.new(1, transSeq[#transSeq].Value)) end
        pcall(function() gradient.Transparency = NumberSequence.new(transSeq) end)
    end
    
    gradient.Parent = parent
    return gradient
end

local function hasTag(node, tagName)
    if not node.tags then return false end
    for _, t in ipairs(node.tags) do
        if t == tagName:lower() then return true end
    end
    return false
end

local function buildUI(node, parentInstance, parentW, parentH, childIndex)
    local obj
    local baseOpacity = node.opacity or 1

    -- Tag-based overrides
    local isButton = hasTag(node, "button") or hasTag(node, "textbutton") or hasTag(node, "imagebutton")
    local isScroll = hasTag(node, "scroll") or hasTag(node, "scrollingframe")
    
    if node.type == "TEXT" then
        obj = Instance.new(isButton and "TextButton" or "TextLabel")
        if node.richText then
            obj.RichText = true
            obj.Text = node.richText
        else
            obj.Text = node.characters or ""
        end
        obj.TextSize = node.fontSize or 14
        obj.TextScaled = node.textScaled == true
        
        local textColorFill = node.textColor and node.textColor[1]
        if textColorFill then
            obj.TextColor3 = figmaColorToColor3(textColorFill)
            obj.TextTransparency = 1 - ((textColorFill.opacity or 1) * baseOpacity)
        else
            obj.TextColor3 = Color3.new(0, 0, 0)
        end
        
        obj.BackgroundTransparency = 1
        local xAlign, yAlign = mapTextAlign(node.textAlignVertical, node.textAlignHorizontal)
        obj.TextXAlignment = xAlign
        obj.TextYAlignment = yAlign
        obj.FontFace = mapFont(node.fontName)

    elseif node.isImage then
        obj = Instance.new(isButton and "ImageButton" or "ImageLabel")
        
        -- Default to the mapped pool ID
        local textureId = pool[node.assetId] 

        if not textureId and node.assetId and node.assetId ~= "" then
            -- Fallback: The JSON has a direct rbxassetid (Open Cloud workflow)
            -- Open Cloud uploads Decals (Type 13), but ImageLabels need Images (Type 1).
            local idStr = string.match(node.assetId, "%d+")
            if idStr then
                local success, assetModel = pcall(function()
                    return game:GetService("InsertService"):LoadAsset(tonumber(idStr))
                end)
                
                if success and assetModel then
                    local decal = assetModel:FindFirstChildOfClass("Decal")
                    if decal and decal.Texture then
                        textureId = decal.Texture
                    end
                    assetModel:Destroy()
                end
            end
            
            if not textureId then textureId = node.assetId end
        end

        obj.Image = textureId or ""

        if node.assetId and pool[node.assetId] then
            obj:SetAttribute("Id", node.assetId)
        end
        obj.BackgroundTransparency = 1
        obj.ImageTransparency = 1 - baseOpacity
        obj.ScaleType = Enum.ScaleType.Fit
    
    elseif node.type == "ELLIPSE" then
        obj = Instance.new(isButton and "ImageButton" or "Frame")
        local corner = Instance.new("UICorner")
        corner.CornerRadius = UDim.new(1, 0)
        corner.Parent = obj
    
    elseif isScroll or (node.clipsContent and node.overflowDirection and node.overflowDirection ~= "NONE") then
        obj = Instance.new("ScrollingFrame")
        obj.ScrollBarThickness = 6
        obj.BackgroundTransparency = 1
        obj.CanvasSize = UDim2.new(0, node.contentWidth or 0, 0, node.contentHeight or 0)
        obj.ScrollingDirection = (node.overflowDirection == "BOTH") and Enum.ScrollingDirection.XY or 
                                (node.overflowDirection == "HORIZONTAL") and Enum.ScrollingDirection.X or 
                                Enum.ScrollingDirection.Y
        obj.AutomaticCanvasSize = (node.overflowDirection == "BOTH") and Enum.AutomaticSize.XY or 
                                 (node.overflowDirection == "HORIZONTAL") and Enum.AutomaticSize.X or 
                                 Enum.AutomaticSize.Y
    else
        obj = Instance.new(isButton and "TextButton" or "Frame")
        if isButton then obj.Text = "" end
        if node.type == "GROUP" or node.type == "VECTOR" then
            obj.BackgroundTransparency = 1
        end
    end

    obj.Name = node.name
    obj.Size = toUDim2Size(node, parentW, parentH)
    obj.Position = toUDim2Position(node, parentW, parentH)
    obj.ZIndex = childIndex or 1
    
    if node.visible ~= nil then
        obj.Visible = node.visible
    end

    -- Background fills
    if obj:IsA("Frame") or obj:IsA("ImageLabel") or obj:IsA("ScrollingFrame") or obj:IsA("GuiButton") then
        local fill = node.fills and node.fills[1]
        
        if node.isImage then
            obj.BackgroundTransparency = 1
        elseif fill then
            if fill.type == "SOLID" then
                obj.BackgroundColor3 = figmaColorToColor3(fill)
                obj.BackgroundTransparency = 1 - ((fill.opacity or 1) * baseOpacity)
            elseif fill.type == "GRADIENT_LINEAR" then
                obj.BackgroundColor3 = Color3.new(1, 1, 1)
                obj.BackgroundTransparency = 1 - baseOpacity
                applyGradient(fill, obj)
            end
        else
            if node.type ~= "GROUP" and node.type ~= "VECTOR" then
                obj.BackgroundTransparency = 1
            end
        end
    end
    
    -- Strokes (Borders)
    local stroke = node.strokes and node.strokes[1]
    if stroke and node.strokeWeight > 0 then
        local uiStroke = Instance.new("UIStroke")
        uiStroke.Thickness = node.strokeWeight
        uiStroke.Transparency = 1 - (stroke.opacity or 1)
        
        if stroke.type == "SOLID" then
            uiStroke.Color = figmaColorToColor3(stroke)
        elseif stroke.type == "GRADIENT_LINEAR" then
            uiStroke.Color = Color3.new(1, 1, 1)
            applyGradient(stroke, uiStroke)
        end
        uiStroke.Parent = obj
    else
        if obj:IsA("GuiObject") then obj.BorderSizePixel = 0 end
    end

    -- Corner radius
    if node.cornerRadius and node.cornerRadius > 0 and node.type ~= "ELLIPSE" then
        local corner = Instance.new("UICorner")
        corner.CornerRadius = UDim.new(0, node.cornerRadius)
        corner.Parent = obj
    end
    
    -- Layout tags
    if hasTag(node, "grid") then
        local grid = Instance.new("UIGridLayout")
        grid.CellPadding = UDim2.new(0, node.autoLayout and node.autoLayout.spacing or 0, 0, node.autoLayout and node.autoLayout.spacing or 0)
        grid.SortOrder = Enum.SortOrder.LayoutOrder
        grid.Parent = obj
    elseif hasTag(node, "uilist") or hasTag(node, "list") then
        local list = Instance.new("UIListLayout")
        list.Padding = UDim.new(0, node.autoLayout and node.autoLayout.spacing or 0)
        list.SortOrder = Enum.SortOrder.LayoutOrder
        list.Parent = obj
    elseif node.autoLayout then
        local al = node.autoLayout
        if node.primaryAxisSizingMode == "AUTO" then
            obj.AutomaticSize = al.direction == "VERTICAL" and Enum.AutomaticSize.Y or Enum.AutomaticSize.X
        end
        if al.paddingTop > 0 or al.paddingBottom > 0 or al.paddingLeft > 0 or al.paddingRight > 0 then
            local padding = Instance.new("UIPadding")
            padding.PaddingTop, padding.PaddingBottom = UDim.new(0, al.paddingTop), UDim.new(0, al.paddingBottom)
            padding.PaddingLeft, padding.PaddingRight = UDim.new(0, al.paddingLeft), UDim.new(0, al.paddingRight)
            padding.Parent = obj
        end
        if al.wrap == "WRAP" then
            local grid = Instance.new("UIGridLayout")
            grid.CellPadding = UDim2.new(0, al.spacing, 0, al.spacing)
            grid.SortOrder = Enum.SortOrder.LayoutOrder
            grid.Parent = obj
        else
            local list = Instance.new("UIListLayout")
            list.Padding = UDim.new(0, al.spacing)
            list.FillDirection = al.direction == "HORIZONTAL" and Enum.FillDirection.Horizontal or Enum.FillDirection.Vertical
            list.SortOrder = Enum.SortOrder.LayoutOrder
            list.Parent = obj
        end
    end

    obj.Parent = parentInstance

    -- Recurse children
    if node.children then
        for i, child in ipairs(node.children) do
            buildUI(child, obj, node.width, node.height, i)
        end
    end
    
    return obj
end

--------------------------------------------------------------------------------
-- Importer Action
--------------------------------------------------------------------------------

importButton.MouseButton1Click:Connect(function()
    scanLoadedDecals() -- refresh pool in case studio reloaded scripts

    local jsonString = inputField.Text
    if jsonString == "" then
        warn("Please paste layout.json contents into the text field.")
        return
    end

    -- Debug: show JSON length
    print("[FigRoImporter] JSON length: " .. #jsonString .. " characters")

    local success, parsedData = pcall(function()
        return HttpService:JSONDecode(jsonString)
    end)

    if not success or not parsedData.root then
        warn("[FigRoImporter] Invalid JSON format. Error: " .. tostring(parsedData))
        return
    end

    local rootNode = parsedData.root
    local rootWidth = parsedData.rootWidth or rootNode.width
    local rootHeight = parsedData.rootHeight or rootNode.height

    -- Debug: count images and check for assetIds
    local imageCount = 0
    local hasAssetId = 0
    local function countImages(node)
        if node.isImage then
            imageCount = imageCount + 1
            if node.assetId and node.assetId ~= "" then
                hasAssetId = hasAssetId + 1
                print("[FigRoImporter] Image: " .. node.name .. " -> " .. node.assetId)
            else
                warn("[FigRoImporter] Image MISSING assetId: " .. node.name .. " (fileName: " .. tostring(node.imageFileName) .. ")")
            end
        end
        if node.children then
            for _, child in ipairs(node.children) do
                countImages(child)
            end
        end
    end
    countImages(rootNode)
    print("[FigRoImporter] Found " .. imageCount .. " images, " .. hasAssetId .. " with asset IDs")

    print("[FigRoImporter] Importing " .. rootNode.name .. " (" .. rootWidth .. "x" .. rootHeight .. ")")

    local screenGui = Instance.new("ScreenGui")
    screenGui.Name = rootNode.name
    screenGui.ResetOnSpawn = false
    screenGui.IgnoreGuiInset = true
    screenGui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling
    
    -- Recursively build UI
    local rootFrame = buildUI(rootNode, screenGui, rootWidth, rootHeight, nil)
    
    -- Center the root frame properly
    rootFrame.Size = UDim2.new(1, 0, 1, 0)
    rootFrame.AnchorPoint = Vector2.new(0.5, 0.5)
    rootFrame.Position = UDim2.new(0.5, 0, 0.5, 0)
    rootFrame.BackgroundTransparency = 1
    
    -- UIAspectRatioConstraint on the root node
    local arc = Instance.new("UIAspectRatioConstraint")
    arc.AspectRatio = rootWidth / rootHeight
    arc.AspectType = Enum.AspectType.FitWithinMaxSize
    arc.DominantAxis = Enum.DominantAxis.Width
    arc.Parent = rootFrame

    screenGui.Parent = StarterGui

    print("[FigRoImporter] UI Import Complete! ScreenGui placed in StarterGui.")
    if hasAssetId < imageCount then
        warn("[FigRoImporter] WARNING: " .. (imageCount - hasAssetId) .. " images have no asset ID and will appear blank.")
        warn("[FigRoImporter] Make sure you wait for uploads to finish in Figma before copying the JSON.")
    end
end)
