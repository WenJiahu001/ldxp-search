import type { GoodsType, SearchResponse } from "../types";
import { normalizeGoods, priceValue, record, text } from "./goods";

// 原域名存在预检重定向，直接使用最终接口地址。
const apiBaseUrl = "https://wzyp.cn";
export interface LoginCredentials { username: string; password: string }
export interface SearchParams { keyword: string; type: GoodsType; current: number; pageSize: number }
export class AuthExpiredError extends Error {
  constructor() { super("登录已失效，请重新登录。"); this.name = "AuthExpiredError"; }
}

function authExpired(code: number, message: string) {
  return code === 401 || /请先登录|未登录|登录.{0,6}(失效|过期)|token.{0,12}(expired|invalid|失效|过期|无效)/i.test(message);
}

export async function postLdxp(path: string, body: Record<string, unknown>, token?: string, signal?: AbortSignal) {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (signal?.aborted) cancel();
  signal?.addEventListener("abort", cancel, { once: true });
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 20000);
  try {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      method: "POST", signal: controller.signal,
      headers: { "Content-Type": "application/json", ...(token ? { "Merchant-Token": token } : {}) },
      body: JSON.stringify(body)
    });
    if (response.status === 401) throw new AuthExpiredError();
    let parsed: unknown;
    try { parsed = await response.json(); }
    catch (error) {
      if (controller.signal.aborted) throw error;
      throw new Error(`接口返回了非 JSON 响应（HTTP ${response.status}），请稍后重试。`);
    }
    const payload = record(parsed);
    const message = text(payload.msg) || "";
    const code = Number(payload.code);
    if ((typeof payload.code !== "number" && typeof payload.code !== "string") || !Number.isFinite(code) || String(payload.code).trim() === "") {
      throw new Error(`接口响应格式异常（HTTP ${response.status}）：缺少有效的业务状态码。`);
    }
    if (authExpired(code, message)) throw new AuthExpiredError();
    if (!response.ok || code !== 1) throw new Error(message || `接口请求失败（HTTP ${response.status}）。`);
    return record(payload.data);
  } catch (error) {
    if (signal?.aborted) throw new DOMException("请求已取消", "AbortError");
    if (timedOut) throw new Error("接口请求超过 20 秒，请稍后重试。");
    if (error instanceof TypeError) throw new Error("无法连接 LDXP 接口：请检查网络或 wzyp.cn 的跨域策略。");
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
  }
}

export async function loginWithCredentials(credentials: LoginCredentials, signal?: AbortSignal) {
  const body = { username: credentials.username.trim(), password: credentials.password };
  if (!body.username || !body.password.trim()) throw new Error("请先填写 LDXP 用户名和密码。");
  const safe = await postLdxp("/merchantApi/user/checkSafeMode", body, undefined, signal);
  if (safe.safe_mode !== 0 && safe.safe_mode !== "0") {
    if (safe.safe_mode === undefined || safe.safe_mode === null || safe.safe_mode === "") {
      throw new Error("安全模式响应缺少有效的 safe_mode，无法确认是否允许登录。");
    }
    throw new Error("该账号开启了二级密码或邮箱验证，当前工具暂不支持自动登录。");
  }
  const data = await postLdxp("/merchantApi/user/login", body, undefined, signal);
  const token = text(data.merchant_token)?.trim();
  if (!token) throw new Error("登录成功响应缺少有效的 Merchant-Token。");
  return token;
}

export async function fetchSearch(params: SearchParams, getToken: (force?: boolean) => Promise<string>, signal?: AbortSignal): Promise<SearchResponse> {
  const goodsType = params.type === "all" ? "" : params.type;
  async function request(force = false) {
    const token = await getToken(force);
    if (signal?.aborted) throw new DOMException("请求已取消", "AbortError");
    return postLdxp("/merchantApi/MyParent/searchGoodsList", {
      current: params.current, pageSize: params.pageSize, name: "", goods_type: goodsType, keywords: params.keyword
    }, token, signal);
  }
  let data: Record<string, unknown>;
  try { data = await request(); }
  catch (error) {
    if (!(error instanceof AuthExpiredError) || signal?.aborted) throw error;
    data = await request(true);
  }
  const total = priceValue(data.total);
  if (!Array.isArray(data.list) || total === null || !Number.isSafeInteger(total)) throw new Error("商品接口响应格式异常：缺少有效的列表或总数。");
  return {
    ...params, goods_type: goodsType, total, count: data.list.length,
    pageCount: Math.max(1, Math.ceil(total / params.pageSize)), list: data.list.map(normalizeGoods)
  };
}
