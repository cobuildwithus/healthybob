export declare const ULID_BODY_PATTERN: "[0-9A-HJKMNP-TV-Z]{26}";
export declare const ULID_BODY_REGEX: RegExp;
export declare const GENERIC_CONTRACT_ID_PATTERN: string;
export declare const GENERIC_CONTRACT_ID_REGEX: RegExp;

export declare function idPattern(prefix: string): string;
export declare function isContractId(value: unknown, prefix?: string): boolean;
export declare function assertContractId(value: unknown, prefix?: string, fieldName?: string): string;
