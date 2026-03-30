---
title: minimal_node
description: 最小单节点示例说明。
---

`examples/minimal_node/` 是仓库中的最小可运行示例，用于说明 `raftpp` 的基本接入方式。

## 示例展示了什么

- 一个最小可工作的 `StateMachine`。
- 如何构造 `RaftorConfig`。
- 如何创建、启动、轮询并停止 `Raftor`。
- 单节点如何自动成为 leader。

## 代码位置

- 示例源码：`examples/minimal_node/main.cc`
- 构建目标：`minimal-node-example`

## 构建

在仓库根目录执行：

```bash
task cmake
cmake --build build --target minimal-node-example
```

## 运行

```bash
./build/examples/minimal_node/minimal-node-example
```

程序会：

1. 创建本地数据目录 `./minimal-node-data`。
2. 启动一个节点 ID 为 `1` 的单节点集群。
3. 反复调用 `Poll()` 驱动事件循环。
4. 在单节点场景下等待节点当选 leader。

## 示例特点

- 不引入 HTTP、CLI 或额外业务协议。
- 状态机实现较小，便于理解接口边界。
- 覆盖最小接入所需的关键步骤。

## 扩展方向

可按以下顺序扩展为业务节点：

1. 把 `Apply()` 改造成真实业务命令处理。
2. 为快照定义稳定的序列化格式。
3. 把单节点配置扩展成多节点 `initial_peers`。
4. 增加提案入口和读接口。

更完整的应用级示例见[kvstore](/examples/kvstore/)。
