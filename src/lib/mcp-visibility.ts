/**
 * MCP tool call visibility in chat.
 *
 * Controls whether MCP-sourced tool calls are visible in the chat feed.
 * Stored in localStorage for persistence across sessions.
 */

const MCP_VISIBILITY_KEY = 'nerve:mcp:show-in-chat';

/** Default to visible */
function getDefaultVisibility(): boolean {
  return true;
}

/** Read the current MCP visibility setting from localStorage */
export function getMcpChatVisibility(): boolean {
  try {
    const stored = localStorage.getItem(MCP_VISIBILITY_KEY);
    if (stored === null) return getDefaultVisibility();
    return stored === 'true';
  } catch {
    return getDefaultVisibility();
  }
}

/** Persist the MCP visibility setting */
export function setMcpChatVisibility(visible: boolean): void {
  try {
    localStorage.setItem(MCP_VISIBILITY_KEY, String(visible));
  } catch {
    // storage unavailable
  }
}

/** Toggle the current setting */
export function toggleMcpChatVisibility(): boolean {
  const current = getMcpChatVisibility();
  setMcpChatVisibility(!current);
  return !current;
}
