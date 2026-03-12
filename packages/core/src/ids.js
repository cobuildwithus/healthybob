import { randomBytes } from "node:crypto";

import { ID_PREFIXES } from "./constants.js";

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function encodeCrockford(value, length) {
  let remainder = value;
  let encoded = "";

  do {
    encoded = CROCKFORD[remainder % 32] + encoded;
    remainder = Math.floor(remainder / 32);
  } while (remainder > 0);

  return encoded.padStart(length, "0").slice(-length);
}

function generateUlid(now = Date.now()) {
  const timePart = encodeCrockford(now, 10);
  const randomPart = encodeRandomPart(16);
  return `${timePart}${randomPart}`;
}

function encodeRandomPart(length) {
  const bytes = randomBytes(length);
  let encoded = "";

  for (const byte of bytes) {
    encoded += CROCKFORD[byte % 32];
    if (encoded.length === length) {
      break;
    }
  }

  return encoded.slice(0, length);
}

function normalizePrefix(prefix, fallback = "rec") {
  if (typeof prefix === "string" && prefix in ID_PREFIXES) {
    return ID_PREFIXES[prefix];
  }

  const candidate = String(prefix ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return candidate || fallback;
}

export function generateRecordId(prefix = "record", now = Date.now()) {
  return `${normalizePrefix(prefix)}_${generateUlid(now)}`;
}

export function generateVaultId(now = Date.now()) {
  return generateRecordId("vault", now);
}
