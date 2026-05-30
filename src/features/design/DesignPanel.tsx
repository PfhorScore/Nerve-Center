/**
 * DesignPanel — Create mode workspace.
 *
 * Multi-tab code editor with live preview, file save, and agent chat.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { Loader2, RefreshCw, Copy, Check, Save, Plus, FolderOpen } from 'lucide-react';
import { EditorView, basicSetup } from 'codemirror';
import { EditorState, type Extension } from '@codemirror/state';
import { keymap } from '@codemirror/view';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { javascript } from '@codemirror/lang-javascript';
import { markdown } from '@codemirror/lang-markdown';
import { json } from '@codemirror/lang-json';
import { python } from '@codemirror/lang-python';
import { yaml } from '@codemirror/lang-yaml';

/** A file open in the editor. */
interface TabFile {
  /** Display name (e.g. "index.html"). */
  name: string;
  /** Language for CodeMirror highlighting. */
  lang: 'html' | 'css' | 'js' | 'md' | 'json' | 'py' | 'yaml' | 'txt';
  /** Current content. */
  content: string;
  /** Path for saving (null if new/unsaved). */
  path: string | null;
  /** Whether content has been modified since last save. */
  dirty: boolean;
}

type FileLang = TabFile['lang'];

const EXT_LANG: Record<string, FileLang> = {
  html: 'html', htm: 'html',
  css: 'css',
  js: 'js', jsx: 'js', ts: 'js', tsx: 'js', mjs: 'js', cjs: 'js',
  md: 'md', markdown: 'md',
  json: 'json',
  py: 'py', python: 'py',
  yaml: 'yaml', yml: 'yaml',
  txt: 'txt',
};

function langFromName(name: string): FileLang {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  return EXT_LANG[ext] || 'txt';
}

function langExtension(lang: FileLang): Extension {
  switch (lang) {
    case 'html': return html();
    case 'css': return css();
    case 'js': return javascript();
    case 'md': return markdown();
    case 'json': return json();
    case 'py': return python();
    case 'yaml': return yaml();
    default: return [];
  }
}

function langIcon(lang: FileLang): string {
  switch (lang) {
    case 'html': return '🖥';
    case 'css': return '🎨';
    case 'js': return '⚡';
    case 'md': return '📝';
    case 'json': return '📋';
    case 'py': return '🐍';
    default: return '📄';
  }
}

const NEW_TEMPLATES: Record<FileLang, string> = {
  html: '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>New Page</title>\n</head>\n<body>\n  \n</body>\n</html>',
  css: '/* styles */\n',
  js: '// JavaScript\n',
  md: '# Title\n\nStart writing...\n',
  json: '{}',
  py: '# Python\n',
  yaml: '# YAML\n',
  txt: '',
};

function wrapHtml(body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, -apple-system, sans-serif; color: #d0c8bc; background: #0b0f14; min-height: 100vh; padding: 1rem; }
  </style>
</head>
<body>${body}</body>
</html>`;
}

function useDebounce<T extends (...args: string[]) => void>(fn: T, ms: number): T {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  return ((...args: string[]) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => fn(...args as Parameters<T>), ms);
  }) as T;
}

const COLOR_THEME = EditorView.theme({
  '&': { backgroundColor: '#0b0f14', color: '#d0c8bc', fontSize: '13px', fontFamily: "'JetBrains Mono', monospace" },
  '.cm-gutters': { backgroundColor: '#0b0f14', color: '#4a525f', border: 'none' },
  '.cm-activeLineGutter': { backgroundColor: 'rgba(240,179,93,0.05)' },
  '.cm-activeLine': { backgroundColor: 'rgba(240,179,93,0.03)' },
  '.cm-cursor': { borderLeftColor: '#f0b35d' },
  '.cm-selectionBackground': { backgroundColor: 'rgba(240,179,93,0.12)' },
});

const LANG_NAMES: Record<FileLang, string> = { html: 'HTML', css: 'CSS', js: 'JavaScript', md: 'Markdown', json: 'JSON', py: 'Python', yaml: 'YAML', txt: 'Text' };

export function DesignPanel() {
  const [files, setFiles] = useState<TabFile[]>([
    { name: 'index.html', lang: 'html', content: '<h1>Hello, Create Mode!</h1>\n<p style="color: #f0b35d;">Start editing ✨</p>', path: null, dirty: false },
    { name: 'style.css', lang: 'css', content: '/* styles */\nbody { font-family: system-ui; }\nh1 { color: #f0b35d; }', path: null, dirty: false },
  ]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [previewHtml, setPreviewHtml] = useState<string>(() =>
    files[0]?.lang === 'html' ? wrapHtml(files[0].content) : ''
  );
  const [loading, setLoading] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const editorViewRef = useRef<EditorView | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const active = files[activeIdx];

  // Debounced preview update (only for HTML files)
  const debouncedPreview = useDebounce((content: string) => {
    setPreviewHtml(wrapHtml(content));
    setLoading(false);
  }, 500);

  const handleContentChange = useCallback((newContent: string) => {
    setFiles(prev => prev.map((f, i) =>
      i === activeIdx ? { ...f, content: newContent, dirty: true } : f
    ));
    if (files[activeIdx]?.lang === 'html') {
      setLoading(true);
      debouncedPreview(newContent);
    }
  }, [activeIdx, files, debouncedPreview]);

  const refreshPreview = useCallback(() => {
    if (active?.lang === 'html') {
      setLoading(true);
      debouncedPreview(active.content);
    }
  }, [active, debouncedPreview]);



  // Keep refs current for the CodeMirror keymap
  const handleSaveRef = useRef<() => void>(() => {});
  const handleContentChangeRef = useRef<(code: string) => void>(() => {});
  handleContentChangeRef.current = handleContentChange;

  // Initialize CodeMirror
  useEffect(() => {
    if (!editorRef.current) return;
    if (editorViewRef.current) {
      editorViewRef.current.destroy();
      editorViewRef.current = null;
    }

    const extensions: Extension[] = [
      basicSetup,
      COLOR_THEME,
      langExtension(active?.lang || 'txt'),
      keymap.of([{
        key: 'Mod-s',
        run: () => { handleSaveRef.current(); return true; },
      }]),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          handleContentChangeRef.current(update.state.doc.toString());
        }
      }),
    ];

    const state = EditorState.create({
      doc: active?.content || '',
      extensions,
    });

    editorViewRef.current = new EditorView({ state, parent: editorRef.current });
    return () => {
      editorViewRef.current?.destroy();
      editorViewRef.current = null;
    };
  }, [active?.name]); // eslint-disable-line react-hooks/exhaustive-deps

  // Save-as state
  const [showSaveAs, setShowSaveAs] = useState(false);
  const [saveAsPath, setSaveAsPath] = useState('');
  const saveAsInputRef = useRef<HTMLInputElement>(null);

  // Save current file (or prompt for path if unsaved)
  const handleSave = useCallback(async () => {
    if (!active) return;
    if (!active.path) {
      setSaveAsPath(active.name);
      setShowSaveAs(true);
      setTimeout(() => saveAsInputRef.current?.focus(), 50);
      return;
    }
    try {
      const res = await fetch('/api/files/write', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: active.path, content: active.content }),
      });
      if (res.ok) {
        setFiles(prev => prev.map((f, i) =>
          i === activeIdx ? { ...f, dirty: false } : f
        ));
      }
    } catch (e) {
      console.error('Save failed:', e);
    }
  }, [active, activeIdx]);
  handleSaveRef.current = handleSave;

  // Confirm save-as
  const confirmSaveAs = useCallback(async () => {
    if (!active || !saveAsPath.trim()) return;
    const path = saveAsPath.trim();
    try {
      const res = await fetch('/api/files/write', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, content: active.content }),
      });
      if (res.ok) {
        setFiles(prev => prev.map((f, i) =>
          i === activeIdx ? { ...f, path, name: path.split('/').pop() || path, dirty: false } : f
        ));
        setShowSaveAs(false);
      }
    } catch (e) {
      console.error('Save-as failed:', e);
    }
  }, [active, activeIdx, saveAsPath]);

  // New file
  const addTab = useCallback((name: string) => {
    const lang = langFromName(name);
    const content = NEW_TEMPLATES[lang] || '';
    setFiles(prev => [...prev, { name, lang, content, path: null, dirty: false }]);
    setActiveIdx(files.length);
  }, [files.length]);

  // Close tab
  const closeTab = useCallback((idx: number) => {
    setFiles(prev => {
      const next = prev.filter((_, i) => i !== idx);
      if (next.length === 0) {
        next.push({ name: 'untitled.txt', lang: 'txt', content: '', path: null, dirty: false });
      }
      return next;
    });
    setActiveIdx(prev => Math.min(prev, files.length - 2));
  }, [files.length]);

  // Open file from workspace
  const openFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const content = await file.text();
    const name = file.name;
    const lang = langFromName(name);
    setFiles(prev => [...prev, { name, lang, content, path: null, dirty: false }]);
    setActiveIdx(files.length);
    e.target.value = '';
  }, [files.length]);

  // Copy HTML
  const [copied, setCopied] = useState(false);
  const copyContent = useCallback(() => {
    if (!active) return;
    navigator.clipboard.writeText(active.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [active]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border/40 bg-secondary/20 shrink-0">
        <span className="text-[0.6rem] font-semibold uppercase tracking-wider text-primary/70">🖥 Create</span>
        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => fileInputRef.current?.click()} className="shell-icon-button min-h-7 px-2 text-[0.55rem]" title="Open file">
            <FolderOpen size={11} />
            <span className="hidden sm:inline ml-1">Open</span>
          </button>
          <input ref={fileInputRef} type="file" className="hidden" onChange={openFile} accept=".html,.css,.js,.jsx,.ts,.tsx,.md,.json,.py,.yaml,.yml,.txt" />
          <button onClick={() => addTab('new.html')} className="shell-icon-button min-h-7 px-2 text-[0.55rem]" title="New file">
            <Plus size={11} />
            <span className="hidden sm:inline ml-1">New</span>
          </button>
          <button onClick={handleSave} className="shell-icon-button min-h-7 px-2 text-[0.55rem]" title="Save (Cmd+S)">
            <Save size={11} className={active?.dirty ? 'text-primary' : ''} />
            <span className="hidden sm:inline ml-1">{active?.dirty ? 'Save' : active?.path ? 'Saved' : 'Save as…'}</span>
          </button>
          <button onClick={copyContent} className="shell-icon-button min-h-7 px-2 text-[0.55rem]" title="Copy">
            {copied ? <Check size={11} className="text-green" /> : <Copy size={11} />}
          </button>
          {active?.lang === 'html' && (
            <button onClick={refreshPreview} className="shell-icon-button min-h-7 px-2 text-[0.55rem]" title="Refresh preview">
              <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
            </button>
          )}
        </div>
      </div>

      {/* Save-as dialog */}
      {showSaveAs && (
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border/40 bg-secondary/20">
          <span className="text-[0.55rem] text-muted-foreground/70 whitespace-nowrap">Save as:</span>
          <input
            ref={saveAsInputRef}
            type="text"
            value={saveAsPath}
            onChange={(e) => setSaveAsPath(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') confirmSaveAs();
              if (e.key === 'Escape') setShowSaveAs(false);
            }}
            className="flex-1 bg-background border border-border/30 rounded px-2 py-1 text-[0.6rem] text-foreground font-mono outline-none focus:border-primary/40"
            placeholder="path/to/file.html"
          />
          <button onClick={confirmSaveAs} className="shell-icon-button min-h-6 px-2 text-[0.55rem] bg-primary/10 text-primary">Save</button>
          <button onClick={() => setShowSaveAs(false)} className="shell-icon-button min-h-6 px-2 text-[0.55rem] text-muted-foreground/60">Cancel</button>
        </div>
      )}
      {/* File tabs */}
      <div className="flex items-center gap-0 border-b border-border/40 bg-card shrink-0 overflow-x-auto px-1">
        {files.map((f, i) => (
          <div key={`${f.name}-${i}`} onClick={() => setActiveIdx(i)}
            className={`group flex items-center gap-1.5 px-3 py-1.5 text-[0.6rem] border-b-2 cursor-pointer transition-colors shrink-0 ${
              i === activeIdx ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground/60 hover:text-muted-foreground'
            }`}
          >
            <span>{langIcon(f.lang)}</span>
            <span className={f.dirty ? 'italic' : ''}>{f.name}</span>
            {files.length > 1 && (
              <button onClick={(e) => { e.stopPropagation(); closeTab(i); }}
                className="ml-0.5 opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity text-[0.5rem]"
              >✕</button>
            )}
          </div>
        ))}
      </div>

      {/* Split pane */}
      <div className="flex flex-1 min-h-0">
        {/* Chat sidebar (left) */}
        <div className="w-72 min-w-0 border-r border-border/40 bg-card flex flex-col shrink-0">
          <div className="px-4 py-2 border-b border-border/40 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-[0.55rem] font-semibold uppercase tracking-wider text-primary/60">✦ Chat</span>
              <span className="text-[0.5rem] text-muted-foreground/40">· Durandal</span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            <div className="text-[0.6rem]">
              <span className="text-[0.5rem] font-semibold uppercase tracking-wider text-muted-foreground/70">You</span>
              <p className="text-muted-foreground/70 mt-0.5 leading-relaxed">Build me a landing page for my game project</p>
            </div>
            <div className="text-[0.6rem]">
              <span className="text-[0.5rem] font-semibold uppercase tracking-wider text-primary/70">Durandal</span>
              <p className="text-muted-foreground/70 mt-0.5 leading-relaxed">I've started a hero section in <span className="text-primary/80">index.html</span>. The preview pane updates automatically as I make changes.</p>
            </div>
            <div className="text-[0.6rem]">
              <span className="text-[0.5rem] font-semibold uppercase tracking-wider text-muted-foreground/70">You</span>
              <p className="text-muted-foreground/70 mt-0.5 leading-relaxed">Make the hero gradient more dramatic and add a features section below</p>
            </div>
          </div>
          <div className="shrink-0 border-t border-border/40 p-3">
            <div className="flex items-center gap-2">
              <input type="text" placeholder="Ask Durandal..." className="flex-1 bg-secondary/40 border border-border/40 rounded-lg px-3 py-1.5 text-[0.6rem] text-foreground outline-none focus:border-primary/30 font-mono" />
              <button className="shell-icon-button size-7 bg-primary/10 text-primary shrink-0" title="Send">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13"/><path d="m22 2-7 20-4-9-9-4 20-7z"/></svg>
              </button>
            </div>
          </div>
        </div>

        {/* Editor */}
        <div className={active?.lang === 'html' ? 'w-1/2 min-w-0 border-r border-border/40 flex flex-col' : 'flex-1 flex flex-col'}>
          <div className="flex-1 overflow-hidden" ref={editorRef} />
        </div>

        {/* HTML Live Preview */}
        {active?.lang === 'html' && (
          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex items-center gap-2 px-3 py-1 border-b border-border/40 bg-secondary/10 shrink-0">
              <span className="text-[0.5rem] uppercase tracking-wider text-muted-foreground/50">Preview</span>
              <div className="flex items-center gap-1 ml-auto">
                <button className="shell-icon-button min-h-5 px-1.5 text-[0.5rem]" title="Mobile 375px">📱</button>
                <button className="shell-icon-button min-h-5 px-1.5 text-[0.5rem]" title="Tablet 768px">📐</button>
                <button className="shell-icon-button min-h-5 px-1.5 text-[0.5rem] bg-primary/10 text-primary" title="Desktop 100%">🖥</button>
              </div>
            </div>
            <div className="flex-1 relative overflow-hidden">
              {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-card/80 z-10">
                  <Loader2 size={14} className="animate-spin mr-2" />
                  <span className="text-[0.6rem] text-muted-foreground">Rendering...</span>
                </div>
              )}
              {previewHtml ? (
                <iframe srcDoc={previewHtml} className="h-full w-full border-0" sandbox="allow-scripts allow-same-origin" title="Preview" onLoad={() => setLoading(false)} />
              ) : (
                <div className="h-full flex items-center justify-center text-[0.6rem] text-muted-foreground/30">Preview available for HTML files</div>
              )}
            </div>
          </div>
        )}

        {/* Non-HTML preview */}
        {active && active.lang !== 'html' && active.lang !== 'css' && (
          <div className="w-48 min-w-0 border-l border-border/40 bg-secondary/5 flex flex-col overflow-hidden">
            <div className="px-3 py-1.5 text-[0.5rem] uppercase tracking-wider text-muted-foreground/50 border-b border-border/20 shrink-0">
              {LANG_NAMES[active.lang] || 'File'}
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              <pre className="text-[0.6rem] text-muted-foreground/50 whitespace-pre-wrap font-mono break-all">
                {active.content.slice(0, 500)}{active.content.length > 500 ? '\n...' : ''}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
