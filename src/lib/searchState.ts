import type { GoodsType } from "../types";
import { readJson } from "./storage";
export const lastSearchStorageKey = "ldxp-last-search-state";
export const keywordHistoryStorageKey = "ldxp-keyword-history";
export const maxKeywordHistory = 20;
export function positiveInteger(value: unknown, fallback = 1) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : fallback;
}
export type SortKey =
  | "default"
  | "cost_asc"
  | "cost_desc"
  | "price_asc"
  | "price_desc"
  | "agent1_asc"
  | "agent2_asc"
  | "agent3_asc"
  | "stock_desc";

export interface SearchState {
  keyword: string;
  type: GoodsType;
  current: number;
  pageSize: number;
  sortKey: SortKey;
  onlyInStock: boolean;
  onlyNormal: boolean;
  minPrice: string;
  maxPrice: string;
}

export const defaultSearchState: SearchState = {
  keyword: "",
  type: "card",
  current: 1,
  pageSize: 20,
  sortKey: "default",
  onlyInStock: false,
  onlyNormal: false,
  minPrice: "",
  maxPrice: ""
};

function isGoodsType(value: unknown): value is GoodsType {
  return value === "all" || value === "card" || value === "article" || value === "resource" || value === "equity";
}

function isSortKey(value: unknown): value is SortKey {
  return (
    value === "default" ||
    value === "cost_asc" ||
    value === "cost_desc" ||
    value === "price_asc" ||
    value === "price_desc" ||
    value === "agent1_asc" ||
    value === "agent2_asc" ||
    value === "agent3_asc" ||
    value === "stock_desc"
  );
}

export function normalizeSearchState(value: Partial<SearchState> | null | undefined): SearchState {
  return {
    keyword: typeof value?.keyword === "string" ? value.keyword : defaultSearchState.keyword,
    type: isGoodsType(value?.type) ? value.type : defaultSearchState.type,
    current: positiveInteger(value?.current, defaultSearchState.current),
    pageSize: positiveInteger(value?.pageSize, defaultSearchState.pageSize),
    sortKey: isSortKey(value?.sortKey) ? value.sortKey : defaultSearchState.sortKey,
    onlyInStock: Boolean(value?.onlyInStock),
    onlyNormal: Boolean(value?.onlyNormal),
    minPrice: typeof value?.minPrice === "string" ? value.minPrice : defaultSearchState.minPrice,
    maxPrice: typeof value?.maxPrice === "string" ? value.maxPrice : defaultSearchState.maxPrice
  };
}

export function loadLastSearchState() {
  try {
    return normalizeSearchState(readJson(lastSearchStorageKey) as Partial<SearchState> | null);
  } catch {
    return defaultSearchState;
  }
}


export function loadKeywordHistory(): string[] {
  const value = readJson(keywordHistoryStorageKey);
  return Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === "string" && item.trim().length > 0))].slice(0, maxKeywordHistory) : [];
}
