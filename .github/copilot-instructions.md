# Copilot 使用说明（针对 moeflow-frontend）

下面的简短说明帮助 AI 代码助手在本仓库中直接上手并保持一致性。按照“可发现”的约定编写——只记录仓库中可验证的模式与命令。

- **项目类型**: React + TypeScript 前端，基于 Vite 构建（`vite`），React 版本为 17，使用 `react-router-dom@5`。入口是 `src/index.tsx`，主组件为 `src/App.tsx`。
- **状态管理**: Redux + `redux-saga`，store 位于 `store/`，各 slice 在 `store/*/slice`（例如 `store/site/slice`、`store/user/slice`）。
- **网络层**: 所有后端请求在 `src/apis/` 下，公共 request 封装在 `src/apis/_request.ts`（示例：`uploadRequest`），修改请求格式请先查看此目录并保持返回结构兼容后端约定。
- **路由约定**: 路由集合定义在 `src/pages/routes.ts`，路由使用 `Switch/Route/Redirect`（React Router v5）。若新增页面，注册到 `src/pages` 并在 `routes.ts` 维护路径常量。
- **i18n**: 国际化由 `src/locales` 与 `scripts/generate-locale-json.ts` 管理。若修改或新增翻译键，请运行 `npm run build:locale` 来生成 JSON。
- **样式**: 使用 emotion（`@emotion/core`）+ Ant Design，antd Less 变量在 `src/style` 定义并由 `vite.config.mts` 中的 `modifyVars` 覆盖。全局样式覆盖示例见 `src/App.tsx` 中的 `Global`。
- **开发服务器 / 代理**: 开发时 Vite 会把 `/api/` 代理到本地后端（`vite.config.mts` 中 `server.proxy`），默认后端地址由环境变量 `REACT_APP_BASE_URL` 控制（见 `vite.config.mts` 的 `define`）。修改代理或基地址请优先修改 `vite.config.mts` 或 `.env`。
- **脚本 & 常用命令** (见 `package.json`):
  - 安装依赖: `npm install`
  - 本地开发: `npm start` (vite dev server)
  - 构建: `npm run build`
  - 类型检查: `npm run typecheck`
  - 单元测试: `npm test`（Jest，setup 文件位于 `src/test/setup.ts`）
  - 本地生成翻译: `npm run build:locale`
  - 格式与校验: `npm run format` / `npm run format:fix`，`npm run lint` / `npm run lint:fix`
- **TypeScript / 编译约定**: `tsconfig.json` 开启严格模式（`strict: true`），不要在提交中禁用类型检查的关键项。路径别名 `@/*` 映射到 `src/*`，修改时注意同步 `tsconfig.json`。
- **兼容性注意**: React 版本是 17（非 18），入口使用 `ReactDOM.render`（见 `src/index.tsx`），不要擅自迁移到 `createRoot` 或 React 18 特性。
- **新增功能或修改后端交互时的警告**: README 明确提示后端版本兼容性（请参考仓库根 README）。修改 API shape 前请核对 `src/apis` 与后端 API 文档，尽量保持兼容或同时调整后端。
- **小而明确的实现约定**:
  - 路由守卫：如果页面需要鉴权，App 中以 `token` 判断并 `Redirect` 到 `routes.login`，新页面若需要鉴权，应复用该模式。
  - 不要随意更改 `src/pages/routes.ts` 中的常量签名，路由字符串在项目中被广泛引用。
  - 快捷键（hotkey）逻辑存在于 `store/hotKey` 与 `utils/storage` 中；初始化逻辑在 `src/index.tsx`，修改需沿用现有加载/回写流程。

如果你需要对本文件进行改动：
- 保持简短（不要写太多高层抽象或空泛建议）。
- 引用具体文件路径并给出命令/示例。示例已尽量列在上面。

请审阅这些条目，有任何不完整或需补充的本地流程（例如 CI、部署细节或私有后端地址配置），告诉我我会把它合并更新。
