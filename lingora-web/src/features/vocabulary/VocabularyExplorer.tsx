import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { languageApi, type Language } from '../languages';
import { clamp, speakVocabulary, vocabularyApi, vocabularyReaderCache, type VocabularyItem, type VocabularyPage, type VocabularySummary } from './api';
import { categoryNeighbours } from './readerCache';
import { normalizeRotation, transformVocabularyItem } from './geometry';
import { VocabularyScene, VocabularyWords } from './VocabularyScene';
import { BrandMark } from '../../components/BrandMark';

export function VocabularyExplorer({ route, accountSlot, isAdmin = false, onLeaveGuardChange }: { route: string; accountSlot: ReactNode; isAdmin?: boolean; onLeaveGuardChange?: (guard: (() => boolean) | null) => void }) {
  const parts = route.replace(/^#vocab\/?/, '').split('/');
  const languageId = parts[0] || ''; const pageId = parts[1] || '';
  const [languages, setLanguages] = useState<Language[]>([]);
  const [pages, setPages] = useState<VocabularySummary[]>([]);
  const [savedPage, setPage] = useState<VocabularyPage | null>(null);
  const [draft, setDraft] = useState<VocabularyPage | null>(null);
  const [saving, setSaving] = useState(false); const [notice, setNotice] = useState('');
  const page = draft ?? savedPage;
  const editing = isAdmin && Boolean(draft);
  const dirty = Boolean(draft && JSON.stringify(draft) !== JSON.stringify(savedPage));
  const [selectedId, setSelectedId] = useState('');
  const [search, setSearch] = useState(''); const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const [zoom, setZoom] = useState(1);
  const [transition, setTransition] = useState('');
  const visiblePage = useRef(savedPage); visiblePage.current = savedPage;
  const languagesRequest = useRef<Promise<Language[]> | null>(null);
  useEffect(() => {
    let cancelled = false; let timer: ReturnType<typeof setTimeout> | undefined;
    setLoading(true); setError(''); if (!pageId) setPage(null); setDraft(null); setNotice(''); setTransition('');
    if (!languagesRequest.current) languagesRequest.current = languageApi.list().catch(error => { languagesRequest.current = null; throw error; });
    void Promise.all([languagesRequest.current, vocabularyReaderCache.list(languageId || undefined), pageId ? vocabularyReaderCache.get(pageId) : Promise.resolve(null)])
      .then(async ([langs, summaries, detail]) => {
        if (detail) await vocabularyReaderCache.assets(detail);
        if (cancelled) return;
        const animate = detail && visiblePage.current && detail.id !== visiblePage.current.id && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (animate) { setTransition('out'); await new Promise<void>(resolve => { timer = setTimeout(resolve, 140); }); }
        if (cancelled) return;
        setLanguages(langs); setPages(summaries); setPage(detail); setSearch(''); setCategory(''); setSelectedId(''); setZoom(1); setTransition(animate ? 'in' : '');
      })
      .catch(e => { if (!cancelled) { setError(e.message); setTransition(''); } }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; if (timer) clearTimeout(timer); window.speechSynthesis?.cancel(); };
  }, [languageId, pageId]);
  useEffect(() => {
    if (loading || !savedPage || savedPage.id !== pageId) return;
    const next = categoryNeighbours(pages, savedPage).next;
    if (!next) return;
    // Exactly one neighbour; completion does not recursively preload further pages.
    let cancelled = false;
    const timer = setTimeout(() => { void vocabularyReaderCache.prefetch(next.id, () => !cancelled).catch(() => {}); }, 200);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [loading, savedPage, pages, pageId]);
  useEffect(() => {
    const leave = () => !saving && (!dirty || window.confirm('Discard unsaved vocabulary changes?'));
    onLeaveGuardChange?.(leave);
    const unload = (event: BeforeUnloadEvent) => { if (dirty || saving) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', unload);
    return () => { onLeaveGuardChange?.(null); window.removeEventListener('beforeunload', unload); };
  }, [dirty, saving, onLeaveGuardChange]);
  useEffect(() => { if (!isAdmin) setDraft(null); }, [isAdmin]);
  function changeItem(id: string, patch: Partial<VocabularyItem>) {
    if (!isAdmin || saving) return;
    setDraft(current => current ? { ...current, items: current.items.map(item => item.id === id ? { ...item, ...patch } : item) } : null);
    setNotice('');
  }
  async function save() {
    if (!isAdmin || !draft || saving) return;
    setSaving(true); setError(''); setNotice('');
    try {
      const result = await vocabularyApi.save(draft);
      const updated = { ...result.page, languageCode: savedPage?.languageCode, languageName: savedPage?.languageName };
      setPage(updated); setDraft(null); setPages(rows => rows.map(row => row.id === updated.id ? updated : row)); setNotice('Vocabulary changes saved.');
    } catch(e) { setError((e as Error).message); }
    finally { setSaving(false); }
  }
  async function reloadPage() {
    if (saving || (dirty && !window.confirm('Discard edits and load the latest vocabulary page?'))) return;
    setSaving(true); setError('');
    try { const latest = await vocabularyReaderCache.get(pageId, true); await vocabularyReaderCache.assets(latest); setPage(latest); setDraft(null); setNotice('Latest page loaded.'); }
    catch(e) { setError((e as Error).message); } finally { setSaving(false); }
  }
  const query = search.trim().toLocaleLowerCase();
  const filtered = pages.filter(p => (!category || p.category === category) && (!query || `${p.title} ${p.description} ${p.category}`.toLocaleLowerCase().includes(query)));
  const matchingIds = useMemo(() => !query || !page ? undefined : new Set(page.items.filter(i => `${i.word} ${i.translation} ${i.description}`.toLocaleLowerCase().includes(query)).map(i => i.id)), [page, query]);
  const selected = page?.items.find(i => i.id === selectedId);
  const currentLanguage = languages.find(l => l.id === languageId);
  const neighbours = savedPage ? categoryNeighbours(pages, savedPage) : { previous: undefined, next: undefined };
  return <div className="vocab-explorer">
    <header className="vocab-header"><a className="vocab-brand" href="#app"><BrandMark /><span>Lingora</span></a>{accountSlot}</header>
    <main className={`vocab-main${transition ? ` vocab-page-${transition}` : ''}`} aria-busy={loading}>
      <a className="vocab-back" href={page ? `#vocab/${page.languageId}` : '#app'}>← {page ? 'All vocabulary scenes' : 'Back to globe'}</a>
      <div className="vocab-page-heading"><div><span className="vocab-eyebrow">EXPLORE VOCAB</span><h1>{page?.title ?? `${currentLanguage?.name ?? 'Picture'} vocabulary`}</h1><p>{page?.description ?? 'Look around. Discover a word. Make it yours.'}</p></div>
        {!page && <label>Learning language<select aria-label="Vocabulary language" value={languageId} onChange={e => { window.location.hash = `vocab/${e.target.value}`; }}><option value="">All languages</option>{languages.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>}
        {page && isAdmin && <div className="vocab-inline-actions">{editing ? <><button disabled={saving || !dirty} className="primary-cta" onClick={() => void save()}>{saving ? 'Saving…' : 'Save changes'}</button><button disabled={saving} onClick={() => { setDraft(null); setError(''); setNotice(''); }}>Cancel edits</button><button disabled={saving} onClick={() => void reloadPage()}>Reload page</button></> : <button disabled={saving || loading} onClick={() => { setDraft(structuredClone(savedPage!)); setSearch(''); setZoom(1); setError(''); setNotice(''); }}>Edit vocabulary</button>}</div>}
      </div>
      {error && <p role="alert" className="auth-error">{error}</p>}
      {notice && <p role="status" className="vocab-notice">{notice}</p>}
      {loading && <p role="status" className="vocab-opening">{page ? 'Opening next scene…' : 'Loading vocabulary…'}</p>}
      {error && pageId && !editing && <button className="vocab-retry" disabled={saving} onClick={() => { window.location.hash = `vocab/${languageId}`; }}>Back to vocabulary library</button>}
      {page ? <>
        <nav className="vocab-page-turns" aria-label="Scenes in this category"><span>{page.category}</span>{neighbours.previous && <a href={`#vocab/${neighbours.previous.languageId}/${neighbours.previous.id}`} aria-label={`Previous scene: ${neighbours.previous.title}`}>← {neighbours.previous.title}</a>}{neighbours.next && <a href={`#vocab/${neighbours.next.languageId}/${neighbours.next.id}`} aria-label={`Next scene: ${neighbours.next.title}`}>{neighbours.next.title} →</a>}</nav>
        {editing && <div className="vocab-inline-editor"><p className="vocab-editor-hint">{dirty ? 'Unsaved changes. ' : ''}Drag an object to move it, drag its number separately, or select an object and drag ↔ to resize or ↻ to rotate freely. Save changes when finished.</p><fieldset disabled={saving} className="vocab-editor-fields"><label>Scene title<input value={page.title} onChange={e => setDraft(current => current ? { ...current, title: e.target.value } : null)} /></label><label>Vocabulary heading<input value={page.heading} onChange={e => setDraft(current => current ? { ...current, heading: e.target.value } : null)} /></label></fieldset></div>}
        <div className="vocab-reader-tools"><input aria-label="Search words in scene" placeholder="Find a word in this scene…" value={search} onChange={e => setSearch(e.target.value)} /><span aria-live="polite">{matchingIds ? `${matchingIds.size} matches` : `${page.items.length} words`}</span><button onClick={() => setZoom(z => Math.max(1, z - 0.25))} disabled={zoom === 1} aria-label="Zoom out">−</button><button onClick={() => setZoom(z => Math.min(2, z + 0.25))} disabled={zoom === 2} aria-label="Zoom in">+</button><button onClick={() => setZoom(1)}>Reset</button></div>
        <div className="vocab-scene-scroll"><div style={{ width: `${zoom * 100}%` }}><VocabularyScene page={page} selectedId={selectedId} matchingIds={matchingIds} onSelect={setSelectedId} onChange={editing && !saving ? changeItem : undefined} /></div></div>
        {editing && selected && <fieldset disabled={saving} className="vocab-editor-fields vocab-inline-word"><label>Word<input value={selected.word} onChange={e => changeItem(selected.id, { word: e.target.value })} /></label><label>Rotation °<input type="number" min="0" max="360" step="0.1" value={selected.rotation ?? 0} onChange={e => changeItem(selected.id, { rotation: normalizeRotation(Number(e.target.value)) })} /></label><label>Translation<input value={selected.translation} onChange={e => changeItem(selected.id, { translation: e.target.value })} /></label><label className="vocab-field-wide">Description / example<textarea value={selected.description} onChange={e => changeItem(selected.id, { description: e.target.value })} /></label><div className="vocab-position-fields vocab-field-wide">{(['x', 'y', 'width', 'markerX', 'markerY'] as const).map(key => <label key={key}>{({ x: 'Object X %', y: 'Object Y %', width: 'Size %', markerX: 'Number X %', markerY: 'Number Y %' })[key]}<input type="number" step="0.5" min={key === 'width' ? 2 : 0} max={key === 'width' ? 80 : 100} value={selected[key]} onChange={e => { const value = clamp(Number(e.target.value), key === 'width' ? 2 : 0, key === 'width' ? 80 : 100); changeItem(selected.id, key === 'x' || key === 'y' ? transformVocabularyItem(selected, 'object', key === 'x' ? value - selected.x : 0, key === 'y' ? value - selected.y : 0) : key === 'width' ? transformVocabularyItem(selected, 'resize', (value - selected.width) / 2, 0) : { [key]: value }); }} /></label>)}</div></fieldset>}
        {selected && <div className="vocab-selected-detail" aria-live="polite"><div><strong>{selected.word}</strong><span>{selected.translation}</span>{selected.description && <p>{selected.description}</p>}</div><button onClick={() => { try { speakVocabulary(selected.word, page.languageCode || 'en'); } catch(e) { setError((e as Error).message); } }}>🔊 Read aloud</button><button aria-label="Close word details" onClick={() => setSelectedId('')}>×</button></div>}
        <VocabularyWords page={page} selectedId={selectedId} matchingIds={matchingIds} onSelect={setSelectedId} onSpeak={item => { try { speakVocabulary(item.word, page.languageCode || 'en'); } catch(e) { setError((e as Error).message); } }} />
        <nav className="vocab-scene-navigation" aria-label="Other vocabulary scenes">{pages.map(p => <a key={p.id} className={p.id === page.id ? 'is-active' : ''} href={`#vocab/${p.languageId}/${p.id}`}>{p.title}</a>)}</nav>
      </> : !loading && <>
        <div className="vocab-reader-tools"><input aria-label="Search vocabulary scenes" placeholder="Search scenes…" value={search} onChange={e => setSearch(e.target.value)} /><select aria-label="Vocabulary category" value={category} onChange={e => setCategory(e.target.value)}><option value="">All categories</option>{[...new Set(pages.map(p => p.category))].sort().map(c => <option key={c}>{c}</option>)}</select><span>{filtered.length} scenes</span></div>
        <div className="vocab-gallery">{filtered.map(p => <a className="vocab-gallery-card" key={p.id} href={`#vocab/${p.languageId}/${p.id}`}><div className="vocab-miniature" style={{ aspectRatio: p.aspectRatio }}><img src={p.backgroundUrl} alt={`${p.title} vocabulary scene`} loading="lazy" />{p.items.map((item,index) => <span key={item.id}>{item.mode === "object" && <img className="vocab-mini-object" src={item.imageUrl} alt="" loading="lazy" style={{ left: `${item.x}%`, top: `${item.y}%`, width: `${item.width}%`, transform: `translate(-50%, -50%) rotate(${item.rotation ?? 0}deg)` }} />}<span className="vocab-mini-marker" style={{ left: `${item.markerX}%`, top: `${item.markerY}%` }}>{index + 1}</span></span>)}</div><div><span className="vocab-eyebrow">{p.category} · {p.languageName}</span><h2>{p.title}</h2><p>{p.description}</p><span className="vocab-card-link">Explore scene →</span></div></a>)}</div>
        {!filtered.length && <p className="vocab-empty">{pages.length ? 'No scenes match your search.' : 'New vocabulary scenes are on their way for this language.'}</p>}
      </>}
    </main>
  </div>;
}
