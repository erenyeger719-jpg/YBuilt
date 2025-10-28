// server/intent/assets.ts
// Thin shim so the AI router can suggest/remember vector assets without knowing storage details.

import {
  suggestVectorAssets as _suggestVectorAssets,
  rememberVectorAssets as _rememberVectorAssets,
} from "../media/vector.lib.ts";

export type SuggestArgs = { brand?: any; limit?: number };
export type RememberArgs = { copy?: Record<string, any>; brand?: any };

// Primary API (likely what router.ts expects)
export function suggestVectorAssets(args: SuggestArgs = {}) {
  return _suggestVectorAssets(args);
}
export function rememberVectorAssets(args: RememberArgs = {}) {
  return _rememberVectorAssets(args);
}

// Back-compat aliases (in case router imported older names)
export function suggestAssets(args: SuggestArgs = {}) {
  return _suggestVectorAssets(args);
}
export function rememberAssets(args: RememberArgs = {}) {
  return _rememberVectorAssets(args);
}

export default {
  suggestVectorAssets,
  rememberVectorAssets,
  suggestAssets,
  rememberAssets,
};
