"use client";

import { useState, useEffect } from "react";
import { cachedQuery } from "../turso-cache";
import type { CityCoord } from "../types";

export function useCityCoords() {
  const [coords, setCoords] = useState<Map<string, CityCoord>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cachedQuery("SELECT city_name, city_name_en, lat, lng, region_id FROM city_coords").then(
      (result) => {
        const map = new Map<string, CityCoord>();
        for (const row of result.rows) {
          map.set(row.city_name as string, {
            city_name: row.city_name as string,
            city_name_en: row.city_name_en as string,
            lat: row.lat as number,
            lng: row.lng as number,
            region_id: row.region_id as string,
          });
        }
        setCoords(map);
        setLoading(false);
      }
    );
  }, []);

  return { coords, loading };
}
