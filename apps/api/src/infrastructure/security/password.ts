import { scrypt as callbackScrypt, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

import { badRequest } from "../../shared/errors.js";

const scrypt = promisify(callbackScrypt);
const KEY_LENGTH = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;

  return [
    "scrypt",
    salt.toString("base64url"),
    derived.toString("base64url")
  ].join("$");
}

export async function verifyPassword(
  password: string,
  passwordHash: string
): Promise<boolean> {
  const [algorithm, salt, hash] = passwordHash.split("$");

  if (
    algorithm !== "scrypt" ||
    !salt ||
    !hash
  ) {
    throw badRequest("Stored password hash is invalid");
  }

  const derived = (await scrypt(
    password,
    Buffer.from(salt, "base64url"),
    KEY_LENGTH
  )) as Buffer;
  const stored = Buffer.from(hash, "base64url");

  return derived.length === stored.length && timingSafeEqual(derived, stored);
}
