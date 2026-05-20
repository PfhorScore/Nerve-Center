// Module-level bridge for chat → research handoff.
// Avoids race conditions from custom events firing before lazy components mount.

let _pendingTranscript: string | null = null;

export function setPendingTranscript(transcript: string) {
  _pendingTranscript = transcript;
}

export function takePendingTranscript(): string | null {
  const t = _pendingTranscript;
  _pendingTranscript = null;
  return t;
}
