---
title: 复制流控
description: Progress、Inflights 与复制状态转换说明。
---

复制流控相关结构主要位于：

- `include/raftpp/core/progress.h`
- `include/raftpp/core/inflights.h`
- `include/raftpp/core/progress_tracker.h`

## `ProgressState`

每个 follower 的复制进度处于以下三种状态之一：

- `Probe`
- `Replicate`
- `Snapshot`

### `Probe`

用于探测 follower 可以接受的日志位置。

### `Replicate`

用于正常复制路径，leader 可以按窗口持续发送追加消息。

### `Snapshot`

用于 follower 需要通过快照追赶的场景。

## `Progress`

`Progress` 记录单个 follower 的复制状态，核心字段包括：

- `matched`
- `next_idx`
- `pending_snapshot`
- `pending_request_snapshot`
- `recent_active`
- `inflights`
- `committed_index`

### `matched`

当前已确认复制到 follower 的最高索引。

### `next_idx`

下一次复制尝试的起始索引。

### `pending_snapshot`

当前正在发送或等待确认的快照索引。

## 状态转换接口

`Progress` 提供以下状态转换方法：

- `BecomeProbe()`
- `BecomeReplicate()`
- `BecomeSnapshot(snapshot_idx)`
- `SnapshotFailure()`

## `Inflights`

`Inflights` 是一个发送窗口，用于限制每个 follower 同时在路上的追加消息数量。

核心接口：

- `Add(inflight)`
- `Full()`
- `FreeTo(to)`
- `FreeFirstOne()`
- `Reset()`

当窗口已满时，leader 应暂停继续向该 follower 发送新的追加消息。

## `ProgressTracker`

`ProgressTracker` 负责管理所有 peer 的 `Progress`，并处理：

- 投票统计
- 法定人数判断
- 配置变更应用
- 最大可提交索引计算

核心接口：

- `CountVotes()`
- `HasQuorum()`
- `MaxCommittedIndex()`
- `ApplyConf()`

## 与配置变更的关系

成员变更会改变 `ProgressTracker` 内部的配置和 `ProgressMap`。`ConfChanger` 返回的 `MapChange` 最终会通过 `ProgressTracker::ApplyConf()` 应用。

## 文档中应明确的事项

- `Inflights` 控制的是“在路上的复制请求数量”，不是日志条目数。
- `Probe`、`Replicate`、`Snapshot` 表示复制阶段，而不是节点角色。
- `ProgressTracker` 同时承担复制进度和法定人数计算职责。

## 相关文档

- [成员变更](/guides/membership-changes/)
- [RawNode Ready 流程](/guides/raw-node-ready-flow/)
- [RawNode](/reference/raw-node/)
