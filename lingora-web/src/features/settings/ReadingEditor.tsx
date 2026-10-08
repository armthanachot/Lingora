import { useId, useLayoutEffect, useRef, useState } from 'react';
import { ReadingContent, readingColors } from '../lessons/ReadingContent';
import { lessonBuilderApi } from './lessonBuilderApi';

type Selection = { start: number; end: number };
type InsertDialog = { kind: 'link' | 'image'; selection: Selection };

export function ReadingEditor({ body, format, textSize, alignment, onChange }: {
  body: string;
  format: unknown;
  textSize: string;
  alignment: string;
  onChange: (body: string, format: 'plain' | 'markdown') => void;
}) {
  const id = useId();
  const textarea = useRef<HTMLTextAreaElement>(null);
  const selection = useRef<Selection>({ start: 0, end: 0 });
  const [mode, setMode] = useState<'write' | 'preview' | 'split'>('split');
  const [dialog, setDialog] = useState<InsertDialog | null>(null);
  const [url, setUrl] = useState('');
  const [label, setLabel] = useState('');
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const markdown = format === 'markdown';

  useLayoutEffect(() => {
    const input = textarea.current;
    if (!input) return;
    const resize = () => {
      input.style.height = 'auto';
      input.style.height = Math.max(320, input.scrollHeight) + 'px';
    };
    resize();
    let width = input.clientWidth;
    const observer = new ResizeObserver(() => {
      if (input.clientWidth === width) return;
      width = input.clientWidth;
      resize();
    });
    observer.observe(input);
    return () => observer.disconnect();
  }, [body, mode]);

  function rememberSelection() {
    if (textarea.current) selection.current = {
      start: textarea.current.selectionStart,
      end: textarea.current.selectionEnd,
    };
  }

  function insert(prefix: string, suffix = '', fallback = 'text', range = selection.current, replaceSelection = false) {
    const selected = replaceSelection ? fallback : body.slice(range.start, range.end) || fallback;
    onChange(body.slice(0, range.start) + prefix + selected + suffix + body.slice(range.end), 'markdown');
    setMode((current) => current === 'preview' ? 'split' : current);
    requestAnimationFrame(() => {
      textarea.current?.focus();
      textarea.current?.setSelectionRange(range.start + prefix.length, range.start + prefix.length + selected.length);
    });
  }

  function openInsert(kind: 'link' | 'image') {
    setDialog({ kind, selection: { ...selection.current } });
    setLabel(body.slice(selection.current.start, selection.current.end));
    setUrl('');
    setError('');
  }

  function insertUrl() {
    if (!dialog) return;
    let parsed: URL;
    try { parsed = new URL(url.trim()); } catch { setError('Enter a complete URL beginning with https:// or http://.'); return; }
    if (!['https:', 'http:'].includes(parsed.protocol)) { setError('Only https:// and http:// URLs are supported.'); return; }
    const safeLabel = (label || (dialog.kind === 'image' ? 'Image description' : 'Link text')).replace(/[\[\]\\\n\r]/g, ' ');
    const destination = parsed.href.replace(/\(/g, '%28').replace(/\)/g, '%29');
    insert(`${dialog.kind === 'image' ? '!' : ''}[`, `](<${destination}>)`, safeLabel, dialog.selection, true);
    setDialog(null);
  }

  async function uploadImage(file?: File) {
    if (!file || !dialog) return;
    if (!file.type.startsWith('image/')) { setError('Choose an image file.'); return; }
    if (file.size > 50 * 1024 * 1024) { setError('Image must be 50 MB or smaller.'); return; }
    setUploading(true);
    setError('');
    try {
      const result = await lessonBuilderApi.uploadMedia(file);
      setUrl(result.media.url);
      if (!label) setLabel(file.name);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : String(uploadError));
    } finally { setUploading(false); }
  }

  return (
    <div className="reading-editor">
      <div className="reading-editor-heading">
        <label htmlFor={id}>Reading content</label>
        <label className="reading-format-control">Format
          <select aria-label="Reading format" value={markdown ? 'markdown' : 'plain'} onChange={(event) => onChange(body, event.target.value as 'plain' | 'markdown')}>
            <option value="plain">Plain text</option><option value="markdown">Markdown</option>
          </select>
        </label>
      </div>
      <div className="reading-toolbar" role="toolbar" aria-label="Reading formatting">
        <button type="button" title="Bold (⌘/Ctrl+B)" aria-label="Bold" onClick={() => insert('**', '**')}><b>B</b></button>
        <button type="button" title="Italic (⌘/Ctrl+I)" aria-label="Italic" onClick={() => insert('*', '*')}><i>I</i></button>
        <button type="button" title="Underline (⌘/Ctrl+U)" aria-label="Underline" onClick={() => insert('<u>', '</u>')}><u>U</u></button>
        <button type="button" aria-label="Heading" onClick={() => insert('\n\n## ', '\n\n', 'Heading')}>H2</button>
        <button type="button" aria-label="Bullet list" onClick={() => insert('\n\n- ', '\n', 'List item')}>• List</button>
        <button type="button" aria-label="Quote" onClick={() => insert('\n\n> ', '\n\n', 'Quote')}>❝</button>
        <label className="reading-color-picker">Color
          <select aria-label="Text color" value="" onChange={(event) => {
            if (event.target.value) insert(`<span class="reading-color-${event.target.value}">`, '</span>');
          }}>
            <option value="" disabled>Choose…</option>
            {readingColors.map((color) => <option key={color} value={color}>{color}</option>)}
          </select>
        </label>
        <button type="button" onClick={() => openInsert('link')}>Link</button>
        <button type="button" onClick={() => openInsert('image')}>Image</button>
      </div>
      {dialog && (
        <div className="reading-insert-panel" role="group" aria-label={`Insert ${dialog.kind}`}>
          <label> {dialog.kind === 'image' ? 'Image description (alt text)' : 'Link text'}
            <input aria-label={dialog.kind === 'image' ? 'Image description' : 'Link text'} value={label} disabled={uploading} onChange={(event) => setLabel(event.target.value)} />
          </label>
          <label>URL<input aria-label="Insert URL" type="url" placeholder="https://…" value={url} disabled={uploading} onChange={(event) => setUrl(event.target.value)} /></label>
          {dialog.kind === 'image' && <label>Or upload an image<input type="file" accept="image/*" disabled={uploading} onChange={(event) => void uploadImage(event.target.files?.[0])} /></label>}
          {error && <p role="alert">{error}</p>}
          <div><button type="button" disabled={uploading} onClick={insertUrl}>{uploading ? 'Uploading…' : `Insert ${dialog.kind}`}</button><button type="button" disabled={uploading} onClick={() => setDialog(null)}>Cancel</button></div>
        </div>
      )}
      <div className="reading-view-switch" role="group" aria-label="Editor view">
        {(['write', 'preview', 'split'] as const).map((view) => <button type="button" key={view} aria-pressed={mode === view} onClick={() => setMode(view)}>{view === 'write' ? 'Write' : view === 'preview' ? 'Preview' : 'Split view'}</button>)}
      </div>
      <div className={`reading-editor-panes is-${mode}`}>
        {mode !== 'preview' && <textarea
          ref={textarea} id={id} aria-label="Reading content" rows={14} value={body} disabled={Boolean(dialog)}
          placeholder="Write your lesson… Select text, then use the toolbar to format it."
          onSelect={rememberSelection} onBlur={rememberSelection}
          onChange={(event) => onChange(event.target.value, markdown ? 'markdown' : 'plain')}
          onKeyDown={(event) => {
            if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
            const key = event.key.toLowerCase();
            if (!['b', 'i', 'u'].includes(key)) return;
            event.preventDefault(); rememberSelection();
            if (key === 'b') insert('**', '**');
            if (key === 'i') insert('*', '*');
            if (key === 'u') insert('<u>', '</u>');
          }}
        />}
        {mode !== 'write' && <div className={`reading-editor-preview lesson-player-reading is-${textSize === 'small' || textSize === 'large' ? textSize : 'medium'}`} style={{ textAlign: alignment === 'center' ? 'center' : 'left' }} aria-label="Reading preview">
          <div className="lesson-player-reading-body"><ReadingContent body={body} format={format} /></div>
          {!body && <p className="reading-preview-empty">Your lesson preview will appear here.</p>}
        </div>}
      </div>
      <small className="reading-editor-help">Select text to format it. Markdown supports headings, lists, tables, links, and images. Underline and colors use HTML tags added by the toolbar. Save block to keep your changes.</small>
    </div>
  );
}
