// src/lib/sixDegrees/pathVerifier.js
import { canonicalize as defaultCanonicalize } from './titleCanon.js'

// Verifies an explicit path over the body graph. Returns { valid, brokenAt }
// where brokenAt is the index of the first node whose outgoing edge is missing,
// or the last index when the endpoint is not the target.
export async function verifyPath(path, target, {
  getBodyLinks,
  canonicalize = defaultCanonicalize,
} = {}) {
  if (!Array.isArray(path) || path.length < 2) {
    return { valid: false, brokenAt: 0 }
  }
  for (let i = 0; i < path.length - 1; i++) {
    const links = (await getBodyLinks(path[i])).map(canonicalize)
    if (!links.includes(canonicalize(path[i + 1]))) {
      return { valid: false, brokenAt: i }
    }
  }
  const last = canonicalize(path[path.length - 1])
  if (last !== canonicalize(target)) {
    return { valid: false, brokenAt: path.length - 1 }
  }
  return { valid: true, brokenAt: null }
}
