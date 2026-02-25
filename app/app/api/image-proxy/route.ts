import { NextRequest, NextResponse } from "next/server";

const ALLOWED_HOSTS = ["static.wikia.nocookie.net", "images.wikia.nocookie.net"];

// In-memory cache for proxied images (persists across requests in same serverless instance)
const imageCache = new Map<string, { body: Uint8Array; contentType: string }>();
const MAX_CACHE_SIZE = 50;

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
    return NextResponse.json({ error: "Domain not allowed" }, { status: 400 });
  }

  const cached = imageCache.get(url);
  if (cached) {
    return new NextResponse(cached.body as BufferSource, {
      headers: {
        "Content-Type": cached.contentType,
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    });
  }

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; SurvivorFantasy/1.0)",
      },
      cache: "force-cache",
      next: { revalidate: 86400 }, // Cache 24 hours
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Upstream returned ${res.status}` },
        { status: res.status }
      );
    }

    const contentType = res.headers.get("Content-Type") || "image/jpeg";
    const body = res.body;
    if (!body) {
      return NextResponse.json({ error: "No body" }, { status: 502 });
    }

    const bytes = new Uint8Array(await res.arrayBuffer());
    if (imageCache.size >= MAX_CACHE_SIZE) {
      const firstKey = imageCache.keys().next().value;
      if (firstKey) imageCache.delete(firstKey);
    }
    imageCache.set(url, { body: bytes, contentType });

    return new NextResponse(bytes as BufferSource, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    });
  } catch (err) {
    console.error("Image proxy error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Proxy failed" },
      { status: 502 }
    );
  }
}
