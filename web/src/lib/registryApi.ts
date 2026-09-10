import type { RegistryResponse } from "@shared/types";
import { getJson, type ApiResult } from "./http";

/**
 * Client for the registry endpoints.
 *
 * One function, for now. The pledge endpoints exist on the Worker but nothing
 * in the UI calls them yet — the registry page is a list with links, not a
 * claim form. See docs/registry-plan.md for what gets added here when that
 * changes.
 */

/** The whole list: item types, each with the products we have looked at. */
export function fetchRegistry(): Promise<ApiResult<RegistryResponse>> {
  return getJson<RegistryResponse>("/api/registry");
}
