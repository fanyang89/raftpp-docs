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
- `is_persisted_msg`：提示消息是否应走持久化后发送路径。

## `LightReady` 的含义

`LightReady` 是对本批次 `Ready` 调用 `Advance()` 之后得到的后续结果，通常包含：

- 新的 `commit_index`
- 新提交的日志
- 可继续发送的消息

## 处理顺序

1. 读取 `Ready`。
2. 如启用 entry checksum，校验待持久化 entries。
3. 持久化 `entries` 和 `hs`。
4. 如果 `must_sync` 为真，同步落盘。
5. 安装 `snapshot`。
6. 发送持久化后可发送的消息。
7. 应用已提交日志。
8. 处理 `read_states`。
9. 调用 `Advance()`。
10. 处理返回的 `LightReady`。
11. 日志应用完成后调用 `AdvanceApply()` 或 `AdvanceApplyTo()`。

顺序颠倒可能导致恢复点错误、重复发送消息或提交与应用进度不一致。

## `rd.Messages()` 与 `light.messages`

`Ready` 中的消息位置与节点角色有关：

- 部分消息可直接从 `rd.Messages()` 取得。
- 非 leader 的持久化后消息可能位于 `light.messages`。

两者都需要检查，不能只看 `rd.Messages()`。

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

    // 1. persist rd.entries / rd.hs
    // 2. if rd.must_sync: sync storage
    // 3. install rd.snapshot if present
    // 4. send persisted messages
    // 5. apply committed entries

    auto light = raw_node.Advance(rd);

    // 6. send light.messages
    // 7. apply light.committed_entries
    // 8. raw_node.AdvanceApply()
}
```

## 相关文档

- [RawNode](/reference/raw-node/)
- [Storage](/reference/storage/)
- [复制流控](/reference/replication-flow-control/)
