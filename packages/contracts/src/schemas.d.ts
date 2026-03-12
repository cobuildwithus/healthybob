export type JsonSchema = Record<string, unknown>;

export declare const vaultMetadataSchema: JsonSchema;
export declare const eventRecordSchema: JsonSchema;
export declare const sampleRecordSchema: JsonSchema;
export declare const auditRecordSchema: JsonSchema;
export declare const transformRecordSchema: JsonSchema;
export declare const coreFrontmatterSchema: JsonSchema;
export declare const journalDayFrontmatterSchema: JsonSchema;
export declare const experimentFrontmatterSchema: JsonSchema;

export declare const schemaCatalog: Readonly<Record<string, JsonSchema>>;
