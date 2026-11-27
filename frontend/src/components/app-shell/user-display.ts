/**
 * How the user summary names the signed-in person (sidebar-nav ui-design
 * §畫面狀態 empty row; prototype `computeAvatarInitials`, sidebar.js:156).
 */
import type { ShellUser } from "./types";

/** Zero-width characters a name can be made of without showing anything. */
const ZERO_WIDTH = /[​‌‍﻿]/g;

/** The name to show: the display name, or the email when the name is empty. */
export function shownName(user: ShellUser): string {
  return user.name.replace(ZERO_WIDTH, "").trim() === "" ? user.email : user.name;
}

/**
 * The avatar's letters: the first letter of each word, upper-cased, so
 * 「王小明」 gives 「王」 and "Ada Lovelace" gives "AL". Text made only of
 * zero-width characters or spaces gives "U".
 */
export function avatarInitials(text: string): string {
  const words = text
    .replace(ZERO_WIDTH, "")
    .split(/\s+/)
    .filter((word) => word !== "");
  if (words.length === 0) {
    return "U";
  }
  return words.map((word) => (Array.from(word)[0] ?? "").toUpperCase()).join("");
}
