import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "../../../lib/db";

export async function GET(request: NextRequest) {
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
}
