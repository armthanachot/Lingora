import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';

export const readingColors = ['blue', 'purple', 'green', 'red', 'orange'] as const;

const readingSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), 'u'],
  attributes: {
    ...defaultSchema.attributes,
    span: [['className', ...readingColors.map((color) => `reading-color-${color}`)]],
  },
};

export function ReadingContent({ body, format }: { body: string; format?: unknown }) {
  if (format !== 'markdown') return <div className="reading-plain-text">{body}</div>;
  return (
    <div className="reading-markdown">
      <Markdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, readingSchema]]}
        components={{
          a: ({ children, href }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>,
          img: ({ src, alt }) => src ? <img src={src} alt={alt ?? ''} loading="lazy" /> : null,
        }}
      >
        {body}
      </Markdown>
    </div>
  );
}
