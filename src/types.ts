export type GoodsType = "all" | "card" | "article" | "resource" | "equity";

export interface LdxpGoods {
  id: number | string;
  name?: string;
  image?: string;
  link?: string;
  goods_type?: string;
  price?: number | string;
  agent_price_limit?: number | string;
  agent_price1?: number | string;
  agent_price2?: number | string;
  agent_price3?: number | string;
  cost_price?: number | string;
  status?: number;
  stock_count?: number;
  category?: {
    name?: string;
  };
  user?: {
    nickname?: string;
    avatar?: string;
    contact_qq?: string;
    contact_mobile?: string;
    contact_wechat?: string;
  };
  child?: {
    link?: string;
    price?: number | string;
    add_type?: number;
    add_rate?: number | string;
    add_price?: number | string;
  } | null;
}

export interface SearchResponse {
  keyword: string;
  type: GoodsType;
  goods_type: string;
  current: number;
  pageSize: number;
  total: number;
  count: number;
  pageCount: number;
  list: LdxpGoods[];
}
