import { describe, expect, it } from 'vitest';
import { boldLead, domainOnly, extractLinks, faviconUrl, linkCitations, parseFollowUps } from './helpers';

const citations = [
  { title: 'First Source', url: 'https://example.com/one', snippet: 'First snippet' },
  { title: 'Second "Quoted" Source', url: 'https://example.com/two' },
];

describe('research helpers', () => {
  it('extracts display domains from URLs', () => {
    expect(domainOnly('https://www.example.com/path')).toBe('example.com');
    expect(domainOnly('not a url value that is quite long')).toBe('not a url value that is quite long');
  });

  it('builds DuckDuckGo favicon URLs for valid URLs', () => {
    expect(faviconUrl('https://www.example.com/path')).toBe('https://icons.duckduckgo.com/ip3/www.example.com.ico');
    expect(faviconUrl('not a url')).toBe('');
  });

  it('bolds only the leading sentence', () => {
    expect(boldLead('This is the lead. This is the rest.')).toBe('**This is the lead**. This is the rest.');
    expect(boldLead('Short.')).toBe('Short.');
  });

  it('extracts unique markdown links in order', () => {
    expect(extractLinks('[One](https://example.com/one) [Again](https://example.com/one) [Two](https://example.com/two)')).toEqual([
      'https://example.com/one',
      'https://example.com/two',
    ]);
  });

  it('parses next-question bullets', () => {
    expect(parseFollowUps('Answer.\n\n## Next questions\n- What changed?\n- Why now?\n\n## Sources')).toEqual([
      'What changed?',
      'Why now?',
    ]);
  });

  it('links only citation markers that have matching citations', () => {
    expect(linkCitations('Use [1] and [2], but not [3] or [2024].', citations, 0)).toBe(
      'Use [[1]](#cite-1-1 "First Source")  and [[2]](#cite-1-2 "Second &quot;Quoted&quot; Source") , but not [3] or [2024].',
    );
  });
});
