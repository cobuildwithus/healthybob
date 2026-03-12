export declare function validateAgainstSchema(
  schema: Record<string, unknown>,
  value: unknown,
  path?: string,
): string[];

export declare function assertValidAgainstSchema(
  schema: Record<string, unknown>,
  value: unknown,
  label?: string,
): unknown;

export declare function parseFrontmatterMarkdown(markdown: string): Record<string, unknown>;
