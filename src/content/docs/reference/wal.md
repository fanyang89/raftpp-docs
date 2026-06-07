---
title: WAL
description: raftpp WAL 子系统的组成、恢复语义与配置项说明。
---

WAL 子系统位于 `include/raftpp/raftor/wal/`，用于为 `Raftor` 提供持久化日志、硬状态和配置状态支持。

## 主要组件

- `WAL`
- `WALStorage`
- `WALConfig`
- `SegmentManager`
- `WALIndex`
- `MetadataStore`

## `WAL`

`WAL` 是底层写前日志实现，负责：

- 追加日志条目
- 保存 `HardState`
- 保存 `ConfState`
- 保存 Raftor peer address book
- 读取日志区间
- 执行压缩与快照应用
- 恢复已有 WAL 文件

### 关键约束

- 追加的 entries 必须与当前 `last_index` 连续。
- `HardState`、`ConfState` 和日志索引必须保持一致。
- 恢复时会回放已有 segment 并重建索引。

## `WALStorage`

`WALStorage` 基于 `WAL` 实现 `Storage` 接口，并增加了以下特性：

- `SetHardState()`
- `Append()`
- `Compact()`
- `ApplySnapshot()`
- `Sync()`
- `LocalSnapshot()`
- `LogSizeBytes()`
- `IsInitialized()`
- `GetPeerAddresses()` / `SetPeerAddresses()`
- `UpsertPeerAddress()` / `RemovePeerAddress()`
- `SnapshotIndex()`

其中 `IsInitialized()` 通过 `ConfState.voters` 是否非空判断该存储是否已经完成初始集群配置写入。

## Peer 地址簿

`WAL` 元数据会持久化 Raftor 使用的 peer 地址簿。

- 首次引导时，地址簿来自 `initial_peers`；单节点引导时写入当前节点的 `node_id` 和 `listen_addr`。
- 节点重启且 WAL 已初始化时，Raftor 会从 WAL 读取 peer 地址，而不是重新使用 `initial_peers`。
- `UpdateNodeAddress(id, addr)` 会通过普通日志提交地址变更；应用后调用 `UpsertPeerAddress()` 并更新传输层 peer。
- `RemoveNode(id)` 对应的配置变更应用后会调用 `RemovePeerAddress()` 并移除传输层 peer。

这意味着运行期地址变化应通过 Raftor API 提交，而不是只修改重启参数。

## 快照语义

`WALStorage` 在内存中维护一个当前快照副本，并在 `ApplySnapshot()` 时：

1. 先更新内存中的快照对象。
2. 再调用底层 `WAL::ApplySnapshot()`。

`Term(idx)` 会优先检查当前快照元数据，因此能正确处理“索引正好等于快照索引”的查询。

## I/O 后端

`WALConfig.io_backend` 支持：

- `Auto`
- `Posix`
- `IoUring`

其中：

- `Auto` 表示由实现自动选择可用后端。
- `IoUring` 仅在 Linux 且系统支持 `liburing` 时可用。

可通过以下接口查询最终选择结果：

- `EffectiveIoBackend()`
- `IoBackendNote()`

## 关键配置项

### `segment_size`

单个 segment 文件的最大大小，默认 64MB。

### `write_buffer_size`

批量写入缓冲区大小，默认 4MB。

### `sync_on_write`

是否在每次写批次后同步到磁盘，默认 `true`。

### `preallocate`

是否预分配 segment 文件，默认 `true`。

### `uring_queue_depth`

`IoUring` 后端的提交队列深度。

## 恢复语义

`WAL::Open()` 会根据目录内容打开或创建 WAL，并执行恢复流程：

- 读取元数据
- 回放 segment
- 重建索引
- 恢复 `HardState` 与 `ConfState`
- 恢复 peer address book 与快照索引

因此，节点重启后应继续使用原有 `data_dir`，否则不会进入同一恢复路径。

`WALStorage::LocalSnapshot()` 会返回最新本地应用快照。`Raftor::Create()` 会在创建 `RawNode` 前先把该快照恢复到业务状态机，并把快照 index 作为初始 applied index。

## 相关文档

- [集群引导与恢复](/guides/bootstrap-and-recovery/)
- [快照与日志压缩](/guides/snapshots-and-compaction/)
- [Storage](/reference/storage/)
