---
title: RawNode Ready 流程
description: Ready、LightReady 与持久化顺序的使用说明。
---

`RawNode` 是底层驱动接口。使用 `RawNode` 时，调用方需要自行保证持久化、发送消息、应用日志和推进状态的顺序正确。

## `Ready` 包含什么

`Ready` 表示一次可见状态增量，可能包含：

- `ss`：软状态，例如当前角色和 leader ID。
- `hs`：硬状态，例如 term、vote、commit。
- `entries`：需要持久化的新日志。
- `snapshot`：需要安装或持久化的快照。
- `read_states`：读索引结果。
- `light`：推进后可继续处理的轻量结果。
- `must_sync`：本次持久化是否需要同步落盘。

## `LightReady` 的含义

`LightReady` 是对本批次 `Ready` 调用 `Advance()` 之后得到的后续结果，通常包含：

- 新的 `commit_index`
- 新提交的日志
- 可继续发送的消息

## 处理顺序

推荐顺序如下：

1. 读取 `Ready`。
2. 持久化 `entries`、`hs` 和 `snapshot`。
3. 如果 `must_sync` 为真，则完成必要的同步落盘。
4. 发送当前批次应发送的消息。
5. 应用已提交日志和快照。
6. 调用 `Advance()`。
7. 处理返回的 `LightReady`。
8. 在日志应用完成后调用 `AdvanceApply()` 或 `AdvanceApplyTo()`。

顺序颠倒可能导致：

- 崩溃恢复点错误
- 重复发送消息
- 提交与应用进度不一致

## `rd.Messages()` 与 `rd.light.messages`

`Ready` 中的消息位置与节点角色有关。

- 对部分场景，消息可直接从 `rd.Messages()` 取得。
- 对非 leader 的持久化后消息，实际发送集合可能位于 `rd.light.messages`。

因此不能只检查 `rd.Messages()`，而忽略 `rd.light.messages`。

## `must_sync`

`must_sync` 表示本次批次在对外可见前需要完成同步落盘。`Raftor` 的默认实现是在持久化硬状态后，根据 `must_sync` 调用 `storage->Sync()`。

如果自行驱动 `RawNode`，应保证与此语义一致。

## 推进接口

### `Advance(const Ready&)`

通知 `RawNode` 当前批次的持久化和应用步骤已经完成，并获取后续 `LightReady`。

### `AdvanceAppend(const Ready&)`

用于只推进追加持久化路径的变体接口，适合更细粒度的高级集成场景。

### `AdvanceApply()` 与 `AdvanceApplyTo(applied)`

用于推进应用进度。只有在调用方已经完成对应日志应用后，才应推进应用位置。

## 异步取日志

`Storage::Entries()` 支持携带 `GetEntriesContext`。当存储实现需要异步获取日志时，可以配合：

- `AdvanceAppendAsync(const Ready&)`
- `OnEntriesFetched(const GetEntriesContext&)`

这属于更底层的存储集成能力，只有在自定义存储实现明确需要时才应使用。

## 最小驱动示意

```cpp
while (raw_node.HasReady()) {
    auto rd = raw_node.GetReady();

    // 1. persist rd.entries / rd.hs / rd.snapshot
    // 2. if rd.must_sync: sync storage
    // 3. send messages
    // 4. apply committed entries / snapshot

    auto light = raw_node.Advance(rd);

    // 5. send light.messages
    // 6. apply light.committed_entries
    // 7. raw_node.AdvanceApply()
}
```

## 相关文档

- [RawNode](/reference/raw-node/)
- [Storage](/reference/storage/)
- [复制流控](/reference/replication-flow-control/)
