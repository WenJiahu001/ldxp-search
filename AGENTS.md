# AGENTS.md

本文件给后续 AI/开发者阅读，用于维护这个本地 LDXP 货源搜索工具。

## 交流规则

- 全程使用中文回复用户。
- 修改前先理解现有前端数据流，不要重构无关代码。
- 这个项目是本地自用工具，优先保持简单、稳定、可运行。

## 项目概览

- 前端入口：`src/main.tsx`
- 主页面：`src/App.tsx`
- 类型定义：`src/types.ts`
- 认证会话：`src/lib/auth.ts`，负责账号隔离、登录合并、取消与持久化。
- 接口请求：`src/lib/api.ts`，统一域名、20 秒超时、取消、错误处理与一次重登。
- 商品校验与价格：`src/lib/goods.ts`；存储入口：`src/lib/storage.ts`；搜索设置：`src/lib/searchState.ts`。
- 大页渲染：`src/components/result-rows.tsx`，使用 IntersectionObserver 按组挂载，并保留离屏高度。
- 回归测试：`tests/*.test.mjs`，使用 Node 内置测试和已有 TypeScript 编译器，不添加测试依赖。
- UI 基础组件：`src/components/ui/*`
- Vite 配置：`vite.config.ts`
- 开源说明：`README.md`、`CONTRIBUTING.md`、`SECURITY.md`、`LICENSE`
- CI：`.github/workflows/ci.yml`

当前核心链路：

1. 用户在页面输入关键词、LDXP 用户名、密码、页码、每页数量。
2. 前端用 `/merchantApi/user/checkSafeMode` 检查安全模式。
3. `safe_mode=0` 时调用 `/merchantApi/user/login`，读取 `data.merchant_token`。
4. 前端请求 `https://wzyp.cn/merchantApi/MyParent/searchGoodsList`。
5. Token 通过 `Merchant-Token` 请求头传递，不放入 URL。
6. 如果搜索提示 Token 过期，前端自动登录一次并重试原搜索。
7. 前端用 `normalizeGoods` 瘦身响应，移除超长 `description` 等页面不用的字段。
8. 前端展示当前页结果，并在当前页内排序/筛选。

## 重要约束

- 不要把 Token、账号或密码放到 URL 查询参数里。
- 不要在日志中打印账号、密码、Token、Cookie 或接口完整凭据。
- 不要提交 `.env`、真实账号密码、Token、Cookie 或含敏感信息的截图。
- 不要读取浏览器本地配置、密码、Cookie 或会话文件。
- 当前自动登录只支持 `safe_mode=0`；不要保存二级密码，不要自动处理邮箱验证码或扫码登录。
- `pay.ldxp.cn` 会 301 跳转到 `wzyp.cn`；浏览器无法跟随 CORS 预检跳转，所以纯前端必须使用 `https://wzyp.cn` 作为接口基地址。
- 不要恢复后端代理，除非用户明确要求或 `wzyp.cn` 的 CORS 策略导致纯前端失效。
- 不要调用写接口，例如：
  - `/merchantApi/MyParent/connectGoods`
  - `/merchantApi/MyParent/disconnectGoods`
  - `/merchantApi/MyParent/fetchConnectGoods`
  - `/merchantApi/MyParent/fetchDisconnectGoods`
  - `/merchantApi/MyParent/copyConnectGoods`
- 默认不要做跨页/全量扫描。当前排序和筛选只作用于当前页。

## 接口事实

登录链路：

```json
{
  "username": "账号",
  "password": "密码"
}
```

先请求：

```text
POST /merchantApi/user/checkSafeMode
```

仅当 `data.safe_mode` 为 `0` 时再请求：

```text
POST /merchantApi/user/login
```

登录成功响应包含 `data.merchant_token`。

`searchGoodsList` 支持分页：

```json
{
  "current": 1,
  "pageSize": 20,
  "name": "",
  "goods_type": "card",
  "keywords": "GPT"
}
```

响应包含 `data.list` 和 `data.total`。

页面显示价格时可用字段：

- `price`：商品实际售价
- `cost_price`：当前账号成本价
- `agent_price_limit`：限制售价/最低售价
- `agent_price1`、`agent_price2`、`agent_price3`：不同代理等级价格

页面显示商家信息时可用字段：

- `user.link`：商家店铺链接
- `user.nickname`：商家昵称
- `user.avatar`：商家头像
- `user.contact_qq`：QQ 联系方式
- `user.contact_mobile`：手机、群号或商家填写的联系文本
- `user.contact_wechat`：微信或商家填写的其他联系文本

## 本地存储

- `ldxp-login-credentials`：LDXP 用户名和密码，明文保存，仅适合本机自用。
- `ldxp-merchant-token`：`{ username, token }`，只允许绑定账号使用；旧版裸 Token 不复用。
- `ldxp-save-login`：保存凭据偏好，关闭时立即移除持久化凭据和 Token。
- `ldxp-keyword-history`：最近商品关键词，最多 20 个。
- `ldxp-last-search-state`：上一次搜索条件、页码、每页数量、排序筛选。

统一通过 storage 访问存储；浏览器禁用存储时降级到内存。修改凭据时取消旧请求、清除旧会话和搜索缓存，旧登录响应禁止回写。搜索禁用自动重试及断网重连自动查询，每次查询最多重登一次。不把凭据放入查询缓存键。排序和筛选设置统一写入 last-search-state，不再维护独立 sort-key。

## 开发命令

```bash
npm install
npm run dev
npm run typecheck
npm test
npm run build
npm run check
npm run preview
```

完成修改后至少运行：

```bash
npm run typecheck
npm run build
```

也可以直接运行：

```bash
npm run check
```

如果改了 Vite 配置，重启开发服务。

## 开源维护原则

- 新增功能时同步更新 README；改变安全边界时同步更新 SECURITY。
- 不要添加真实仓库地址占位、个人 Token、账号信息或不可复现的本地路径。
- CI 使用 Node 22 和 npm ci；改依赖后必须提交更新后的 `package-lock.json`。
- 当前许可证为 MIT。

## UI 维护原则

- 搜索区保持紧凑，不要使用营销页式大标题或大卡片。
- 不要让顶部区域固定遮挡商品列表。
- 表格允许横向滚动，页面本身自然纵向滚动。
- 每页数量由用户控制，但前端响应仍应瘦身，避免长 HTML 描述拖慢页面。
- 分页入口在空结果时仍可见；页码回车或按钮提交，修改每页数量后从第 1 页查起。翻页使用已提交的关键词和类型。
- 成本价区间须合法；缺失价格不等于免费，升序和降序均放最后。商品响应字段必须做运行时校验。
- 图标使用 `lucide-react`，不要用 emoji 做功能图标。

## 后续可选优化

- 做“深度扫描前 N 页并排序”的独立按钮，但必须明确提示会增加请求量。
- 增加导出当前页 CSV。
- 增加商品详情抽屉，但不要默认拉取长描述。
