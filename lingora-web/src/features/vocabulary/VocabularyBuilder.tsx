import { useEffect, useState } from 'react';
import { languageApi, type Language } from '../languages';
import { lessonBuilderApi } from '../settings/lessonBuilderApi';
import { useDragReorder } from '../settings/useDragReorder';
import { moveItem } from '../settings/reorder';
import { clamp, speakVocabulary, vocabularyApi, type VocabularyItem, type VocabularyPage } from './api';
import { VocabularyScene, VocabularyWords } from './VocabularyScene';
import { normalizeRotation, transformVocabularyItem } from './geometry';

const emptyPage = (language?: Language): VocabularyPage => ({ id: '', languageId: language?.id ?? '', slug: '', title: 'New vocabulary scene', heading: `${language?.name ?? 'English'}–Thai Vocabulary`, translationCode: 'th', category: 'Everyday', description: '', backgroundUrl: '', aspectRatio: 1.5, items: [], isPublished: false, sortOrder: 0, revision: 1 });
export function VocabularyBuilder({ onDirtyChange }: { onDirtyChange?: (dirty: boolean) => void }) {
  const [pages, setPages] = useState<VocabularyPage[]>([]); const [languages, setLanguages] = useState<Language[]>([]);
  const [draft, setDraft] = useState<VocabularyPage | null>(null); const [baseline, setBaseline] = useState('');
  const [selectedId, setSelectedId] = useState(''); const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [filter, setFilter] = useState('');
  const dirty = Boolean(draft && JSON.stringify(draft) !== baseline);
  useEffect(() => { onDirtyChange?.(dirty); return () => onDirtyChange?.(false); }, [dirty, onDirtyChange]);
  const selected = draft?.items.find(i => i.id === selectedId);
  const language = languages.find(l => l.id === draft?.languageId);
  useEffect(() => {
    let cancelled = false;
    void Promise.all([vocabularyApi.adminList(), languageApi.list()]).then(([rows, langs]) => { if (cancelled) return; setPages(rows); setLanguages(langs); if (rows[0]) { setDraft(rows[0]); setBaseline(JSON.stringify(rows[0])); } })
      .catch(e => { if (!cancelled) setError(e.message); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const leave = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', leave); return () => window.removeEventListener('beforeunload', leave);
  }, [dirty]);
  function choose(page: VocabularyPage) {
    if (dirty && !window.confirm('Discard unsaved changes and open another scene?')) return;
    setDraft(structuredClone(page)); setBaseline(JSON.stringify(page)); setSelectedId(''); setPreview(false); setError(''); setNotice('');
  }
  function patch(values: Partial<VocabularyPage>) { setDraft(p => p ? { ...p, ...values } : p); setNotice(''); }
  function changeItem(id: string, values: Partial<VocabularyItem>) {
    setDraft(p => p ? { ...p, items: p.items.map(i => i.id === id ? { ...i, ...values } : i) } : p); setNotice('');
  }
  async function reloadLibrary() {
    if (dirty && !window.confirm('Discard unsaved changes and reload the latest pages?')) return;
    setBusy(true); setError('');
    try {
      const rows = await vocabularyApi.adminList(); setPages(rows);
      const next = rows.find(p => p.id === draft?.id) ?? rows[0] ?? null;
      setDraft(next); setBaseline(JSON.stringify(next)); setSelectedId(''); setNotice('Library reloaded.');
    } catch(e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  const drag = useDragReorder((source, target) => { if (draft) patch({ items: moveItem(draft.items, source, target) }); }, busy || preview);
  const pageDrag = useDragReorder((source, target) => {
    const languageId = pages.find(p => p.id === source)?.languageId;
    if (!languageId) return;
    const group = moveItem(pages.filter(p => p.languageId === languageId), source, target);
    setBusy(true); setError('');
    void vocabularyApi.reorder(languageId, group).then(({ pages: updated }) => {
      setPages(rows => [...rows.filter(p => p.languageId !== languageId), ...updated].sort((a,b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title)));
      const current = updated.find(p => p.id === draft?.id);
      if (current) { setDraft(current); setBaseline(JSON.stringify(current)); }
      setNotice('Scene order saved.');
    }).catch(e => setError(e.message)).finally(() => setBusy(false));
  }, busy || dirty);
  async function upload(file: File | undefined, target: 'background' | 'new' | 'replace') {
    if (!file || !draft) return;
    if (!file.type.startsWith('image/')) { setError('Choose an image file.'); return; }
    setBusy(true); setError('');
    try {
      const { media } = await lessonBuilderApi.uploadMedia(file);
      if (target === 'background') {
        const image = new Image(); image.src = media.url; await image.decode();
        patch({ backgroundUrl: media.url, aspectRatio: clamp(image.naturalWidth / image.naturalHeight, 0.5, 3) });
      } else if (target === 'replace' && selected) changeItem(selected.id, { imageUrl: media.url });
      else {
        const item: VocabularyItem = { id: crypto.randomUUID(), word: 'New word', translation: '', description: '', imageUrl: media.url, mode: 'object', x: 50, y: 65, width: 18, markerX: 44, markerY: 75 };
        patch({ items: [...draft.items, item] }); setSelectedId(item.id);
      }
    } catch(e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function save() {
    if (!draft) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const { page } = await vocabularyApi.save(draft);
      setPages(rows => [...rows.filter(p => p.id !== page.id), page].sort((a,b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title)));
      setDraft(page); setBaseline(JSON.stringify(page)); setNotice(page.isPublished ? 'Saved and published. Learners can explore this scene.' : 'Draft saved. Only admins can see this scene.');
    } catch(e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function remove() {
    if (!draft?.id || !window.confirm('Remove this scene from the vocabulary library?')) return;
    setBusy(true); setError('');
    try { await vocabularyApi.remove(draft.id); const remaining = pages.filter(p => p.id !== draft.id); setPages(remaining); const next = remaining[0] ?? null; setDraft(next); setBaseline(JSON.stringify(next)); setSelectedId(''); setNotice('Scene removed.'); }
    catch(e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  if (loading) return <p role="status">Loading vocabulary studio…</p>;
  return <div className="vocab-builder">
    <div className="vocab-studio-heading"><div><span className="vocab-eyebrow">VOCABULARY STUDIO</span><h2>Build a world of words</h2><p>Place objects, connect words, and publish a scene to explore.</p></div><div className="vocab-studio-actions"><button disabled={busy} onClick={() => void reloadLibrary()}>Reload library</button><button disabled={busy} onClick={() => choose(emptyPage(languages.find(l => l.code === 'en') ?? languages[0]))}>+ New scene</button></div></div>
    {error && <p role="alert" className="auth-error">{error}</p>}{notice && <p className="vocab-notice" role="status">{notice}</p>}
    <div className="vocab-studio-layout">
      <aside className="vocab-studio-library"><label>Scene library<select value={filter} onChange={e => setFilter(e.target.value)}><option value="">All languages</option>{languages.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
        <p className="vocab-editor-hint">Drag handles to reorder scenes within a language. Save edits first.</p>
        {pages.filter(p => !filter || p.languageId === filter).map(p => <div key={p.id} {...pageDrag.rowProps(p.id, p.languageId)} className={`vocab-library-row${pageDrag.targetId === p.id ? ' is-drop-target' : ''}`}>
          {pageDrag.handle(p.id, p.languageId, p.title, pages.filter(row => row.languageId === p.languageId).map(row => row.id))}
          <button disabled={busy} className={draft?.id === p.id ? 'is-active' : ''} onClick={() => choose(p)}><strong>{p.title}</strong><small>{p.category} · {p.items.length} words · {p.isPublished ? 'Published' : 'Draft'}</small></button>
        </div>)}
        {!pages.length && <p>Create your first scene.</p>}
      </aside>
      {draft && <div className="vocab-studio-workspace">
        <div className="vocab-editor-toolbar"><strong>{draft.title}{dirty ? ' · Unsaved' : ''}</strong><button disabled={busy} onClick={() => setPreview(p => !p)}>{preview ? 'Back to editor' : 'Preview'}</button><button disabled={busy || !dirty} className="primary-cta" onClick={() => void save()}>{busy ? 'Working…' : 'Save scene'}</button></div>
        {!preview && <fieldset disabled={busy} className="vocab-editor-fields">
          <label>Scene title<input value={draft.title} onChange={e => patch({ title: e.target.value })} /></label>
          <label>Slug<input value={draft.slug} placeholder="bedroom-english-thai" onChange={e => patch({ slug: e.target.value })} /></label>
          <label>Learning language<select value={draft.languageId} onChange={e => { const l = languages.find(l => l.id === e.target.value); patch({ languageId: e.target.value, heading: `${l?.name ?? ''}–${draft.translationCode === 'th' ? 'Thai' : draft.translationCode} Vocabulary` }); }}><option value="">Choose language</option>{languages.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
          <label>Translation language code<input value={draft.translationCode} onChange={e => patch({ translationCode: e.target.value })} /></label>
          <label>Category<input list="vocab-categories" value={draft.category} onChange={e => patch({ category: e.target.value })} /><datalist id="vocab-categories">{[...new Set(pages.map(p => p.category))].map(c => <option key={c} value={c} />)}</datalist></label>
          <label>Vocabulary heading<input value={draft.heading} onChange={e => patch({ heading: e.target.value })} /></label>
          <label className="vocab-field-wide">Scene description<textarea value={draft.description} onChange={e => patch({ description: e.target.value })} /></label>
          <label>Sort order<input type="number" min="0" max="100000" value={draft.sortOrder} onChange={e => patch({ sortOrder: Math.max(0, Math.round(Number(e.target.value))) })} /></label>
          <label className="vocab-checkbox"><input type="checkbox" checked={draft.isPublished} onChange={e => patch({ isPublished: e.target.checked })} />Published</label>
          <label className="vocab-upload">Upload background<input type="file" accept="image/*" onChange={e => { void upload(e.target.files?.[0], 'background'); e.target.value = ''; }} /></label>
          <label className="vocab-upload">+ Upload object (transparent PNG/WebP)<input type="file" accept="image/*" onChange={e => { void upload(e.target.files?.[0], 'new'); e.target.value = ''; }} /></label>
          <label className="vocab-field-wide">Background image URL<input value={draft.backgroundUrl} onChange={e => patch({ backgroundUrl: e.target.value })} /></label>
          <label>Scene aspect ratio<input type="number" step="0.01" min="0.5" max="3" value={draft.aspectRatio} onChange={e => patch({ aspectRatio: clamp(Number(e.target.value), 0.5, 3) })} /></label>
        </fieldset>}
        <p className="vocab-editor-hint">{preview ? 'Preview: click an object or word to explore it.' : 'Drag an object to place it. Drag a number separately. Select an object and drag ↔ to resize or ↻ to rotate freely.'}</p>
        <VocabularyScene page={{ ...draft, languageCode: language?.code }} selectedId={selectedId} onSelect={setSelectedId} onChange={preview || busy ? undefined : changeItem} />
        {!preview && <div className="vocab-item-editor-layout">
          <div className="vocab-item-list"><h3>Words & order</h3>{draft.items.map((item,index) => <div key={item.id} {...drag.rowProps(item.id, 'vocab-items')} className={`${selectedId === item.id ? 'is-selected' : ''} ${drag.targetId === item.id ? 'is-drop-target' : ''}`}>
            {drag.handle(item.id, 'vocab-items', item.word, draft.items.map(i => i.id))}<button disabled={busy} onClick={() => setSelectedId(item.id)}>{index + 1}. {item.word}</button>
          </div>)}{!draft.items.length && <p>Upload an object to add your first word.</p>}</div>
          {selected ? <fieldset disabled={busy} className="vocab-object-fields"><h3>Object {draft.items.indexOf(selected) + 1}</h3>
            <label>Word<input value={selected.word} onChange={e => changeItem(selected.id, { word: e.target.value })} /></label>
            <label>Translation<input value={selected.translation} onChange={e => changeItem(selected.id, { translation: e.target.value })} /></label>
            <label>Description / example<textarea value={selected.description} onChange={e => changeItem(selected.id, { description: e.target.value })} /></label>
            <label>Rotation °<input type="number" min="0" max="360" step="0.1" value={selected.rotation ?? 0} onChange={e => changeItem(selected.id, { rotation: normalizeRotation(Number(e.target.value)) })} /></label>
            <label>Placement mode<select value={selected.mode} onChange={e => changeItem(selected.id, { mode: e.target.value as VocabularyItem['mode'] })}><option value="object">Object + number</option><option value="marker">Number only (object is in background)</option></select></label>
            <label>Object image URL<input value={selected.imageUrl} onChange={e => changeItem(selected.id, { imageUrl: e.target.value })} /></label>
            <label className="vocab-upload">Replace object image<input type="file" accept="image/*" onChange={e => { void upload(e.target.files?.[0], 'replace'); e.target.value = ''; }} /></label>
            <div className="vocab-position-fields">{(['x','y','width','markerX','markerY'] as const).map(key => <label key={key}>{({ x: 'Object X %', y: 'Object Y %', width: 'Size %', markerX: 'Number X %', markerY: 'Number Y %' })[key]}<input type="number" step="0.5" min={key === 'width' ? 2 : 0} max={key === 'width' ? 80 : 100} value={Math.round(selected[key] * 10) / 10} onChange={e => { const value = clamp(Number(e.target.value), key === 'width' ? 2 : 0, key === 'width' ? 80 : 100); changeItem(selected.id, key === 'x' || key === 'y' ? transformVocabularyItem(selected, 'object', key === 'x' ? value - selected.x : 0, key === 'y' ? value - selected.y : 0) : key === 'width' ? transformVocabularyItem(selected, 'resize', (value - selected.width) / 2, 0) : { [key]: value }); }} /></label>)}</div>
            <button className="vocab-danger" onClick={() => { patch({ items: draft.items.filter(i => i.id !== selected.id) }); setSelectedId(''); }}>Remove object</button>
          </fieldset> : <p className="vocab-empty">Select an object or number to edit its vocabulary.</p>}
        </div>}
        <VocabularyWords page={draft} selectedId={selectedId} onSelect={setSelectedId} onSpeak={preview ? item => { try { speakVocabulary(item.word, language?.code ?? 'en'); } catch(e) { setError((e as Error).message); } } : undefined} />
        {draft.id && !preview && <button disabled={busy} className="vocab-danger" onClick={() => void remove()}>Remove scene</button>}
      </div>}
    </div>
  </div>;
}
