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

            local data = MarketplaceService:GetProductInfoAsync(
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

local pluginGui = plugin:CreateDockWidgetPluginGuiAsync("FigRoImporterGUI", widgetInfo)
pluginGui.Title = "FigRoImporter"

-- Main container with ScrollingFrame
local scrollingFrame = Instance.new("ScrollingFrame")
scrollingFrame.Size = UDim2.new(1, 0, 1, 0)
scrollingFrame.ScrollBarThickness = 4
scrollingFrame.ScrollBarImageColor3 = Color3.fromRGB(100, 100, 100)
scrollingFrame.BackgroundTransparency = 1
scrollingFrame.Parent = pluginGui

local mainContainer = Instance.new("Frame")
mainContainer.Size = UDim2.new(1, 0, 0, 400) -- Will auto-size based on content
mainContainer.BackgroundTransparency = 1
mainContainer.Parent = scrollingFrame
mainContainer.AutomaticSize = Enum.AutomaticSize.Y

local mainPadding = Instance.new("UIPadding")
mainPadding.PaddingTop = UDim.new(0, 20)
mainPadding.PaddingBottom = UDim.new(0, 20)
mainPadding.PaddingLeft = UDim.new(0, 20)
mainPadding.PaddingRight = UDim.new(0, 20)
mainPadding.Parent = mainContainer

local mainList = Instance.new("UIListLayout")
mainList.Padding = UDim.new(0, 16)
mainList.SortOrder = Enum.SortOrder.LayoutOrder
mainList.Parent = mainContainer

-- Section 1: Header
local headerSection = Instance.new("Frame")
headerSection.BackgroundTransparency = 1
headerSection.Size = UDim2.new(1, 0, 0, 28)
headerSection.LayoutOrder = 1
headerSection.Parent = mainContainer

local headerLabel = Instance.new("TextLabel")
headerLabel.Text = "FIGMA UI IMPORTER"
headerLabel.Size = UDim2.new(1, 0, 0, 20)
headerLabel.Font = Enum.Font.BuilderSansBold
headerLabel.TextSize = 11
headerLabel.TextColor3 = Color3.fromRGB(140, 140, 140)
headerLabel.BackgroundTransparency = 1
headerLabel.TextXAlignment = Enum.TextXAlignment.Left
headerLabel.Parent = headerSection

-- Section 2: JSON Input Label
local jsonLabel = Instance.new("TextLabel")
jsonLabel.Text = "Layout JSON"
jsonLabel.Size = UDim2.new(1, 0, 0, 18)
jsonLabel.Font = Enum.Font.BuilderSans
jsonLabel.TextSize = 12
jsonLabel.BackgroundTransparency = 1
jsonLabel.TextXAlignment = Enum.TextXAlignment.Left
jsonLabel.LayoutOrder = 2
jsonLabel.Parent = mainContainer

-- Section 3: JSON TextBox
local jsonContainer = Instance.new("Frame")
jsonContainer.BackgroundTransparency = 1
jsonContainer.Size = UDim2.new(1, 0, 0, 180)
jsonContainer.LayoutOrder = 3
jsonContainer.Parent = mainContainer

local jsonScroll = Instance.new("ScrollingFrame")
jsonScroll.Size = UDim2.new(1, 0, 1, 0)
jsonScroll.BackgroundTransparency = 1
jsonScroll.ScrollBarThickness = 4
jsonScroll.ScrollBarImageColor3 = Color3.fromRGB(100, 100, 100)
jsonScroll.BorderSizePixel = 0
jsonScroll.ClipsDescendants = true
jsonScroll.Parent = jsonContainer

local jsonField = Instance.new("TextBox")
jsonField.Size = UDim2.new(1, 0, 1, 0)
jsonField.Position = UDim2.new(0, 0, 0, 0)
jsonField.Text = ""
jsonField.PlaceholderText = '{"root": {"name": "Frame", ...}, "rootWidth": 1920, "rootHeight": 1080}'
jsonField.TextWrapped = true
jsonField.TextXAlignment = Enum.TextXAlignment.Left
jsonField.TextYAlignment = Enum.TextYAlignment.Top
jsonField.ClearTextOnFocus = false
jsonField.Font = Enum.Font.Code
jsonField.TextSize = 11
jsonField.BackgroundTransparency = 1
jsonField.Parent = jsonScroll

local jsonCorner = Instance.new("UICorner")
jsonCorner.CornerRadius = UDim.new(0, 6)
jsonCorner.Parent = jsonScroll

local jsonPadding = Instance.new("UIPadding")
jsonPadding.PaddingTop = UDim.new(0, 10)
jsonPadding.PaddingBottom = UDim.new(0, 10)
jsonPadding.PaddingLeft = UDim.new(0, 10)
jsonPadding.PaddingRight = UDim.new(0, 10)
jsonPadding.Parent = jsonField

local jsonStroke = Instance.new("UIStroke")
jsonStroke.ApplyStrokeMode = Enum.ApplyStrokeMode.Border
jsonStroke.Thickness = 1
jsonStroke.Parent = jsonScroll

-- Section 4: Import Button
local importButton = Instance.new("TextButton")
importButton.Size = UDim2.new(1, 0, 0, 44)
importButton.Text = "Import UI"
importButton.Font = Enum.Font.BuilderSansExtraBold
importButton.TextSize = 15
importButton.LayoutOrder = 4
importButton.AutoButtonColor = true
importButton.Parent = mainContainer

local importCorner = Instance.new("UICorner")
importCorner.CornerRadius = UDim.new(0, 6)
importCorner.Parent = importButton

local importStroke = Instance.new("UIStroke")
importStroke.ApplyStrokeMode = Enum.ApplyStrokeMode.Border
importStroke.Thickness = 1
importStroke.Parent = importButton

-- Scroll canvas size
scrollingFrame.CanvasSize = UDim2.new(0, 0, 0, 600)

-- Global position mode (read from JSON schema)
local positionMode = "scale" -- default

-- Centralized Theme Support
local function updateTheme()
    local theme = settings().Studio.Theme
    
    -- Main container
    local bgColor = theme:GetColor(Enum.StudioStyleGuideColor.MainBackground)
    mainContainer.BackgroundColor3 = bgColor
    scrollingFrame.BackgroundColor3 = bgColor
    
    -- Header
    headerLabel.TextColor3 = theme:GetColor(Enum.StudioStyleGuideColor.DimmedText)
    
    -- Labels
    jsonLabel.TextColor3 = theme:GetColor(Enum.StudioStyleGuideColor.MainText)
    
    -- JSON Input
    jsonField.BackgroundColor3 = theme:GetColor(Enum.StudioStyleGuideColor.InputFieldBackground)
    jsonField.TextColor3 = theme:GetColor(Enum.StudioStyleGuideColor.MainText)
    jsonField.PlaceholderColor3 = theme:GetColor(Enum.StudioStyleGuideColor.DimmedText)
    jsonStroke.Color = theme:GetColor(Enum.StudioStyleGuideColor.Border)
    
    -- Import Button - Primary Action
    importButton.BackgroundColor3 = theme:GetColor(Enum.StudioStyleGuideColor.DialogButton)
    importButton.TextColor3 = theme:GetColor(Enum.StudioStyleGuideColor.DialogButtonText)
    importStroke.Color = theme:GetColor(Enum.StudioStyleGuideColor.Border)
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
    if positionMode == "scale" then
        -- Use scale values from schema
        if node.scaleW and node.scaleH then
            return UDim2.new(node.scaleW, 0, node.scaleH, 0)
        end
        -- Fallback: calculate scale
        if parentW == 0 or parentH == 0 then 
            return UDim2.new(0, node.width or 0, 0, node.height or 0) 
        end
        return UDim2.new((node.width or 0) / parentW, 0, (node.height or 0) / parentH, 0)
    else
        -- Offset mode: use exact pixel values
        return UDim2.new(0, node.width or 0, 0, node.height or 0)
    end
end

local function toUDim2Position(node, parentW, parentH)
    if positionMode == "scale" then
        -- Use scale values from schema
        if node.scaleX and node.scaleY then
            return UDim2.new(node.scaleX, 0, node.scaleY, 0)
        end
        -- Fallback: calculate scale
        if parentW == 0 or parentH == 0 then 
            return UDim2.new(0, node.x or 0, 0, node.y or 0) 
        end
        return UDim2.new((node.x or 0) / parentW, 0, (node.y or 0) / parentH, 0)
    else
        -- Offset mode: use exact pixel values
        return UDim2.new(0, node.x or 0, 0, node.y or 0)
    end
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
    RubikMarkerHatch = 12187367066,
    Silkscreen = 12187371840,
    Sono = 12187374537,
    SonoMonospace = 12187362578,
    Teko = 12187376174,
    WorkSans = 12187373327,
    
    -- Additional fonts from reference project
    Damion = 12187607722,
    NotoSerifSC = 12187376739,
    Tangerine = 12187376545,
    Prompt = 12187607287,
    Tajawal = 12187377588,
    Rajdhani = 12187375422,
    Kings = 12187371622,
    RubikBurned = 12187363148,
    NotoSerifHK = 12187366846,
    RubikMaze = 12187366475,
    IBMPlexSansJP = 12187364147,
    Monofett = 12187606783,
    UnicaOne = 12187364842,
    NotoSerifJP = 12187369639,
    Parisienne = 12187361943,
    SedgwickAveDisplay = 12187376357,
    FingerPaint = 12187375716,
    Eater = 12187372382,
    CaesarDressing = 12187368843,
    RubikIso = 12187362120,
    PT_Serif = 12187606624,
    Italianno = 12187374273,
    ShadowsIntoLight = 12187607493,
    Codystar = 12187363887,
    NotoSerifTC = 12187368093,
    Yellowtail = 12187373881,
    Nosifer = 12187377325,
    LaBelleAurore = 12187607116,
    Marhey = 12187364648,
    Frijole = 12187375194,
    GreatVibes = 12187375958,
    MPLUSRounded1c = 12188570269,
    BuilderExtended = 16658237174,
    Monoton = 12187374098,
    BuilderMono = 16658246179,
    Rye = 12187372175,
    IrishGrover = 12187376910,
    NothingYouCouldDo = 12187367901,
    FasterOne = 12187370928,
    RubikWetPaint = 12187369046,
    NotoSansHK = 12187362892,
    PTSans = 12187606934,
    BuilderSans = 16658221428,
    Arimo = 16658254058,
    FredokaOne = 12187366162,
    Fredoka = 12187375553,
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
        return Font.fromEnum(Enum.Font.BuilderSans)
    end

    local family = fontName.family
    local style = fontName.style or ""
    local weight = getWeight(style)
    local fontStyle = getStyle(style)

    -- Built-in Roblox fonts that should use Enum (not asset IDs)
    local builtInFonts = {
        ["Fredoka One"] = Enum.Font.FredokaOne,
        ["Fredoka"] = Enum.Font.FredokaOne,
        ["Gotham"] = Enum.Font.Gotham,
        ["GothamMedium"] = Enum.Font.GothamMedium,
        ["GothamBold"] = Enum.Font.GothamBold,
        ["GothamBlack"] = Enum.Font.GothamBlack,
        ["SourceSans"] = Enum.Font.SourceSans,
        ["SourceSansBold"] = Enum.Font.SourceSansBold,
        ["SourceSansItalic"] = Enum.Font.SourceSansItalic,
        ["SourceSansLight"] = Enum.Font.SourceSansLight,
        ["SourceSansSemibold"] = Enum.Font.SourceSansSemibold,
        ["BuilderSans"] = Enum.Font.BuilderSans,
        ["BuilderSansBold"] = Enum.Font.BuilderSansBold,
        ["BuilderSansMedium"] = Enum.Font.BuilderSansMedium,
        ["BuilderSansExtraBold"] = Enum.Font.BuilderSansExtraBold,
        ["Roboto"] = Enum.Font.Roboto,
        ["RobotoCondensed"] = Enum.Font.RobotoCondensed,
        ["RobotoMono"] = Enum.Font.RobotoMono,
    }
    
    if builtInFonts[family] then
        return Font.fromEnum(builtInFonts[family])
    end

    -- Try marketplace font ID
    local key = normalizeFontName(family)
    local fontId = FONT_IDS[key]
    
    if fontId then
        local success, result = pcall(function()
            return Font.fromId(fontId, weight, fontStyle)
        end)
        if success then return result end
    end

    -- Fallback: Try loading by Name
    local ok, result = pcall(function()
        return Font.fromName(family, weight, fontStyle)
    end)
    if ok then return result end

    -- Final fallback
    return Font.fromEnum(Enum.Font.BuilderSans)
end

--------------------------------------------------------------------------------
-- Builder
--------------------------------------------------------------------------------

local function getGradientRotation(gradientTransform)
    -- Calculate rotation from Figma's gradient transform matrix
    -- Figma gradientTransform is a 2x3 matrix [[a, b, tx], [c, d, ty]]
    -- Reference project uses: atan2(transform[0][0], transform[0][1]) and then -(angle - 90)
    if not gradientTransform or not gradientTransform[1] then return 0 end
    
    local a = gradientTransform[1][1] or 0
    local b = gradientTransform[1][2] or 0
    
    -- Match reference project: atan2(a, b), then -(angle - 90)
    local angle = math.atan2(a, b) * 180 / math.pi
    local rotation = -(angle - 90)
    
    -- Normalize to 0-360
    while rotation < 0 do rotation = rotation + 360 end
    while rotation >= 360 do rotation = rotation - 360 end
    
    return rotation
end

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
    
    -- Apply rotation from gradient transform
    if fill.gradientTransform then
        gradient.Rotation = getGradientRotation(fill.gradientTransform)
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
        
        -- Handle rich text with segments
        if node.richText then
            obj.RichText = true
            obj.Text = node.richText
        else
            obj.Text = node.characters or ""
        end
        
        obj.TextSize = node.fontSize or 14
        obj.TextScaled = node.textScaled == true
        
        -- Set text color from fills
        local textColorFill = node.textColor and node.textColor[1]
        if textColorFill then
            if textColorFill.type == "SOLID" and textColorFill.color then
                obj.TextColor3 = Color3.new(textColorFill.color.r, textColorFill.color.g, textColorFill.color.b)
                obj.TextTransparency = 1 - ((textColorFill.opacity or 1) * baseOpacity)
            elseif textColorFill.type == "GRADIENT_LINEAR" and textColorFill.gradientStops then
                -- Use first gradient stop color for text
                local firstStop = textColorFill.gradientStops[1]
                if firstStop and firstStop.color then
                    obj.TextColor3 = Color3.new(firstStop.color.r, firstStop.color.g, firstStop.color.b)
                    obj.TextTransparency = 1 - ((firstStop.color.a or 1) * baseOpacity)
                end
                -- Apply gradient to text
                applyGradient(textColorFill, obj)
            end
        else
            obj.TextColor3 = Color3.new(0, 0, 0)
        end
        
        -- Apply text case
        if node.textCase then
            if node.textCase == "UPPER" then
                obj.Text = string.upper(obj.Text)
            elseif node.textCase == "LOWER" then
                obj.Text = string.lower(obj.Text)
            elseif node.textCase == "TITLE" then
                -- Title case: capitalize first letter of each word
                obj.Text = string.gsub(obj.Text, "(%w)(%w*)", function(first, rest)
                    return string.upper(first) .. string.lower(rest)
                end)
            end
        end
        
        obj.BackgroundTransparency = 1
        local xAlign, yAlign = mapTextAlign(node.textAlignVertical, node.textAlignHorizontal)
        obj.TextXAlignment = xAlign
        obj.TextYAlignment = yAlign
        obj.FontFace = mapFont(node.fontName)
        
        -- TextWrapped should be true for proper text display
        obj.TextWrapped = true

    elseif node.isImage then
        obj = Instance.new(isButton and "ImageButton" or "ImageLabel")
        
        -- Debug: show what we're getting
        print("[FigRoImporter] Image node: " .. tostring(node.name) .. ", assetId: " .. tostring(node.assetId) .. ", imageFileName: " .. tostring(node.imageFileName))
        
        -- Default to the mapped pool ID
        local textureId = pool[node.assetId] 

        if not textureId and node.assetId and node.assetId ~= "" then
            -- Fallback: The JSON has a direct rbxassetid (Open Cloud workflow)
            -- Open Cloud uploads Decals (Type 13), which can be used directly as rbxassetid://
            local idStr = string.match(node.assetId, "%d+")
            if idStr then
                -- Use the asset ID directly as rbxassetid
                textureId = "rbxassetid://" .. idStr
                print("[FigRoImporter] Using asset ID directly: " .. textureId)
            else
                -- Try as direct rbxassetid URL
                if string.find(node.assetId, "rbxassetid://") then
                    textureId = node.assetId
                end
            end
        end

        obj.Image = textureId or ""

        if node.assetId and pool[node.assetId] then
            obj:SetAttribute("Id", node.assetId)
        end
        -- Force images to have clear background, prioritize image content
        obj.BackgroundTransparency = 1
        obj.ImageTransparency = 1 - (baseOpacity or 1)
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
        
        -- Images always have transparent background to prioritize image content
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
        uiStroke.Transparency = 1 - ((stroke.opacity or 1) * baseOpacity)
        
        -- Use ScaledSize so strokes scale with the element
        uiStroke.StrokeSizingMode = Enum.StrokeSizingMode.ScaledSize
        
        -- Convert pixel thickness to scaled fraction (0-1 range)
        -- Use node's smaller dimension as reference, or font size for text
        local refSize = math.min(node.width or 100, node.height or 100)
        if node.type == "TEXT" and node.fontSize then
            refSize = node.fontSize
        end
        if refSize > 0 then
            uiStroke.Thickness = node.strokeWeight / refSize
        else
            uiStroke.Thickness = node.strokeWeight / 100
        end
        
        -- Apply stroke mode: Contextual for TextLabels, Border for others
        if obj:IsA("TextLabel") or obj:IsA("TextButton") then
            uiStroke.ApplyStrokeMode = Enum.ApplyStrokeMode.Contextual
        else
            uiStroke.ApplyStrokeMode = Enum.ApplyStrokeMode.Border
        end
        
        -- Apply line join mode: Miter by default, Round if has corner radius
        if node.cornerRadius and node.cornerRadius > 0 then
            uiStroke.LineJoinMode = Enum.LineJoinMode.Round
        else
            uiStroke.LineJoinMode = Enum.LineJoinMode.Miter
        end
        
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

    -- Corner radius (use Scale so it scales with the element)
    if node.cornerRadius and node.cornerRadius > 0 and node.type ~= "ELLIPSE" then
        local corner = Instance.new("UICorner")
        -- Convert pixel radius to scale fraction: radius / min(width, height)
        local minDim = math.min(node.width or 100, node.height or 100)
        if minDim > 0 then
            corner.CornerRadius = UDim.new(node.cornerRadius / minDim, 0)
        else
            corner.CornerRadius = UDim.new(0, node.cornerRadius)
        end
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
    
    -- Apply AspectRatioConstraint (from reference project)
    -- Skip for ScrollingFrame and if explicitly disabled
    if node.applyAspectRatio and not obj:IsA("ScrollingFrame") then
        local nodeW = node.width or 0
        local nodeH = node.height or 0
        if nodeW > 0 and nodeH > 0 then
            local aspectRatio = nodeW / nodeH
            local arc = Instance.new("UIAspectRatioConstraint")
            arc.AspectRatio = aspectRatio
            arc.AspectType = Enum.AspectType.FitWithinMaxSize
            -- DominantAxis: Width if wider, Height if taller
            arc.DominantAxis = nodeW > nodeH and Enum.DominantAxis.Width or Enum.DominantAxis.Height
            arc.Parent = obj
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

    local jsonString = jsonField.Text
    if jsonString == "" then
        warn("Please paste layout.json contents into the text field.")
        return
    end

    -- Clean up JSON - remove BOM or leading/trailing whitespace
    jsonString = string.match(jsonString, "^%s*(.-)%s*$")
    local firstByte = string.byte(jsonString, 1)
    if firstByte == 0xFEFF then
        jsonString = string.sub(jsonString, 2)
    end

    -- Debug: show JSON length
    print("[FigRoImporter] JSON length: " .. #jsonString .. " characters")
    print("[FigRoImporter] JSON preview: " .. string.sub(jsonString, 1, 200))

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
    
    -- Read settings from JSON
    positionMode = parsedData.positionMode or "scale"
    local applyAspectRatio = parsedData.applyAspectRatio or false
    
    -- Apply applyAspectRatio to all nodes recursively
    if applyAspectRatio then
        local function setAspectRatio(node)
            node.applyAspectRatio = true
            if node.children then
                for _, child in ipairs(node.children) do
                    setAspectRatio(child)
                end
            end
        end
        setAspectRatio(rootNode)
    end

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

    print("[FigRoImporter] Importing " .. rootNode.name .. " (" .. rootWidth .. "x" .. rootHeight .. ") mode: " .. positionMode)

    local screenGui = Instance.new("ScreenGui")
    screenGui.Name = rootNode.name
    screenGui.ResetOnSpawn = false
    screenGui.IgnoreGuiInset = true
    screenGui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling
    
    -- Recursively build UI
    local rootFrame = buildUI(rootNode, screenGui, rootWidth, rootHeight, nil)
    
    -- Root frame always fills the screen (1920x1080 canvas from Figma)
    rootFrame.Size = UDim2.new(1, 0, 1, 0)
    rootFrame.Position = UDim2.new(0, 0, 0, 0)
    rootFrame.BackgroundTransparency = 1
    
    -- Remove stroke from the root frame if present
    local stroke = rootFrame:FindFirstChildWhichIsA("UIStroke")
    if stroke then
        stroke:Destroy()
    end
    
    -- Add AspectRatioConstraint to root frame for cross-device scaling
    -- 1920/1080 = 1.7777...
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
