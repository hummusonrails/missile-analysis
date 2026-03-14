"use client";

import { useState, useEffect } from "react";
import { queryCityCoords } from "../turso-cache";
import type { CityCoord } from "../types";

export function useCityCoords() {
  const [coords, setCoords] = useState<Map<string, CityCoord>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    queryCityCoords()
      .then((result) => {
        const cities = result as CityCoord[];
        const map = new Map<string, CityCoord>();
        for (const city of cities) {
          map.set(city.city_name, city);
        }
        setCoords(map);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return { coords, loading };
}
