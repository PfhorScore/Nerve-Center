/**
 * nerve-app marker parser.
 *
 * Detects `<!--nerve-app ... -->` markers in message text and
 * extracts the app configuration for inline rendering.
 *
 * Marker format (HTML comment):
 *   <!--nerve-app
 *     type="iframe|tldraw|html"
 *     src="https://..."
 *     height="500"
 *     data="optional json or base64"
 *   -->
 */

export interface AppEmbedConfig {
  type: 'iframe' | 'tldraw' | 'html';
  src?: string;
  height?: number;
  width?: string;
  data?: string;
  /** Raw HTML content for type="html" */
  html?: string;
}

const APP_COMMENT_REGEX = /<!--\s*nerve-app\s+([\s\S]*?)-->/g;

/**
 * Extract the raw attributes string from a nerve-app marker.
 * Multiple markers are supported per message.
 */
function parseAttributeBlock(text: string): string[] {
  const blocks: string[] = [];
  let match: RegExpExecArray | null;
  const regex = new RegExp(APP_COMMENT_REGEX.source, 'g');
  while ((match = regex.exec(text)) !== null) {
    blocks.push(match[1].trim());
  }
  return blocks;
}

/**
 * Parse a single attribute block into key-value pairs.
 * Supports: key="value" key='value' key=value
 */
function parseKeyValues(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const attrRegex = /([a-zA-Z_][a-zA-Z0-9_-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+))/g;
  let m: RegExpExecArray | null;
  while ((m = attrRegex.exec(raw)) !== null) {
    attrs[m[1]] = m[2] ?? m[3] ?? m[4] ?? '';
  }
  return attrs;
}

/**
 * Extract all nerve-app configurations from a message's raw text.
 * Returns an array of configs (one per marker found).
 */
export function extractAppEmbeds(text: string): AppEmbedConfig[] {
  const blocks = parseAttributeBlock(text);
  if (blocks.length === 0) return [];

  return blocks.map((block) => {
    const attrs = parseKeyValues(block);
    const type = (attrs.type || 'iframe') as AppEmbedConfig['type'];
    const parsed: AppEmbedConfig = { type };

    if (attrs.src) parsed.src = attrs.src;
    if (attrs.data) parsed.data = attrs.data;
    if (attrs.html) parsed.html = attrs.html;
    if (attrs.width) parsed.width = attrs.width;
    if (attrs.height) {
      const h = parseInt(attrs.height, 10);
      if (!isNaN(h) && h > 0) parsed.height = h;
    }

    return parsed;
  });
}

/**
 * Strip nerve-app markers from the message text for display.
 */
export function stripAppEmbeds(text: string): string {
  return text.replace(APP_COMMENT_REGEX, '').trim();
}

/**
 * Check if a message contains any nerve-app markers.
 */
export function hasAppEmbeds(text: string): boolean {
  APP_COMMENT_REGEX.lastIndex = 0;
  return APP_COMMENT_REGEX.test(text);
}
