/**
 * Client-side template content resolver.
 * If a resource's URL matches /templates/[slug], resolve its content
 * from the static template map — works even if the DB migration hasn't been run.
 */
import { TEMPLATE_CONTENT } from "@/lib/template-content";

/**
 * Given a resource URL (and optional DB content), resolve the editable content.
 * Returns the DB content if available, or the static template content for /templates/ URLs,
 * or null if this isn't a template resource.
 */
export function resolveTemplateContent(url: string, dbContent?: string | null): string | null {
  // If DB already has content, use it (user may have edited)
  if (dbContent) return dbContent;

  // Check if URL matches /templates/[slug] pattern
  const match = url.match(/^\/templates\/([a-z0-9-]+)$/);
  if (!match) return null;

  const slug = match[1];
  return TEMPLATE_CONTENT[slug] || null;
}
