import { FormEvent, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable
} from "@tanstack/react-table";
import {
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  Clipboard,
  ExternalLink,
  Eye,
  EyeOff,
  Filter,
  History,
  KeyRound,
  Loader2,
  RotateCcw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Store,
  X
} from "lucide-react";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import type { GoodsType, LdxpGoods, SearchResponse } from "./types";

const tokenStorageKey = "ldxp-merchant-token";
const tokenHistoryStorageKey = "ldxp-merchant-token-history";
const lastSearchStorageKey = "ldxp-last-search-state";
const keywordHistoryStorageKey = "ldxp-keyword-history";
const maxTokenHistory = 8;
const maxKeywordHistory = 20;

const goodsTypes: Array<{ value: GoodsType; label: string }> = [
  { value: "all", label: "全部" },
  { value: "card", label: "卡密" },
  { value: "article", label: "知识" },
  { value: "resource", label: "资源" },
  { value: "equity", label: "权益" }
];

const typeLabel: Record<string, string> = {
  card: "卡密",
  article: "知识",
  resource: "资源",
  equity: "权益"
};

interface SearchParams {
  keyword: string;
  type: GoodsType;
  current: number;
  pageSize: number;
  token: string;
}

type LdxpGoodsType = "" | "card" | "article" | "resource" | "equity";

interface LdxpResponse<T> {
  code: number;
  msg?: string;
  data?: T;
}

interface SearchGoodsData {
  list?: unknown[];
  total?: number;
}

type SortKey =
  | "default"
  | "cost_asc"
  | "cost_desc"
  | "price_asc"
  | "price_desc"
  | "agent1_asc"
  | "agent2_asc"
  | "agent3_asc"
  | "stock_desc";

interface SearchState {
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

const defaultSearchState: SearchState = {
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

function normalizeSearchState(value: Partial<SearchState> | null | undefined): SearchState {
  return {
    keyword: typeof value?.keyword === "string" ? value.keyword : defaultSearchState.keyword,
    type: isGoodsType(value?.type) ? value.type : defaultSearchState.type,
    current: Math.max(1, Math.floor(Number(value?.current || defaultSearchState.current))),
    pageSize: Math.max(1, Math.floor(Number(value?.pageSize || defaultSearchState.pageSize))),
    sortKey: isSortKey(value?.sortKey) ? value.sortKey : defaultSearchState.sortKey,
    onlyInStock: Boolean(value?.onlyInStock),
    onlyNormal: Boolean(value?.onlyNormal),
    minPrice: typeof value?.minPrice === "string" ? value.minPrice : defaultSearchState.minPrice,
    maxPrice: typeof value?.maxPrice === "string" ? value.maxPrice : defaultSearchState.maxPrice
  };
}

function loadTokenHistory() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(tokenHistoryStorageKey) || "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
  } catch {
    return [];
  }
}

function loadLastSearchState() {
  try {
    return normalizeSearchState(JSON.parse(window.localStorage.getItem(lastSearchStorageKey) || "null"));
  } catch {
    return defaultSearchState;
  }
}

function loadKeywordHistory() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(keywordHistoryStorageKey) || "[]");
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, maxKeywordHistory)
      : [];
  } catch {
    return [];
  }
}

function maskToken(token: string) {
  const trimmed = token.trim();
  if (trimmed.length <= 14) return trimmed || "空 Token";
  return `${trimmed.slice(0, 8)}...${trimmed.slice(-6)}`;
}

function formatPrice(value: unknown) {
  if (value === undefined || value === null || value === "") return "-";
  if (Number(value) === 0) return "免费";
  return `${value}元`;
}

function numericValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

function stockValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function userContactItems(goods: LdxpGoods) {
  const user = goods.user;
  return [
    user?.contact_qq && { label: "QQ", value: user.contact_qq },
    user?.contact_mobile && { label: "手机/群", value: user.contact_mobile },
    user?.contact_wechat && { label: "微信/其他", value: user.contact_wechat }
  ].filter((item): item is { label: string; value: string } => Boolean(item));
}

function userContactText(goods: LdxpGoods) {
  const user = goods.user;
  const parts = [
    user?.nickname && `商家：${user.nickname}`,
    user?.link && `店铺：${user.link}`,
    ...userContactItems(goods).map((item) => `${item.label}：${item.value}`)
  ];
  return parts.filter(Boolean).join("\n");
}

function normalizeMerchantToken(input: string) {
  let normalized = input.trim();

  if (!normalized) return "";

  const headerMatch = normalized.match(/^Merchant-Token\s*:\s*(.+)$/i);
  if (headerMatch?.[1]) {
    normalized = headerMatch[1].trim();
  }

  if ((normalized.startsWith("{") && normalized.endsWith("}")) || (normalized.startsWith('"') && normalized.endsWith('"'))) {
    try {
      const parsed = JSON.parse(normalized) as unknown;
      if (typeof parsed === "string") {
        normalized = parsed.trim();
      } else if (parsed && typeof parsed === "object") {
        const record = parsed as Record<string, unknown>;
        if (typeof record.value === "string") {
          normalized = record.value.trim();
        } else if (typeof record.merchant_token === "string") {
          normalized = record.merchant_token.trim();
        } else if (typeof record.token === "string") {
          normalized = record.token.trim();
        }
      }
    } catch {
      // 非 JSON 文本按原 Token 继续处理。
    }
  }

  return normalized.replace(/^Bearer\s+/i, "").trim();
}

function normalizeGoods(item: unknown): LdxpGoods {
  const goods = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
  const user = (goods.user && typeof goods.user === "object" ? goods.user : {}) as Record<string, unknown>;
  const category = (goods.category && typeof goods.category === "object" ? goods.category : {}) as Record<string, unknown>;
  const child = goods.child && typeof goods.child === "object" ? (goods.child as Record<string, unknown>) : null;

  return {
    id: (goods.id as number | string | undefined) ?? "",
    name: goods.name as string | undefined,
    image: goods.image as string | undefined,
    link: goods.link as string | undefined,
    goods_type: goods.goods_type as string | undefined,
    price: goods.price as number | string | undefined,
    agent_price_limit: goods.agent_price_limit as number | string | undefined,
    agent_price1: goods.agent_price1 as number | string | undefined,
    agent_price2: goods.agent_price2 as number | string | undefined,
    agent_price3: goods.agent_price3 as number | string | undefined,
    cost_price: goods.cost_price as number | string | undefined,
    status: goods.status as number | undefined,
    stock_count: goods.stock_count as number | undefined,
    category: {
      name: category.name as string | undefined
    },
    user: {
      link: user.link as string | undefined,
      nickname: user.nickname as string | undefined,
      avatar: user.avatar as string | undefined,
      contact_qq: user.contact_qq as string | undefined,
      contact_mobile: user.contact_mobile as string | undefined,
      contact_wechat: user.contact_wechat as string | undefined
    },
    child: child
      ? {
          link: child.link as string | undefined,
          price: child.price as number | string | undefined,
          add_type: child.add_type as number | undefined,
          add_rate: child.add_rate as number | string | undefined,
          add_price: child.add_price as number | string | undefined
        }
      : null
  };
}

async function fetchSearch(params: SearchParams): Promise<SearchResponse> {
  const merchantToken = normalizeMerchantToken(params.token);
  const goodsType = (params.type === "all" ? "" : params.type) as LdxpGoodsType;

  let response: Response;
  try {
    response = await fetch("https://pay.ldxp.cn/merchantApi/MyParent/searchGoodsList", {
      method: "POST",
      headers: {
        Accept: "application/json, text/plain, */*",
        "Content-Type": "application/json",
        "Merchant-Token": merchantToken
      },
      body: JSON.stringify({
        current: params.current,
        pageSize: params.pageSize,
        name: "",
        goods_type: goodsType,
        keywords: params.keyword
      })
    });
  } catch {
    throw new Error("请求 LDXP 失败：请检查网络，或 LDXP 是否仍允许当前页面跨域调用接口。");
  }

  const payload = (await response.json().catch(() => ({}))) as LdxpResponse<SearchGoodsData>;
  if (!response.ok) {
    throw new Error(payload.msg || "请求 LDXP 接口失败，请检查网络、CORS 或 Merchant-Token。");
  }
  if (payload.code !== 1) {
    const message =
      payload.msg === "请先登录"
        ? "LDXP 提示请先登录：Token 无效、过期，或粘贴的不是 Merchant-Token。请重新登录后台后复制最新 token。"
        : payload.msg || "LDXP 接口返回错误。";
    throw new Error(message);
  }

  const list = Array.isArray(payload.data?.list) ? payload.data.list : [];
  const total = Number(payload.data?.total || 0);

  return {
    keyword: params.keyword,
    type: params.type,
    goods_type: goodsType,
    current: params.current,
    pageSize: params.pageSize,
    total,
    count: list.length,
    pageCount: Math.max(1, Math.ceil(total / params.pageSize)),
    list: list.map(normalizeGoods)
  };
}

export default function App() {
  const [initialSearchState] = useState(loadLastSearchState);
  const [keyword, setKeyword] = useState(initialSearchState.keyword);
  const [token, setToken] = useState(() => window.localStorage.getItem(tokenStorageKey) || "");
  const [tokenHistory, setTokenHistory] = useState<string[]>(loadTokenHistory);
  const [keywordHistory, setKeywordHistory] = useState<string[]>(loadKeywordHistory);
  const [type, setType] = useState<GoodsType>(initialSearchState.type);
  const [current, setCurrent] = useState(initialSearchState.current);
  const [pageSize, setPageSize] = useState(initialSearchState.pageSize);
  const [sortKey, setSortKey] = useState<SortKey>(initialSearchState.sortKey);
  const [onlyInStock, setOnlyInStock] = useState(initialSearchState.onlyInStock);
  const [onlyNormal, setOnlyNormal] = useState(initialSearchState.onlyNormal);
  const [minPrice, setMinPrice] = useState(initialSearchState.minPrice);
  const [maxPrice, setMaxPrice] = useState(initialSearchState.maxPrice);
  const [showToken, setShowToken] = useState(false);
  const [submitted, setSubmitted] = useState<SearchParams | null>(null);
  const [formError, setFormError] = useState("");
  const [copiedSellerId, setCopiedSellerId] = useState<string | number | null>(null);

  const query = useQuery({
    queryKey: ["search", submitted],
    queryFn: () => fetchSearch(submitted as SearchParams),
    enabled: submitted !== null
  });

  const rows = useMemo(() => {
    const source = query.data?.list ?? [];
    const min = minPrice === "" ? Number.NEGATIVE_INFINITY : Number(minPrice);
    const max = maxPrice === "" ? Number.POSITIVE_INFINITY : Number(maxPrice);

    const filtered = source.filter((goods) => {
      const price = numericValue(goods.cost_price);
      const passesStock = !onlyInStock || stockValue(goods.stock_count) > 0 || goods.goods_type !== "card";
      const passesStatus = !onlyNormal || goods.status === 1;
      const passesMin = !Number.isFinite(min) || price >= min;
      const passesMax = !Number.isFinite(max) || price <= max;
      return passesStock && passesStatus && passesMin && passesMax;
    });

    const sorted = [...filtered];
    if (sortKey === "cost_asc") {
      sorted.sort((a, b) => numericValue(a.cost_price) - numericValue(b.cost_price));
    } else if (sortKey === "cost_desc") {
      sorted.sort((a, b) => numericValue(b.cost_price) - numericValue(a.cost_price));
    } else if (sortKey === "price_asc") {
      sorted.sort((a, b) => numericValue(a.price) - numericValue(b.price));
    } else if (sortKey === "price_desc") {
      sorted.sort((a, b) => numericValue(b.price) - numericValue(a.price));
    } else if (sortKey === "agent1_asc") {
      sorted.sort((a, b) => numericValue(a.agent_price1) - numericValue(b.agent_price1));
    } else if (sortKey === "agent2_asc") {
      sorted.sort((a, b) => numericValue(a.agent_price2) - numericValue(b.agent_price2));
    } else if (sortKey === "agent3_asc") {
      sorted.sort((a, b) => numericValue(a.agent_price3) - numericValue(b.agent_price3));
    } else if (sortKey === "stock_desc") {
      sorted.sort((a, b) => stockValue(b.stock_count) - stockValue(a.stock_count));
    }

    return sorted;
  }, [query.data?.list, sortKey, onlyInStock, onlyNormal, minPrice, maxPrice]);

  const rawRowsCount = query.data?.list.length ?? 0;
  const pageCount = query.data?.pageCount ?? 1;
  const safeCurrent = query.data?.current ?? submitted?.current ?? current;

  const columns = useMemo<ColumnDef<LdxpGoods>[]>(
    () => [
      {
        accessorKey: "name",
        header: "商品名",
        size: 360,
        cell: ({ row }) => {
          const goods = row.original;
          return (
            <div className="flex min-w-0 items-center gap-3">
              {goods.image ? (
                <img
                  className="h-12 w-12 shrink-0 rounded object-cover"
                  src={goods.image}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="h-12 w-12 shrink-0 rounded bg-muted" />
              )}
              <div className="min-w-0">
                <div className="line-clamp-2 font-medium text-foreground">{goods.name || "-"}</div>
                <div className="mt-1 flex items-center gap-2">
                  <Badge>{typeLabel[goods.goods_type || ""] || goods.goods_type || "未知"}</Badge>
                  <span className="text-xs text-muted-foreground">{goods.category?.name || "未分类"}</span>
                </div>
              </div>
            </div>
          );
        }
      },
      {
        id: "prices",
        header: "价格",
        size: 220,
        cell: ({ row }) => {
          const goods = row.original;
          return (
            <div className="space-y-1 text-xs">
              <div className="font-medium text-foreground">售价：{formatPrice(goods.price)}</div>
              <div>成本：{formatPrice(goods.cost_price)}</div>
              <div className="text-muted-foreground">限价：{formatPrice(goods.agent_price_limit)}</div>
              <div className="text-muted-foreground">
                普 {formatPrice(goods.agent_price1)} / 金 {formatPrice(goods.agent_price2)} / 核 {formatPrice(goods.agent_price3)}
              </div>
            </div>
          );
        }
      },
      {
        id: "stock",
        header: "库存/状态",
        size: 120,
        cell: ({ row }) => {
          const goods = row.original;
          const isCard = goods.goods_type === "card";
          return (
            <div className="space-y-1 text-sm">
              <Badge className={goods.status === 1 ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}>
                {goods.status === 1 ? "正常" : "未上架"}
              </Badge>
              <div className="text-xs text-muted-foreground">{isCard ? `${goods.stock_count ?? 0} 张` : "无需库存"}</div>
            </div>
          );
        }
      },
      {
        id: "seller",
        header: "商家",
        size: 330,
        cell: ({ row }) => {
          const goods = row.original;
          const user = goods.user;
          const contacts = userContactItems(goods);
          return (
            <div className="flex min-w-0 items-start gap-2 text-sm">
              {user?.avatar ? (
                <img
                  className="mt-0.5 h-9 w-9 shrink-0 rounded object-cover"
                  src={user.avatar}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="mt-0.5 h-9 w-9 shrink-0 rounded bg-muted" />
              )}
              <div className="min-w-0 space-y-1">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate font-medium">{user?.nickname || "-"}</span>
                  {user?.link ? (
                    <a
                      className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
                      href={user.link}
                      target="_blank"
                      rel="noreferrer"
                      aria-label="打开商家店铺"
                      title="打开商家店铺"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : null}
                  {userContactText(goods) ? (
                    <button
                      type="button"
                      className="inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded border border-input text-muted-foreground transition-colors duration-200 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => void copySellerContact(goods)}
                      aria-label="复制商家信息"
                      title="复制商家信息"
                    >
                      {copiedSellerId === goods.id ? <Check className="h-3.5 w-3.5" /> : <Clipboard className="h-3.5 w-3.5" />}
                    </button>
                  ) : null}
                </div>
                <div className="space-y-0.5 text-xs text-muted-foreground">
                  {user?.link ? <div className="break-all">店铺：{user.link}</div> : null}
                  {contacts.length > 0 ? (
                    contacts.map((contact) => (
                      <div key={contact.label} className="break-words">
                        {contact.label}：{contact.value}
                      </div>
                    ))
                  ) : (
                    <div>未展示联系方式</div>
                  )}
                </div>
              </div>
            </div>
          );
        }
      },
      {
        id: "connected",
        header: "对接",
        size: 100,
        cell: ({ row }) => (
          <Badge className={row.original.child ? "border-blue-200 bg-blue-50 text-blue-700" : ""}>
            {row.original.child ? "已对接" : "未对接"}
          </Badge>
        )
      },
      {
        id: "link",
        header: "链接",
        size: 90,
        cell: ({ row }) =>
          row.original.link ? (
            <a
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-input text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              href={row.original.link}
              target="_blank"
              rel="noreferrer"
              aria-label="打开商品链接"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          ) : (
            "-"
          )
      }
    ],
    [copiedSellerId]
  );

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel()
  });

  function submitSearch(nextPage = 1) {
    const trimmedKeyword = keyword.trim();
    const trimmedToken = normalizeMerchantToken(token);
    if (!trimmedToken) {
      setFormError("请先填写 Merchant-Token。");
      return;
    }
    if (!trimmedKeyword) {
      setFormError("请输入搜索关键词。");
      return;
    }

    const normalizedPageSize = Math.max(1, Math.floor(Number(pageSize) || 20));
    const normalizedPage = Math.max(1, Math.floor(Number(nextPage) || 1));
    const nextHistory = [trimmedToken, ...tokenHistory.filter((item) => item !== trimmedToken)].slice(0, maxTokenHistory);
    const nextKeywordHistory = [trimmedKeyword, ...keywordHistory.filter((item) => item !== trimmedKeyword)].slice(0, maxKeywordHistory);
    const searchState: SearchState = {
      keyword: trimmedKeyword,
      type,
      current: normalizedPage,
      pageSize: normalizedPageSize,
      sortKey,
      onlyInStock,
      onlyNormal,
      minPrice,
      maxPrice
    };
    window.localStorage.setItem(tokenStorageKey, trimmedToken);
    window.localStorage.setItem(tokenHistoryStorageKey, JSON.stringify(nextHistory));
    window.localStorage.setItem(keywordHistoryStorageKey, JSON.stringify(nextKeywordHistory));
    window.localStorage.setItem(lastSearchStorageKey, JSON.stringify(searchState));
    setTokenHistory(nextHistory);
    setKeywordHistory(nextKeywordHistory);
    setFormError("");
    setCurrent(normalizedPage);
    setPageSize(normalizedPageSize);
    setSubmitted({
      keyword: trimmedKeyword,
      type,
      current: normalizedPage,
      pageSize: normalizedPageSize,
      token: trimmedToken
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitSearch(1);
  }

  async function copySellerContact(goods: LdxpGoods) {
    const text = userContactText(goods);
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      setCopiedSellerId(goods.id);
      window.setTimeout(() => setCopiedSellerId((value) => (value === goods.id ? null : value)), 1400);
    } catch {
      setFormError("复制失败，请检查浏览器剪贴板权限。");
    }
  }

  const statusText = query.data
    ? `命中 ${query.data.total} 条，当前第 ${query.data.current}/${query.data.pageCount} 页，展示 ${query.data.count} 条`
    : "等待搜索";
  const activeFilterCount = [onlyNormal, onlyInStock, minPrice !== "", maxPrice !== ""].filter(Boolean).length;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <a
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2 focus:text-sm focus:shadow"
        href="#results"
      >
        跳到结果
      </a>

      <section className="border-b border-border bg-card">
        <form className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Store className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-base font-semibold tracking-normal">LDXP 货源搜索</h1>
                <p className="mt-0.5 text-xs text-muted-foreground">分页查询，当前页排序筛选，Token 仅保存在本机。</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge className="bg-blue-50 text-blue-700">{statusText}</Badge>
              {activeFilterCount > 0 ? (
                <Badge className="border-amber-200 bg-amber-50 text-amber-700">
                  <Filter className="mr-1 h-3 w-3" />
                  {activeFilterCount} 个筛选
                </Badge>
              ) : (
                <Badge>无额外筛选</Badge>
              )}
            </div>
          </div>

          <div className="grid gap-2 rounded-md border border-border bg-background p-2 lg:grid-cols-[minmax(260px,0.9fr)_minmax(360px,1.2fr)_auto] lg:items-end">
            <div className="grid gap-2 sm:grid-cols-[minmax(180px,1fr)_144px]">
              <label className="block" htmlFor="keyword">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">商品关键词</span>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="keyword"
                    className="pl-9"
                    value={keyword}
                    onChange={(event) => setKeyword(event.target.value)}
                    placeholder="GPT、Claude、Gemini"
                    autoFocus
                  />
                </div>
              </label>
              <label className="block" htmlFor="keyword-history">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">最近关键词</span>
                <select
                  id="keyword-history"
                  className="h-10 w-full min-w-0 cursor-pointer rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-ring"
                  value=""
                  onChange={(event) => {
                    if (event.target.value) setKeyword(event.target.value);
                  }}
                  aria-label="选择历史关键词"
                >
                  <option value="">选择历史</option>
                  {keywordHistory.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-2 md:grid-cols-[minmax(220px,1fr)_150px_auto_auto_auto]">
              <label className="block" htmlFor="merchant-token">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">Merchant-Token</span>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="merchant-token"
                    className="pl-9"
                    value={token}
                    onChange={(event) => setToken(event.target.value)}
                    placeholder="粘贴 Merchant-Token 或 auth-token JSON"
                    type={showToken ? "text" : "password"}
                    autoComplete="off"
                  />
                </div>
              </label>
              <label className="block" htmlFor="token-history">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">历史 Token</span>
                <select
                  id="token-history"
                  className="h-10 w-full min-w-0 cursor-pointer rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-ring"
                  value=""
                  onChange={(event) => {
                    if (event.target.value) setToken(event.target.value);
                  }}
                  aria-label="选择历史 Merchant-Token"
                >
                  <option value="">历史 Token</option>
                  {tokenHistory.map((item) => (
                    <option key={item} value={item}>
                      {maskToken(item)}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                className="self-end"
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setShowToken((value) => !value)}
                aria-label={showToken ? "隐藏 Token" : "显示 Token"}
                title={showToken ? "隐藏 Token" : "显示 Token"}
              >
                {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <Button
                className="self-end"
                type="button"
                variant="outline"
                size="icon"
                onClick={() => {
                  setToken("");
                  window.localStorage.removeItem(tokenStorageKey);
                }}
                aria-label="清空当前 Token"
                title="清空当前 Token"
              >
                <X className="h-4 w-4" />
              </Button>
              <Button
                className="self-end"
                type="button"
                variant="outline"
                size="icon"
                onClick={() => {
                  setTokenHistory([]);
                  window.localStorage.removeItem(tokenHistoryStorageKey);
                  window.localStorage.removeItem(tokenStorageKey);
                  setToken("");
                }}
                aria-label="清空 Token 历史"
                title="清空 Token 历史"
              >
                <History className="h-4 w-4" />
              </Button>
            </div>

            <Button className="h-10 lg:self-end" type="submit" disabled={query.isFetching}>
              {query.isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
              搜索
            </Button>
          </div>

          <div className="grid gap-2 rounded-md border border-border bg-muted/30 p-2 xl:grid-cols-[minmax(260px,auto)_180px_110px_110px_minmax(280px,1fr)] xl:items-end">
            <div>
              <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5" />
                商品类型
              </div>
              <div className="flex flex-wrap gap-1.5">
                {goodsTypes.map((item) => (
                  <Button
                    key={item.value}
                    type="button"
                    variant={type === item.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setType(item.value)}
                  >
                    {item.label}
                  </Button>
                ))}
              </div>
            </div>
            <label className="block" htmlFor="sort-key">
              <span className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                当前页排序
              </span>
              <select
                id="sort-key"
                className="h-10 w-full cursor-pointer rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-ring"
                value={sortKey}
                onChange={(event) => {
                  const next = event.target.value as SortKey;
                  setSortKey(next);
                  window.localStorage.setItem("ldxp-sort-key", next);
                }}
              >
                <option value="default">接口顺序</option>
                <option value="cost_asc">成本价升序</option>
                <option value="cost_desc">成本价降序</option>
                <option value="price_asc">售价升序</option>
                <option value="price_desc">售价降序</option>
                <option value="agent1_asc">普通代理价升序</option>
                <option value="agent2_asc">金牌代理价升序</option>
                <option value="agent3_asc">核心代理价升序</option>
                <option value="stock_desc">库存降序</option>
              </select>
            </label>
            <label className="block" htmlFor="min-price">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">最低价</span>
              <Input
                id="min-price"
                value={minPrice}
                onChange={(event) => setMinPrice(event.target.value)}
                min={0}
                step="0.01"
                type="number"
                inputMode="decimal"
              />
            </label>
            <label className="block" htmlFor="max-price">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">最高价</span>
              <Input
                id="max-price"
                value={maxPrice}
                onChange={(event) => setMaxPrice(event.target.value)}
                min={0}
                step="0.01"
                type="number"
                inputMode="decimal"
              />
            </label>
            <div>
              <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Filter className="h-3.5 w-3.5" />
                快速筛选
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Button
                  type="button"
                  variant={onlyNormal ? "default" : "outline"}
                  size="sm"
                  onClick={() => setOnlyNormal((value) => !value)}
                >
                  只看正常上架
                </Button>
                <Button
                  type="button"
                  variant={onlyInStock ? "default" : "outline"}
                  size="sm"
                  onClick={() => setOnlyInStock((value) => !value)}
                >
                  只看有库存
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSortKey("default");
                    setOnlyNormal(false);
                    setOnlyInStock(false);
                    setMinPrice("");
                    setMaxPrice("");
                    window.localStorage.setItem("ldxp-sort-key", "default");
                  }}
                >
                  <RotateCcw className="mr-1 h-4 w-4" />
                  重置
                </Button>
              </div>
            </div>
          </div>
        </form>
      </section>

      <section id="results" className="mx-auto max-w-7xl px-4 py-4">
        {(formError || query.error) && (
          <div className="mb-3 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{formError || query.error?.message}</span>
          </div>
        )}

        {query.isFetching && (
          <div className="mb-3 flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            正在搜索...
          </div>
        )}

        {!submitted ? (
          <EmptyState title="填写 Token 和关键词后搜索" description="不会自动请求；点击搜索按钮或在输入框按回车触发。" />
        ) : !query.isFetching && !query.error && rows.length === 0 ? (
          <EmptyState title="当前页没有商品" description="换一个关键词、类型，或调整页码和每页数量。" />
        ) : (
          <>
            <div className="mb-3 rounded-md border border-border bg-card px-3 py-2">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge className="bg-blue-50 text-blue-700">{statusText}</Badge>
                  {rawRowsCount !== rows.length ? <Badge>筛选后 {rows.length} 条</Badge> : null}
                  <span className="text-xs text-muted-foreground">排序和筛选仅作用于当前页。</span>
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <label className="block" htmlFor="page-current">
                    <span className="mb-1 block text-xs font-medium text-muted-foreground">页码</span>
                    <Input
                      id="page-current"
                      className="h-9 w-20"
                      value={current}
                      onChange={(event) => setCurrent(Math.max(1, Number(event.target.value) || 1))}
                      min={1}
                      type="number"
                      inputMode="numeric"
                    />
                  </label>
                  <label className="block" htmlFor="page-size">
                    <span className="mb-1 block text-xs font-medium text-muted-foreground">每页</span>
                    <Input
                      id="page-size"
                      className="h-9 w-24"
                      value={pageSize}
                      onChange={(event) => setPageSize(Math.max(1, Number(event.target.value) || 1))}
                      min={1}
                      type="number"
                      inputMode="numeric"
                    />
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={query.isFetching || safeCurrent <= 1}
                    onClick={() => submitSearch(safeCurrent - 1)}
                  >
                    <ChevronLeft className="mr-1 h-4 w-4" />
                    上一页
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={query.isFetching || safeCurrent >= pageCount}
                    onClick={() => submitSearch(safeCurrent + 1)}
                  >
                    下一页
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-md border border-border bg-card shadow-sm">
              <div className="overflow-x-auto">
                <div className="min-w-[1220px]">
                  <div className="grid border-b border-border bg-muted/70" style={{ gridTemplateColumns: table.getAllLeafColumns().map((column) => `${column.getSize()}px`).join(" ") }}>
                    {table.getHeaderGroups()[0]?.headers.map((header) => (
                      <div key={header.id} className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-normal text-muted-foreground">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </div>
                    ))}
                  </div>
                  <div>
                    {table.getRowModel().rows.map((row) => (
                      <div
                        key={row.id}
                        className="grid min-h-[82px] border-b border-border bg-card transition-colors duration-200 hover:bg-blue-50/45"
                        style={{
                          gridTemplateColumns: table.getAllLeafColumns().map((column) => `${column.getSize()}px`).join(" ")
                        }}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <div key={cell.id} className="min-w-0 px-3 py-3">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </section>
    </main>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center rounded-md border border-dashed border-border bg-card px-4 text-center">
      <Search className="h-9 w-9 text-muted-foreground" />
      <h2 className="mt-4 text-base font-semibold">{title}</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
