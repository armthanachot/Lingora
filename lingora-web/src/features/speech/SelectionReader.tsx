import { useCallback, useEffect, useRef, useState } from 'react';
import { userApi } from '../users';
import { detectReadingLanguage, matchingVoice } from './language';

type Highlight = { text: string; context: string; language: string; x: number; y: number };

export function SelectionReader() {
  const [highlight, setHighlight] = useState<Highlight | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [autoRead, setAutoRead] = useState(false);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState('');
  const toolbar = useRef<HTMLDivElement>(null);
  const currentHighlight = useRef<Highlight | null>(null);
  const lastSelection = useRef('');
  const lastRange = useRef<Range | null>(null);
  const speechRequest = useRef(0);
  const mounted = useRef(true);
  const supported = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

  const stop = useCallback(() => {
    speechRequest.current += 1;
    if (supported) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [supported]);

  const read = useCallback(async (selection: Highlight) => {
    stop();
    setError('');
    if (!supported) { setError('Read aloud is unavailable in this browser.'); return; }
    const request = speechRequest.current;
    const language = await detectReadingLanguage(selection.text, selection.context, selection.language);
    if (!mounted.current || request !== speechRequest.current) return;
    const voices = window.speechSynthesis.getVoices();
    const voice = matchingVoice(voices, language);
    if (!voice) {
      setError(`No reading voice for ${language}. Enable a voice for this language on your device, then try again.`);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(selection.text);
    utterance.lang = voice.lang;
    utterance.voice = voice;
    utterance.onend = () => { if (request === speechRequest.current) setSpeaking(false); };
    utterance.onerror = event => {
      if (request !== speechRequest.current) return;
      setSpeaking(false);
      if (event.error !== 'canceled' && event.error !== 'interrupted') setError('Could not read aloud. Press the speaker to try again.');
    };
    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }, [stop, supported]);

  useEffect(() => {
    mounted.current = true;
    let refreshVersion = 0;
    async function refresh() {
      const version = ++refreshVersion;
      try {
        const preference = await userApi.readingPreferences();
        if (mounted.current && version === refreshVersion) {
          setAutoRead(preference.autoRead);
          setReady(true);
          setError('');
        }
      } catch {
        if (mounted.current && version === refreshVersion) {
          setReady(false);
          setError('Could not load your reading settings. Reopen this page to retry.');
        }
      }
    }
    void refresh();
    window.addEventListener('focus', refresh);
    // Prime browser voice loading; the list can arrive asynchronously.
    if (supported) window.speechSynthesis.getVoices();
    return () => {
      mounted.current = false;
      refreshVersion += 1;
      window.removeEventListener('focus', refresh);
      speechRequest.current += 1;
      if (supported) window.speechSynthesis.cancel();
    };
  }, [supported]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let dragging = false;
    function clear() {
      clearTimeout(timer);
      lastSelection.current = '';
      lastRange.current = null;
      currentHighlight.current = null;
      setHighlight(null);
      setSettingsOpen(false);
      stop();
    }
    function capture() {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !selection.rangeCount) { clear(); return; }
      const range = selection.getRangeAt(0);
      const element = (node: Node) => node instanceof Element ? node : node.parentElement;
      const start = element(range.startContainer);
      const end = element(range.endContainer);
      if (!start || !end || !start.isConnected || !end.isConnected
        || start.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [data-selection-reader]')
        || end.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [data-selection-reader]')) {
        clear(); return;
      }
      const text = selection.toString().trim();
      if (!text || text.length > 5000) { clear(); return; }
      const rect = range.getBoundingClientRect();
      if (!rect.width && !rect.height) { clear(); return; }
      const languageElement = start.closest('[lang], [data-speech-lang]');
      const next: Highlight = {
        text, context: start.closest('p, article, section')?.textContent?.slice(0, 1000) || text,
        language: languageElement?.getAttribute('data-speech-lang')
          || (languageElement?.tagName !== 'HTML' ? languageElement?.getAttribute('lang') : '') || '',
        x: Math.max(8, Math.min(rect.left, window.innerWidth - 290)),
        y: Math.max(8, Math.min(rect.bottom + 8, window.innerHeight - 200)),
      };
      const previousRange = lastRange.current;
      const changed = lastSelection.current !== `${next.language}:${text}`
        || previousRange?.startContainer !== range.startContainer || previousRange?.startOffset !== range.startOffset
        || previousRange?.endContainer !== range.endContainer || previousRange?.endOffset !== range.endOffset;
      lastSelection.current = `${next.language}:${text}`;
      lastRange.current = range.cloneRange();
      currentHighlight.current = next;
      setHighlight(next);
      if (changed) {
        setSettingsOpen(false);
        stop();
        if (autoRead && ready) void read(next);
      }
    }
    function schedule() {
      clearTimeout(timer);
      if (!dragging && !toolbar.current?.contains(document.activeElement)) timer = setTimeout(capture, 250);
    }
    function down(event: PointerEvent) {
      if (toolbar.current?.contains(event.target as Node)) return;
      dragging = true;
      clearTimeout(timer);
      setSettingsOpen(false);
    }
    function up(event: PointerEvent) {
      dragging = false;
      if (!toolbar.current?.contains(event.target as Node)) schedule();
    }
    function key(event: KeyboardEvent) { if (event.key === 'Escape') clear(); }
    function visibility() { if (document.hidden) clear(); }
    document.addEventListener('selectionchange', schedule);
    document.addEventListener('pointerdown', down);
    document.addEventListener('pointerup', up);
    document.addEventListener('pointercancel', up);
    document.addEventListener('keydown', key);
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('scroll', clear, true);
    window.addEventListener('resize', clear);
    window.addEventListener('hashchange', clear);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('selectionchange', schedule);
      document.removeEventListener('pointerdown', down);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('pointercancel', up);
      document.removeEventListener('keydown', key);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('scroll', clear, true);
      window.removeEventListener('resize', clear);
      window.removeEventListener('hashchange', clear);
    };
  }, [autoRead, ready, read, stop]);

  async function savePreference(value: boolean) {
    setSaving(true);
    setError('');
    try {
      const preference = await userApi.updateReadingPreferences(value);
      if (mounted.current) {
        setAutoRead(preference.autoRead);
        if (!preference.autoRead) stop();
      }
    } catch {
      if (mounted.current) setError('Could not save your reading settings. Please try again.');
    } finally { if (mounted.current) setSaving(false); }
  }

  if (!highlight) return null;
  return (
    <div ref={toolbar} className="selection-reader" data-selection-reader
      style={{ left: highlight.x, top: highlight.y }} onPointerDown={event => event.preventDefault()}>
      <div className="selection-reader-buttons" role="group" aria-label="Read selected text">
        <button type="button" aria-label={speaking ? 'Stop reading' : 'Read aloud'} title={speaking ? 'Stop reading' : 'Read aloud'}
          onClick={() => speaking ? stop() : currentHighlight.current && void read(currentHighlight.current)}>
          {speaking ? <span aria-hidden="true">■</span> : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4zM17 8a6 6 0 0 1 0 8M20 5a10 10 0 0 1 0 14" /></svg>}
        </button>
        <button type="button" className="selection-reader-arrow" aria-label="Reading settings" aria-expanded={settingsOpen}
          aria-controls="selection-reader-settings" onClick={() => setSettingsOpen(value => !value)}>
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg>
        </button>
      </div>
      {settingsOpen && <div id="selection-reader-settings" className="selection-reader-settings">
        <strong>Read aloud</strong>
        <button type="button" role="switch" aria-checked={autoRead} disabled={!ready || saving}
          className="selection-reader-switch" onClick={() => void savePreference(!autoRead)}>
          <span>Auto read on highlight</span><span aria-hidden="true">{autoRead ? 'On' : 'Off'}</span>
        </button>
        <small>{saving ? 'Saving…' : 'Applies everywhere for your account. Off = press the speaker to read.'}</small>
      </div>}
      {error && <div className="selection-reader-error" role="alert">{error}</div>}
    </div>
  );
}
