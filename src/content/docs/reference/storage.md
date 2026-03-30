---
title: Storage
description: raftpp::Storage 接口及其实现约束。
---

`Storage` 是 Core 层用于访问稳定存储的抽象接口，定义位于 `include/raftpp/core/storage.h`。

## 接口列表

- `InitialState()`
- `Entries(low, high, max_size, context)`
- `Term(idx)`
- `FirstIndex()`
- `LastIndex()`
- `GetSnapshot(request_index, to)`

## `InitialState()`

返回 `RaftState`，包含：

- `HardState`
- `ConfState`

启动恢复时，`RawNode` 会基于该结果恢复当前持久化状态。

## `Entries(low, high, max_size, context)`

返回区间 `[low, high)` 内的日志条目。

语义要点：

- `max_size` 指定返回的最大字节数上限。
- 即使设置了 `max_size`，也应至少返回一条 entry。
- `context` 用于说明此次取日志的用途，例如发送追加、生成 `Ready` 或其他内部路径。

## `Term(idx)`

返回指定索引的 term。

语义要点：

- 存储实现需要正确处理快照边界。
- 对已经被压缩的日志索引，应返回与压缩语义一致的错误。

## `FirstIndex()` 与 `LastIndex()`

- `FirstIndex()` 返回当前存储中第一个可用日志索引。
- `LastIndex()` 返回当前最后一个可用日志索引。

它们定义了当前存储持有日志的有效区间。

## `GetSnapshot(request_index, to)`

返回可用于发送或恢复的快照。

如果快照尚未准备好，可以返回临时不可用错误，而不是伪造一个不完整快照。

## `MemoryStorage`

`MemoryStorage` 是最直接的参考实现，额外提供以下便捷能力：

- `Append()`
- `Compact()`
- `ApplySnapshot()`
- `AllEntries()`
- 故障注入辅助接口，例如 `TriggerSnapshotUnavailable()`

如果需要理解接口的最小正确实现，可先阅读 `MemoryStorage`。

## 与 `Raftor` 的关系

`Raftor::Create(config, state_machine, storage, transport)` 虽然参数类型是 `std::shared_ptr<Storage>`，但当前实现会要求该对象能够动态转换为 `WALStorage`，否则返回 `IncompatibleStorage`。

因此：

- Core 层可基于任意 `Storage` 实现工作。
- 当前 `Raftor` 的自定义存储接入仍以 `WALStorage` 为前提。

## 自定义存储实现注意事项

- 返回的索引区间必须与 `FirstIndex()` / `LastIndex()` 一致。
- 不能返回破坏日志连续性的结果。
- 快照边界与日志边界必须一致。
- 如果支持异步取日志，应正确处理 `GetEntriesContext`。

## 相关文档

- [RawNode Ready 流程](/guides/raw-node-ready-flow/)
- [WAL](/reference/wal/)
- [RawNode](/reference/raw-node/)
