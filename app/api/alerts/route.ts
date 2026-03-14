import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "../../../lib/db";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const cursor = params.get("cursor");
  const limit = Math.min(Number(params.get("limit") || "500"), 500);
  const since = params.get("since"); // timestamp in ms

  const db = createServerClient();

  const conditions: string[] = [];
  const args: (string | number)[] = [];

  if (since) {
    conditions.push("timestamp > ?");
    args.push(Number(since));
  }

  if (cursor) {
    conditions.push("timestamp < ?");
    args.push(Number(cursor));
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const result = await db.execute({
    sql: `SELECT id, timestamp, cities, threat, created_at FROM alerts ${where} ORDER BY timestamp DESC LIMIT ?`,
    args: [...args, limit],
  });

  const alerts = result.rows.map((r) => ({
    id: r.id as string,
    timestamp: r.timestamp as number,
    cities: JSON.parse(r.cities as string),
    threat: r.threat as number,
    created_at: r.created_at as number,
  }));

  return NextResponse.json(alerts, {
    headers: {
      "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
    },
  });
}
