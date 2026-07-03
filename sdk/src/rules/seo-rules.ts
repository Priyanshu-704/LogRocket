import { Issue } from '../types';

/**
 * Validates SEO criteria in the document head: title, description, canonical, and OG tags.
 */
export function checkSEOMetadata(): Omit<Issue, 'id' | 'timestamp'>[] {
  const issues: Omit<Issue, 'id' | 'timestamp'>[] = [];

  if (typeof document === 'undefined') return [];

  // 1. Audit Title
  const title = document.title;
  if (!title || title.trim() === '') {
    issues.push({
      category: 'seo',
      type: 'missing-title',
      severity: 'high',
      title: 'Missing document title tag',
      message: 'The page does not have a <title> element in the <head>. Title tags are crucial for search engine ranking and browser bookmark visibility.'
    });
  } else if (title.length > 60) {
    issues.push({
      category: 'seo',
      type: 'long-title',
      severity: 'low',
      title: 'Title tag exceeds recommended length',
      message: `The title is ${title.length} characters long. Keep titles under 60 characters to prevent truncation in search result lists.`,
      metadata: { length: title.length }
    });
  }

  // 2. Audit Meta Description
  const descriptionMeta = document.querySelector('meta[name="description"]');
  const description = descriptionMeta?.getAttribute('content');
  if (!description || description.trim() === '') {
    issues.push({
      category: 'seo',
      type: 'missing-description',
      severity: 'high',
      title: 'Missing meta description tag',
      message: 'No meta description tag was found. Meta descriptions provide search engines with summary snippets displayed in search outputs.'
    });
  } else if (description.length > 160) {
    issues.push({
      category: 'seo',
      type: 'long-description',
      severity: 'low',
      title: 'Meta description exceeds recommended length',
      message: `Meta description is ${description.length} characters long. Keep descriptions under 160 characters.`,
      metadata: { length: description.length }
    });
  }

  // 3. Audit Canonical URL
  const canonicalLink = document.querySelector('link[rel="canonical"]');
  const canonicalHref = canonicalLink?.getAttribute('href');
  if (!canonicalHref || canonicalHref.trim() === '') {
    issues.push({
      category: 'seo',
      type: 'missing-canonical',
      severity: 'medium',
      title: 'Missing canonical URL link tag',
      message: 'No canonical link tag was found. Canonical links tell search crawlers which URL is the master version, preventing duplicate content index issues.'
    });
  }

  // 4. Audit Open Graph Tags
  const ogTags = ['og:title', 'og:description', 'og:image', 'og:url'];
  const missingOgTags: string[] = [];

  ogTags.forEach(tag => {
    const ogMeta = document.querySelector(`meta[property="${tag}"]`) || document.querySelector(`meta[name="${tag}"]`);
    if (!ogMeta || !ogMeta.getAttribute('content')) {
      missingOgTags.push(tag);
    }
  });

  if (missingOgTags.length > 0) {
    issues.push({
      category: 'seo',
      type: 'missing-og-tags',
      severity: 'low',
      title: 'Missing Open Graph meta tags',
      message: `Social sharing snippet properties are missing: ${missingOgTags.join(', ')}. Include these to style link previews on social platforms.`,
      metadata: { missingTags: missingOgTags }
    });
  }

  return issues;
}
