interface Citation {
  title: string;
  url: string;
}

interface ResearchEntry {
  query: string;
  answer: string;
  citations: Citation[];
}

interface ResearchThread {
  title: string;
  createdAt: number;
  entries: ResearchEntry[];
}

export function safeResearchFilename(title: string, extension: 'md' | 'json'): string {
  const slug = title.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'thread';
  return `research-${slug}.${extension}`;
}

export function researchThreadToMarkdown(thread: ResearchThread): string {
  return `# ${thread.title}

_Research thread — ${new Date(thread.createdAt).toLocaleString()}_

---

${thread.entries.map((entry) => `## Q: ${entry.query}

${entry.answer}

### Sources
${entry.citations.map((citation, index) => `${index + 1}. [${citation.title || 'Untitled'}](${citation.url})`).join('\n')}`).join('\n\n---\n\n')}`;
}

export function researchThreadToJson(thread: ResearchThread): string {
  return JSON.stringify(thread, null, 2);
}

export function downloadResearchFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
