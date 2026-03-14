import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "../../../lib/db";

export async function GET(request: NextRequest) {
  try {
    const key = request.nextUrl.searchParams.get("key");
    if (!key) {
      return NextResponse.json({ error: "Missing key param" }, { status: 400 });
    }

    const db = createServerClient();
    const result = await db.execute({
      sql: "SELECT data, computed_at FROM analytics_cache WHERE key = ?",
      args: [key],
    });

    if (result.rows.length === 0) {
      return NextResponse.json(null);
    }

    const data = JSON.parse(result.rows[0].data as string);
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
      },
    });
  } catch (err) {
    console.error("Analytics API error:", err);
    return NextResponse.json(
      {
        error: String(err),
        stack: err instanceof Error ? err.stack?.split("\n").slice(0, 5) : undefined,
        env_url_full: process.env.TURSO_DB_URL || "MISSING",
        env_url_length: process.env.TURSO_DB_URL?.length,
        env_url_charCodes: process.env.TURSO_DB_URL ? Array.from(process.env.TURSO_DB_URL.slice(-5)).map(c => c.charCodeAt(0)) : [],
        env_token: process.env.TURSO_AUTH_TOKEN ? "set" : "MISSING",
      },
      { status: 500 }
    );
  }
}
