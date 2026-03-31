"use client";

import { useState, useCallback } from "react";
import { fetchItems } from "@/api";
import type { BidItem, FilterState } from "@/types";

const DEFAULT_FILTER: FilterState = {
  ratio_min: 0,
  ratio_max: 100,
  price_min: null,
  price_max: null,
  usbd_min: 0,
  sd_nm: "",
  usg_mcls: "",
  usg_scls: "",
  bookmarked: null,
  pvct: null,
  sort: "ratio",
};

export function useItems() {
  const [items, setItems] = useState<BidItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterState>(DEFAULT_FILTER);

  const load = useCallback(async (f: FilterState) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchItems({
        ratio_min: f.ratio_min || undefined,
        ratio_max: f.ratio_max,
        price_min: f.price_min ?? undefined,
        price_max: f.price_max ?? undefined,
        usbd_min: f.usbd_min,
        sd_nm: f.sd_nm,
        usg_mcls: f.usg_mcls || undefined,
        usg_scls: f.usg_scls || undefined,
        bookmarked: f.bookmarked ?? undefined,
        pvct: f.pvct ?? undefined,
        limit: 9999,
      });
      setItems(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "데이터 로드 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  const sorted = [...items].sort((a, b) => {
    if (filter.sort === "ratio") return a.ratio_pct - b.ratio_pct;
    if (filter.sort === "usbd") return b.usbd_nft - a.usbd_nft;
    if (filter.sort === "deadline") {
      return new Date(a.cltr_bid_end_dt).getTime() - new Date(b.cltr_bid_end_dt).getTime();
    }
    return 0;
  });

  return { items: sorted, loading, error, filter, setFilter, load };
}
