/**
 * Re-export of the shared name/code helpers, so Worker code can import from
 * a local path. The implementation lives in `shared/` because the browser
 * uses the identical logic for live form feedback.
 */
export * from "../../../shared/names";
