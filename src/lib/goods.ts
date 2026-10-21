import type { LdxpGoods } from "../types";

export function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}

export function text(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function priceValue(value: unknown): number | null {
  if ((typeof value !== "number" && typeof value !== "string") || value === "" || String(value).trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

export function comparePrices(a: unknown, b: unknown, descending = false) {
  const left = priceValue(a);
  const right = priceValue(b);
  if (left === null) return right === null ? 0 : 1;
  if (right === null) return -1;
  return descending ? right - left : left - right;
}

export function formatPrice(value: unknown) {
  const number = priceValue(value);
  return number === null ? "-" : number === 0 ? "免费" : `${number}元`;
}

function httpUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : undefined;
  } catch { return undefined; }
}

export function normalizeGoods(item: unknown): LdxpGoods {
  const goods = record(item);
  const user = record(goods.user);
  const category = record(goods.category);
  const child = record(goods.child);
  return {
    id: typeof goods.id === "number" || typeof goods.id === "string" ? goods.id : "",
    name: text(goods.name), image: httpUrl(goods.image), link: httpUrl(goods.link),
    goods_type: text(goods.goods_type),
    price: priceValue(goods.price) ?? undefined,
    cost_price: priceValue(goods.cost_price) ?? undefined,
    agent_price_limit: priceValue(goods.agent_price_limit) ?? undefined,
    agent_price1: priceValue(goods.agent_price1) ?? undefined,
    agent_price2: priceValue(goods.agent_price2) ?? undefined,
    agent_price3: priceValue(goods.agent_price3) ?? undefined,
    status: priceValue(goods.status) ?? undefined,
    stock_count: priceValue(goods.stock_count) ?? undefined,
    category: { name: text(category.name) },
    user: {
      link: httpUrl(user.link), nickname: text(user.nickname), avatar: httpUrl(user.avatar),
      contact_qq: text(user.contact_qq), contact_mobile: text(user.contact_mobile), contact_wechat: text(user.contact_wechat)
    },
    child: Object.keys(child).length ? {
      link: httpUrl(child.link), price: priceValue(child.price) ?? undefined,
      add_type: priceValue(child.add_type) ?? undefined,
      add_rate: priceValue(child.add_rate) ?? undefined,
      add_price: priceValue(child.add_price) ?? undefined
    } : null
  };
}
