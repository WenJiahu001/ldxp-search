import { AuthExpiredError, loginWithCredentials, type LoginCredentials } from "./api";
import { readJson, storage } from "./storage";
import { record } from "./goods";

export type AuthStatus = "missing" | "ready" | "logging_in" | "refreshing" | "error";
export const credentialsKey = "ldxp-login-credentials";
const tokenKey = "ldxp-merchant-token";
const saveKey = "ldxp-save-login";
export function loadCredentials(): LoginCredentials {
  const value = record(readJson(credentialsKey));
  return { username: typeof value.username === "string" ? value.username : "", password: typeof value.password === "string" ? value.password : "" };
}
export const loadSaveLogin = () => storage.get(saveKey) !== "false";

export class AuthSession {
  private token = "";
  private credentials: LoginCredentials;
  private controller?: AbortController;
  private pending?: Promise<string>;
  private generation = 0;
  private save = loadSaveLogin();
  private snapshot: { status: AuthStatus; message: string } = { status: "missing", message: "" };
  private listeners = new Set<() => void>();

  constructor(credentials: LoginCredentials) {
    this.credentials = credentials;
    const cached = record(readJson(tokenKey));
    if (this.save && cached.username === credentials.username.trim() && typeof cached.token === "string" && cached.token.trim()) {
      this.token = cached.token;
      this.snapshot = { status: "ready", message: "" };
    } else storage.remove(tokenKey);
  }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.snapshot;
  private update(status: AuthStatus, message = "") {
    this.snapshot = { status, message };
    this.listeners.forEach((listener) => listener());
  }
  cancel() {
    this.generation++;
    this.controller?.abort();
    this.controller = undefined;
    this.pending = undefined;
  }
  setCredentials(credentials: LoginCredentials) {
    this.cancel();
    this.credentials = credentials;
    this.token = "";
    storage.remove(tokenKey);
    storage.remove(credentialsKey);
    this.update("missing");
  }
  clear() { this.setCredentials({ username: "", password: "" }); }
  setSave(save: boolean) {
    this.save = save;
    storage.set(saveKey, String(save));
    if (!save) { storage.remove(credentialsKey); storage.remove(tokenKey); }
  }
  persist() {
    if (!this.save) return;
    storage.set(credentialsKey, JSON.stringify(this.credentials));
    if (this.token) storage.set(tokenKey, JSON.stringify({ username: this.credentials.username.trim(), token: this.token }));
  }
  invalidate(error: unknown) {
    if (error instanceof AuthExpiredError) {
      this.token = "";
      storage.remove(tokenKey);
      this.update("error", error.message);
    }
  }
  ensureToken = (force = false): Promise<string> => {
    if (this.pending) return this.pending;
    if (!force && this.token) return Promise.resolve(this.token);
    this.token = "";
    storage.remove(tokenKey);
    const generation = this.generation;
    const controller = new AbortController();
    this.controller = controller;
    this.update(force ? "refreshing" : "logging_in", force ? "Token 已过期，正在重新登录..." : "正在登录...");
    // 同一会话的并发请求共享登录；失效会话的响应不能写回 Token。
    this.pending = loginWithCredentials(this.credentials, controller.signal).then((token) => {
      if (generation !== this.generation) throw new DOMException("登录已取消", "AbortError");
      this.token = token;
      this.persist();
      this.update("ready", "已登录");
      return token;
    }).catch((error: unknown) => {
      if (generation === this.generation) this.update("error", error instanceof Error ? error.message : "登录失败。");
      throw error;
    }).finally(() => {
      if (generation === this.generation) { this.pending = undefined; this.controller = undefined; }
    });
    return this.pending;
  };
}
