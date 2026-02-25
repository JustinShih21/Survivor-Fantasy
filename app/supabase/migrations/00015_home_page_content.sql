-- Home page content: articles/pages that appear on the home page.
-- Admin can create, edit, delete; public sees published items only.

CREATE TABLE home_page_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE,
  excerpt TEXT,
  body TEXT,
  link_url TEXT,
  image_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_home_page_content_published_sort ON home_page_content(published, sort_order);

ALTER TABLE home_page_content ENABLE ROW LEVEL SECURITY;

-- Anyone can read published rows
CREATE POLICY "Anyone can read published home_page_content" ON home_page_content
  FOR SELECT USING (published = true);

-- No INSERT/UPDATE/DELETE for anon or authenticated; admin API uses service role
