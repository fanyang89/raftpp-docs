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
- `IsInitialized()`

其中 `IsInitialized()` 通过 `ConfState.voters` 是否非空判断该存储是否已经完成初始集群配置写入。

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

因此，节点重启后应继续使用原有 `data_dir`，否则不会进入同一恢复路径。

## 相关文档

- [集群引导与恢复](/guides/bootstrap-and-recovery/)
- [快照与日志压缩](/guides/snapshots-and-compaction/)
- [Storage](/reference/storage/)
