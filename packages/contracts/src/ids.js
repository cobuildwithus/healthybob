import { CONTRACT_ID_FORMAT, ID_PREFIXES } from "./constants.js";

export const ULID_BODY_PATTERN = "[0-9A-HJKMNP-TV-Z]{26}";
export const ULID_BODY_REGEX = new RegExp(`^${ULID_BODY_PATTERN}$`);
export const GENERIC_CONTRACT_ID_PATTERN = `^(?:${Object.values(ID_PREFIXES).join("|")})_${ULID_BODY_PATTERN}$`;
export const GENERIC_CONTRACT_ID_REGEX = new RegExp(GENERIC_CONTRACT_ID_PATTERN);

export function idPattern(prefix) {
  return `^${prefix}_${ULID_BODY_PATTERN}$`;
}

export function isContractId(value, prefix) {
  if (typeof value !== "string") {
    return false;
  }

  const pattern = prefix ? idPattern(prefix) : GENERIC_CONTRACT_ID_PATTERN;
  return new RegExp(pattern).test(value);
}

export function assertContractId(value, prefix, fieldName = "id") {
  if (!isContractId(value, prefix)) {
    const detail = prefix ? `${prefix}_<ULID>` : `${CONTRACT_ID_FORMAT}`;
    throw new TypeError(`${fieldName} must match ${detail}`);
  }

  return value;
}
