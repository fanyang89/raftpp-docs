---
title: 快照与日志压缩
description: 快照生成、恢复、自动触发与日志压缩语义说明。
---

快照控制日志增长，为落后节点提供恢复点，涉及状态机、存储和 `ReadyProcessor`。

## 状态机接口契约

状态机需要实现两个快照相关接口：

- `TakeSnapshot(applied_index, applied_term, conf_state, writer)`
- `RestoreSnapshot(metadata, reader)`



- 快照必须覆盖到 `applied_index`。
- 快照必须能够独立恢复，不依赖额外的隐含状态。
- 元数据中的 `index`、`term` 和 `conf_state` 必须与快照内容一致。

## 手动触发路径

`Raftor::TakeSnapshot()` 的步骤：

1. 读取当前 `applied_index`。
2. 从存储读取当前 `ConfState`。
3. 查询 `applied_index` 对应的 term。
4. 调用状态机 `TakeSnapshot()` 输出快照负载。
5. 将快照应用到存储。
6. 对 WAL 执行压缩。

快照 payload 通过 `SnapshotWriter` 先写入临时文件，再装载到 Cap'n Proto `Snapshot.data`。状态机不需要一次性将全部快照内容保存在内存中。

## 安装快照的顺序

当 `Ready` 带有快照时，`ReadyProcessor::ApplySnapshot()` 的处理顺序：

1. 先调用状态机 `RestoreSnapshot()`。
2. 再调用 `storage_->ApplySnapshot(snapshot)`。

对 `raftpp` 而言，恢复业务状态优先于持久化层更新。

## 自动快照触发条件

`RaftorConfig` 提供三类自动快照条件：

- `snapshot_entries_threshold`
- `snapshot_log_size_bytes`
- `snapshot_interval`

`RaftorImpl::MaybeAutoSnapshot()` 按以下条件检查是否触发：

- `applied_index - snapshot_index >= snapshot_entries_threshold`
- 距上次快照时间达到 `snapshot_interval`
- WAL 目录体积达到 `snapshot_log_size_bytes`

如果三者都为零，则不会自动快照。

## 快照与日志压缩的关系

快照本身不等于压缩完成。快照建立后，存储层仍须根据快照索引推进 `first_index`，丢弃不再需要的日志。

在 `WAL` 中，`ApplySnapshot()` 和 `Compact()` 共同参与这一过程。

## 快照恢复点

`WALStorage::GetSnapshot()` 在内存中维护快照副本；无可用快照时返回 `SnapshotTemporarilyUnavailable`。

- 快照不可用不一定是恢复点损坏，也可能尚未生成或准备好。
- 调用方须将该状态与致命存储错误区分。

`WALStorage::LocalSnapshot()` 用于节点本地重启恢复；如果存在快照，`Raftor::Create()` 会先恢复状态机，再用该快照 index 初始化应用进度。

## 配置建议

- 日志增长较快时，可优先使用 `snapshot_entries_threshold` 或 `snapshot_log_size_bytes`。
- 周期性写入少但运行时间长的服务，可叠加 `snapshot_interval`。
- 不建议同时将所有阈值设置得过于激进。

## 相关文档

- [状态机开发](/guides/state-machine/)
- [WAL](/reference/wal/)
- [RaftorConfig](/reference/raftor-config/)
