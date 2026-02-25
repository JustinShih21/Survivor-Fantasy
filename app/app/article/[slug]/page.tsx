"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

interface Article {
  id: string;
  title: string;
  slug?: string | null;
  excerpt?: string | null;
  body?: string | null;
  created_at?: string;
}

export default function ArticlePage() {
  const params = useParams();
  const slug = typeof params.slug === "string" ? params.slug : "";
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!slug) {
      queueMicrotask(() => {
        setLoading(false);
        setError(true);
      });
      return;
    }
    fetch(`/api/article/${encodeURIComponent(slug)}`)
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then(setArticle)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <span className="text-stone-400">Loading...</span>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="space-y-4">
        <p className="text-stone-400">Article not found.</p>
        <Link href="/" className="text-orange-400 hover:underline">Back to Home</Link>
      </div>
    );
  }

  return (
    <article className="space-y-4">
      <Link href="/" className="text-sm text-orange-400 hover:underline">← Back to Home</Link>
      <h1 className="text-2xl font-bold text-stone-100">{article.title}</h1>
      {article.excerpt && (
        <p className="text-stone-400">{article.excerpt}</p>
      )}
      <div className="prose prose-invert prose-stone max-w-none text-stone-200 whitespace-pre-wrap">
        {article.body || ""}
      </div>
    </article>
  );
}
