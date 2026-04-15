-- Fix RLS policies for wiki tables
-- The "FOR ALL USING" policy doesn't properly set WITH CHECK for INSERT
-- Split into explicit per-operation policies

-- ── wiki_synthesis_logs ──────────────────────────────────────────
DROP POLICY IF EXISTS "wiki_synthesis_logs_select" ON wiki_synthesis_logs;
DROP POLICY IF EXISTS "wiki_synthesis_logs_all" ON wiki_synthesis_logs;
DROP POLICY IF EXISTS "wiki_synthesis_logs_insert" ON wiki_synthesis_logs;
DROP POLICY IF EXISTS "wiki_synthesis_logs_update" ON wiki_synthesis_logs;
DROP POLICY IF EXISTS "wiki_synthesis_logs_delete" ON wiki_synthesis_logs;

CREATE POLICY "wiki_synthesis_logs_select" ON wiki_synthesis_logs
  FOR SELECT USING (true);

CREATE POLICY "wiki_synthesis_logs_insert" ON wiki_synthesis_logs
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "wiki_synthesis_logs_update" ON wiki_synthesis_logs
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "wiki_synthesis_logs_delete" ON wiki_synthesis_logs
  FOR DELETE USING (auth.role() = 'authenticated');

-- ── wiki_weekly_resources ────────────────────────────────────────
DROP POLICY IF EXISTS "wiki_weekly_resources_select" ON wiki_weekly_resources;
DROP POLICY IF EXISTS "wiki_weekly_resources_all" ON wiki_weekly_resources;
DROP POLICY IF EXISTS "wiki_weekly_resources_insert" ON wiki_weekly_resources;
DROP POLICY IF EXISTS "wiki_weekly_resources_update" ON wiki_weekly_resources;
DROP POLICY IF EXISTS "wiki_weekly_resources_delete" ON wiki_weekly_resources;

CREATE POLICY "wiki_weekly_resources_select" ON wiki_weekly_resources
  FOR SELECT USING (true);

CREATE POLICY "wiki_weekly_resources_insert" ON wiki_weekly_resources
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "wiki_weekly_resources_update" ON wiki_weekly_resources
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "wiki_weekly_resources_delete" ON wiki_weekly_resources
  FOR DELETE USING (auth.role() = 'authenticated');

-- ── wiki_topics ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "wiki_topics_select" ON wiki_topics;
DROP POLICY IF EXISTS "wiki_topics_all" ON wiki_topics;
DROP POLICY IF EXISTS "wiki_topics_insert" ON wiki_topics;
DROP POLICY IF EXISTS "wiki_topics_update" ON wiki_topics;
DROP POLICY IF EXISTS "wiki_topics_delete" ON wiki_topics;

CREATE POLICY "wiki_topics_select" ON wiki_topics
  FOR SELECT USING (true);

CREATE POLICY "wiki_topics_insert" ON wiki_topics
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "wiki_topics_update" ON wiki_topics
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "wiki_topics_delete" ON wiki_topics
  FOR DELETE USING (auth.role() = 'authenticated');

-- ── wiki_pages ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "wiki_pages_select" ON wiki_pages;
DROP POLICY IF EXISTS "wiki_pages_all" ON wiki_pages;
DROP POLICY IF EXISTS "wiki_pages_insert" ON wiki_pages;
DROP POLICY IF EXISTS "wiki_pages_update" ON wiki_pages;
DROP POLICY IF EXISTS "wiki_pages_delete" ON wiki_pages;

CREATE POLICY "wiki_pages_select" ON wiki_pages
  FOR SELECT USING (true);

CREATE POLICY "wiki_pages_insert" ON wiki_pages
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "wiki_pages_update" ON wiki_pages
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "wiki_pages_delete" ON wiki_pages
  FOR DELETE USING (auth.role() = 'authenticated');

-- ── wiki_page_links ──────────────────────────────────────────────
DROP POLICY IF EXISTS "wiki_page_links_select" ON wiki_page_links;
DROP POLICY IF EXISTS "wiki_page_links_all" ON wiki_page_links;
DROP POLICY IF EXISTS "wiki_page_links_insert" ON wiki_page_links;
DROP POLICY IF EXISTS "wiki_page_links_update" ON wiki_page_links;
DROP POLICY IF EXISTS "wiki_page_links_delete" ON wiki_page_links;

CREATE POLICY "wiki_page_links_select" ON wiki_page_links
  FOR SELECT USING (true);

CREATE POLICY "wiki_page_links_insert" ON wiki_page_links
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "wiki_page_links_update" ON wiki_page_links
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "wiki_page_links_delete" ON wiki_page_links
  FOR DELETE USING (auth.role() = 'authenticated');

-- ── wiki_page_versions ───────────────────────────────────────────
DROP POLICY IF EXISTS "wiki_page_versions_select" ON wiki_page_versions;
DROP POLICY IF EXISTS "wiki_page_versions_all" ON wiki_page_versions;
DROP POLICY IF EXISTS "wiki_page_versions_insert" ON wiki_page_versions;

CREATE POLICY "wiki_page_versions_select" ON wiki_page_versions
  FOR SELECT USING (true);

CREATE POLICY "wiki_page_versions_insert" ON wiki_page_versions
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ── wiki_contributions ───────────────────────────────────────────
DROP POLICY IF EXISTS "wiki_contributions_select" ON wiki_contributions;
DROP POLICY IF EXISTS "wiki_contributions_all" ON wiki_contributions;
DROP POLICY IF EXISTS "wiki_contributions_insert" ON wiki_contributions;

CREATE POLICY "wiki_contributions_select" ON wiki_contributions
  FOR SELECT USING (true);

CREATE POLICY "wiki_contributions_insert" ON wiki_contributions
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ── wiki_page_views ──────────────────────────────────────────────
DROP POLICY IF EXISTS "wiki_page_views_select" ON wiki_page_views;
DROP POLICY IF EXISTS "wiki_page_views_all" ON wiki_page_views;
DROP POLICY IF EXISTS "wiki_page_views_insert" ON wiki_page_views;

CREATE POLICY "wiki_page_views_select" ON wiki_page_views
  FOR SELECT USING (true);

CREATE POLICY "wiki_page_views_insert" ON wiki_page_views
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ── wiki_ai_analyses ─────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'wiki_ai_analyses') THEN
    EXECUTE 'DROP POLICY IF EXISTS "wiki_ai_analyses_select" ON wiki_ai_analyses';
    EXECUTE 'DROP POLICY IF EXISTS "wiki_ai_analyses_all" ON wiki_ai_analyses';
    EXECUTE 'DROP POLICY IF EXISTS "wiki_ai_analyses_insert" ON wiki_ai_analyses';
    EXECUTE 'CREATE POLICY "wiki_ai_analyses_select" ON wiki_ai_analyses FOR SELECT USING (true)';
    EXECUTE 'CREATE POLICY "wiki_ai_analyses_insert" ON wiki_ai_analyses FOR INSERT WITH CHECK (auth.role() = ''authenticated'')';
  END IF;
END $$;
