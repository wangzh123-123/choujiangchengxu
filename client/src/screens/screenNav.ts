import type { PublicScreen } from "../api/types";

/** Host re-selecting the already-visible screen must not cancel settle hold. */
export function shouldIgnoreScreenNav(
  target: PublicScreen,
  visualScreen: PublicScreen,
): boolean {
  return target === visualScreen;
}
