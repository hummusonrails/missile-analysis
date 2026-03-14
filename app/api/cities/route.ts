import { NextResponse } from "next/server";
import { createServerClient } from "../../../lib/db";

export async function GET() {
  const db = createServerClient();

  const result = await db.execute(
    "SELECT city_name, city_name_en, lat, lng, region_id FROM city_coords"
  );

  const cities = result.rows.map((r) => ({
    city_name: r.city_name as string,
    city_name_en: r.city_name_en as string,
    lat: r.lat as number,
    lng: r.lng as number,
    region_id: r.region_id as string,
  }));

  return NextResponse.json(cities, {
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
