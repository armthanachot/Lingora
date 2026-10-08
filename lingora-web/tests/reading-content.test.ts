import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReadingContent } from '../src/features/lessons/ReadingContent';

function render(body: string, format?: string) {
  return renderToStaticMarkup(createElement(ReadingContent, { body, format }));
}

describe('Reading content', () => {
  test('keeps legacy text literal instead of interpreting Markdown or HTML', () => {
    const html = render('**Hello**\n<u>Goodbye</u>');
    expect(html).toContain('**Hello**');
    expect(html).toContain('&lt;u&gt;');
    expect(html).not.toContain('<strong>');
  });

  test('renders lesson formatting, underline, colors, links and images', () => {
    const html = render('## Hello\n\n**Bold** *Italic* <u>Underline</u> <span class="reading-color-blue">Blue</span>\n\n[Practice](https://example.com)\n\n![Cafe](https://example.com/cafe.png)\n\n- Hi\n- Bye', 'markdown');
    expect(html).toContain('<h2>Hello</h2>');
    expect(html).toContain('<strong>Bold</strong>');
    expect(html).toContain('<em>Italic</em>');
    expect(html).toContain('<u>Underline</u>');
    expect(html).toContain('class="reading-color-blue"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('alt="Cafe"');
    expect(html).toContain('<li>Hi</li>');
  });

  test('supports line breaks and GFM tables', () => {
    const html = render('Hello\nGoodbye\n\n| English | Thai |\n| --- | --- |\n| Hello | สวัสดี |', 'markdown');
    expect(html).toContain('<br/>');
    expect(html).toContain('<table>');
    expect(html).toContain('สวัสดี');
  });

  test('removes scripts, handlers, arbitrary styles and unsafe URLs', () => {
    const html = render('<script>alert(1)</script><img src="https://example.com/a.png" onerror="alert(2)"><span class="evil reading-color-red" style="position:fixed">Hi</span><iframe src="https://example.com"></iframe>\n\n[bad](javascript:alert%281%29)\n\n![bad](data:image/svg+xml,bad)', 'markdown');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('onerror');
    expect(html).not.toContain('style=');
    expect(html).not.toContain('evil');
    expect(html).not.toContain('<iframe');
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('data:image');
  });
});
