# raftpp Docs

`docs/` 是 `raftpp` 的文档站点，使用 Astro + Starlight 构建。

## 本地开发

在 `docs/` 目录下执行：

```bash
pnpm install
pnpm dev
```

默认会在 `http://localhost:4321` 启动预览。

## 构建

```bash
pnpm build
```

产物会输出到 `docs/dist/`。

## 内容位置

- 页面内容：`src/content/docs/`
- 站点配置：`astro.config.mjs`
- 静态资源：`public/`

## 编写约定

- 面向使用者的文档使用中文。
- 代码片段、命令、API 名称保持原始英文。
- 文档内容应与仓库中的真实实现保持一致，优先以头文件、CMake 配置和示例代码为准。
