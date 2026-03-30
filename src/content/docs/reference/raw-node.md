---
title: RawNode
description: 底层驱动接口与 Ready 流程说明。
---

`RawNode` 是 `raftpp` 的底层驱动接口，定义位于 `include/raftpp/core/raw_node.h`。

`Raftor` 对运行时装配过程做了封装，而 `RawNode` 则将这些步骤直接暴露给集成方处理。

## 适用场景

- 你已经有自定义存储层。
- 你已经有自定义网络层。
- 你必须精确控制持久化、发送消息和应用日志的顺序。

## 关键概念

### `Ready`

一次可处理的状态增量集合，可能包含：

- `ss`：软状态，例如当前角色、leader。
- `hs`：硬状态，例如 term、vote、commit。
- `entries`：需要持久化的新日志。
- `snapshot`：需要安装或持久化的快照。
- `read_states`：读索引结果。
- `light`：可在推进后继续处理的轻量结果。
- `must_sync`：提示本次持久化是否需要同步落盘。

### `LightReady`

在一次 `Advance()` 之后返回的轻量结果，通常包含：

- 新提交的日志
- 可立即发送的消息
- 最新提交索引

## 基本驱动流程

典型使用模式如下：

```cpp
while (raw_node.HasReady()) {
    auto ready = raw_node.GetReady();

    // 1. 持久化 HardState、entries、snapshot
    // 2. 发送 ready 中的消息
    // 3. 应用 committed entries / snapshot

    auto light_ready = raw_node.Advance(ready);

    // 4. 继续处理 light_ready 中的消息和 committed entries
}
```

处理顺序的基本原则是：先按要求持久化，再推进状态机，最后处理后续可见结果。

## 常用接口

### 读取与推进

- `HasReady()`：判断是否有待处理数据。
- `GetReady()`：获取一批待处理状态。
- `Advance(const Ready&)`：通知 `RawNode` 当前批次已处理完毕，并获得 `LightReady`。
- `AdvanceApply()` / `AdvanceApplyTo(applied)`：推进应用进度。

### 提案与读

- `Propose(ctx, data)`：提交普通日志。
- `ProposeConfChange(ctx, cc)`：提交成员变更。
- `ReadIndex(ctx)`：发起只读确认。
- `Campaign()`：主动发起选举。

### 消息驱动

- `Step(message)`：向状态机注入一条消息。
- `Tick()`：推进逻辑时钟。
- `Ping()`：触发心跳相关逻辑。

### 其他控制

- `RequestSnapshot()`：请求生成快照。
- `TransferLeader(transferee)`：转移 leader。
- `ReportUnreachable(id)`：上报节点不可达。
- `ReportSnapshot(id, status)`：上报快照发送结果。

## 持久化顺序要点

当 `Ready` 中同时包含日志、硬状态和快照时，存储层应把它们视为一次一致性更新。文档层面最重要的是遵守两个原则：

1. 先把 `Ready` 要求持久化的内容安全落盘。
2. 再告诉 `RawNode` 这一批已经处理完成。

如果处理顺序颠倒，可能导致状态不一致、重复发送或恢复点错误。

## 适合继续使用 `Raftor` 的场景

如果需求主要包括：

- 接入业务状态机
- 得到线程安全的提案接口
- 直接使用默认 WAL 与默认 RPC

则通常不需要直接使用 `RawNode`，`Raftor` 更适合作为默认集成入口。
