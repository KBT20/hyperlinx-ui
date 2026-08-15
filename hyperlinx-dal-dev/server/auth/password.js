import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const DEFAULT_COST = 16_384;
const DEFAULT_BLOCK_SIZE = 8;
const DEFAULT_PARALLELIZATION = 1;
const KEY_LENGTH = 64;

export async function hashPassword(password) {
  const value = String(password ?? "");
  if (value.length < 14 || value.length > 512) {
    throw new Error("Password must contain between 14 and 512 characters.");
  }
  const salt = randomBytes(24);
  const derived = await scrypt(value, salt, KEY_LENGTH, {
    N: DEFAULT_COST,
    r: DEFAULT_BLOCK_SIZE,
    p: DEFAULT_PARALLELIZATION,
    maxmem: 64 * 1024 * 1024,
  });
  return `scrypt$${DEFAULT_COST}$${DEFAULT_BLOCK_SIZE}$${DEFAULT_PARALLELIZATION}$${salt.toString("base64url")}$${Buffer.from(derived).toString("base64url")}`;
}

export async function verifyPassword(password, digest) {
  const parts = String(digest ?? "").split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const cost = Number(parts[1]);
  const blockSize = Number(parts[2]);
  const parallelization = Number(parts[3]);
  if (cost !== DEFAULT_COST || blockSize !== DEFAULT_BLOCK_SIZE || parallelization !== DEFAULT_PARALLELIZATION) return false;
  const salt = Buffer.from(parts[4], "base64url");
  const expected = Buffer.from(parts[5], "base64url");
  if (salt.length < 16 || expected.length !== KEY_LENGTH) return false;
  const actual = Buffer.from(await scrypt(String(password ?? ""), salt, expected.length, {
    N: cost,
    r: blockSize,
    p: parallelization,
    maxmem: 64 * 1024 * 1024,
  }));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
