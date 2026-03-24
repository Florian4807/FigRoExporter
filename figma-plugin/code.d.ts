declare function sanitizeName(name: string): string;
declare function padIndex(index: number): string;
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
}
declare let imageCounter: number;
declare let imageList: {
    index: number;
    fileName: string;
}[];
declare let storedImageBytes: {
    [name: string]: Uint8Array;
};
declare function walkNode(node: SceneNode, parentAbsX?: number, parentAbsY?: number): Promise<NodeSchema | null>;
declare function hashBytes(bytes: Uint8Array): string;
declare function sanitizeKey(raw: string): string;
declare function stringToBytes(str: string): Uint8Array;
declare function buildMultipartBody(boundary: string, requestJson: string, fileBytes: Uint8Array, fileName: string): Uint8Array;
declare function extractAssetId(data: any): string | null;
declare function uploadToRoblox(fileName: string, bytes: Uint8Array, apiKey: string, userId: string): Promise<string | null>;
declare function pollOperation(key: string, operationPath: string): Promise<string | null>;
declare function hydrateSchemaWithAssetIds(node: any, assetMap: {
    [name: string]: string;
}): void;
declare let currentSchema: any;
//# sourceMappingURL=code.d.ts.map