import type { ChatMsg } from '@/features/chat/types';

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0;
  }
  return hash;
}

function messageSignature(msg: ChatMsg): string {
  const normalizedText = (msg.rawText || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 4000);
  const textHash = hashString(normalizedText).toString(16);
  const tsBucket = Math.floor(msg.timestamp.getTime() / 300_000); // 5-minute buckets for stability
  const flags = [
    msg.isThinking ? 'thinking' : '',
    msg.intermediate ? 'intermediate' : '',
    msg.toolGroup ? `toolGroup:${msg.toolGroup.length}` : '',
    msg.images?.length ? `images:${msg.images.length}` : '',
  ].filter(Boolean).join(',');

  return `${msg.role}|${textHash}|${tsBucket}|${flags}`;
}

function findSuffixPrefixOverlap(existingSigs: string[], recoveredSigs: string[]): number {
  const max = Math.min(existingSigs.length, recoveredSigs.length, 120);
  for (let len = max; len >= 1; len--) {
    let match = true;
    for (let i = 0; i < len; i++) {
      if (existingSigs[existingSigs.length - len + i] !== recoveredSigs[i]) {
        match = false;
        break;
      }
    }
    if (match) return len;
  }
  return 0;
}

/**
 * Find a single-message anchor between existing tail and recovered messages.
 * Searches from the END of the existing array to find the latest match,
 * reducing the risk of hash collisions on short/common messages anchoring
 * at the wrong position.
 */
function findTailAnchor(existingSigs: string[], recoveredSigs: string[]) {
  const tailStart = Math.max(0, existingSigs.length - 160);

  for (let existingIdx = existingSigs.length - 1; existingIdx >= tailStart; existingIdx--) {
    const sig = existingSigs[existingIdx];
    for (let recoveredIdx = 0; recoveredIdx < recoveredSigs.length; recoveredIdx++) {
      if (recoveredSigs[recoveredIdx] === sig) {
        return { existingIdx, recoveredIdx };
      }
    }
  }

  return null;
}

/**
 * Merge a recovered history tail into the current transcript without replacing
 * unaffected prefix messages.
 */
export function mergeRecoveredTail(existing: ChatMsg[], recovered: ChatMsg[]): ChatMsg[] {
  if (recovered.length === 0) return existing;
  if (existing.length === 0) return recovered;

  // First pass: deduplicate by msgId/tempId — remove any recovered messages
  // that already exist in the current list (handles streaming race conditions).
  const existingIds = new Set<string>();
  for (const msg of existing) {
    if (msg.msgId) existingIds.add(msg.msgId);
    if (msg.tempId) existingIds.add(msg.tempId);
  }
  const uniqueRecovered = recovered.filter(
    (msg) => !(msg.msgId && existingIds.has(msg.msgId)) && !(msg.tempId && existingIds.has(msg.tempId))
  );
  if (uniqueRecovered.length === 0) return existing;

  const existingSigs = existing.map(messageSignature);
  const recoveredSigs = uniqueRecovered.map(messageSignature);

  // Fast path: recovered starts where existing tail ends.
  const overlap = findSuffixPrefixOverlap(existingSigs, recoveredSigs);
  if (overlap > 0) {
    return [...existing, ...uniqueRecovered.slice(overlap)];
  }

  // Anchor path: find a matching point in the existing tail and replace only suffix.
  const anchor = findTailAnchor(existingSigs, recoveredSigs);
  if (anchor) {
    const preservedPrefix = existing.slice(0, anchor.existingIdx);
    const patchedTail = uniqueRecovered.slice(anchor.recoveredIdx);
    return [...preservedPrefix, ...patchedTail];
  }

  // Last resort: no overlap/anchor detected, prefer authoritative recovered tail.
  // But still filter out any messages that are text-duplicates of existing ones.
  const existingTexts = new Set(existing.map(m => (m.rawText || '').trim().slice(0, 500)));
  const finalDeduped = uniqueRecovered.filter(m => !existingTexts.has((m.rawText || '').trim().slice(0, 500)));
  if (finalDeduped.length > 0) return finalDeduped;
  return existing;
}
