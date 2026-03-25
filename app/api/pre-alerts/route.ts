import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "../../../lib/db";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const since = params.get("since");
  const type = params.get("type"); // early_warning | exit_notification
  const limit = Math.min(Number(params.get("limit") || "200"), 1000);
  const cursor = params.get("cursor");

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

  if (type && (type === "early_warning" || type === "exit_notification")) {
    conditions.push("alert_type = ?");
    args.push(type);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const result = await db.execute({
    sql: `SELECT id, timestamp, title_he, body_he, city_ids, regions, alert_type, created_at
          FROM pre_alerts ${where}
          ORDER BY timestamp DESC LIMIT ?`,
    args: [...args, limit],
  });

  const preAlerts = result.rows.map((r) => ({
    id: r.id as string,
    timestamp: r.timestamp as number,
    title_he: r.title_he as string,
    body_he: r.body_he as string,
    city_ids: JSON.parse((r.city_ids as string) || "[]"),
    regions: JSON.parse((r.regions as string) || "[]"),
    alert_type: r.alert_type as string,
    created_at: r.created_at as number,
  }));

  return NextResponse.json(preAlerts, {
    headers: {
      "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
    },
  });
}
