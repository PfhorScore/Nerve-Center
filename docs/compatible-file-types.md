# Compatible File Types

Nerve Center can open, read, preview, and render the following file types. Files are opened in the appropriate viewer/editor based on their extension.

## Text & Documents

| Extension | Name               | Display Mode         |
|-----------|---------------------|----------------------|
| `.md`     | Markdown            | Rendered markdown    |
| `.txt`    | Plain Text          | Plain text view      |
| `.json`   | JSON                | Rendered / syntax    |
| `.html`   | HTML                | Rendered HTML        |
| `.pdf`    | PDF                 | In-app PDF viewer    |

## Code Files (Syntax Highlighted)

| Extension | Language             |
|-----------|----------------------|
| `.js`     | JavaScript           |
| `.ts`     | TypeScript           |
| `.tsx`    | TypeScript React     |
| `.jsx`    | JavaScript React     |
| `.css`    | CSS                  |
| `.scss`   | SCSS (Sass)          |
| `.json`   | JSON                 |
| `.xml`    | XML                  |
| `.yaml`   | YAML                 |
| `.yml`    | YAML                 |
| `.sh`     | Shell Script         |
| `.bash`   | Bash Script          |
| `.py`     | Python               |
| `.rb`     | Ruby                 |
| `.rs`     | Rust                 |
| `.go`     | Go                   |
| `.java`   | Java                 |
| `.c`      | C                    |
| `.cpp`    | C++                  |
| `.h`      | C/C++ Header         |
| `.sql`    | SQL                  |
| `.toml`   | TOML                 |
| `.ini`    | INI Configuration    |
| `.cfg`    | Configuration        |
| `.env`    | Environment Variables |
| `.gitignore` | Git Ignore        |
| `.dockerignore` | Docker Ignore   |
| `.editorconfig` | Editor Config   |
| `Makefile` | Makefile            |
| `Dockerfile` | Dockerfile        |

## Images

| Extension   | Name          |
|-------------|---------------|
| `.png`      | PNG Image     |
| `.jpg`      | JPEG Image    |
| `.jpeg`     | JPEG Image    |
| `.gif`      | GIF Image     |
| `.webp`     | WebP Image    |
| `.svg`      | SVG Vector    |
| `.ico`      | Icon          |
| `.avif`     | AVIF Image    |
| `.bmp`      | Bitmap        |

## Audio (Playback)

| Extension | Name          |
|-----------|---------------|
| `.mp3`    | MP3 Audio     |
| `.wav`    | WAV Audio     |

## Notes

- **Markdown (`.md`)** is rendered with full formatting including headings, lists, code blocks with syntax highlighting, tables, links, images, and embedded charts.
- **Code files** open in a CodeMirror-based editor with syntax highlighting, line numbers, and search (Ctrl+F).
- **PDF files** (`.pdf`) use an in-app viewer — no external download needed.
- **Images** open in a lightbox-style viewer with zoom support. Supported image types are defined in [`src/features/file-browser/utils/fileTypes.ts`](../src/features/file-browser/utils/fileTypes.ts).
- **Unsupported file types** fall back to a plain text read attempt or display an error message.
