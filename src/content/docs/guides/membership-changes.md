---
title: 成员变更
description: 配置变更、 Joint Consensus、learner 与运行期成员管理说明。
---

成员变更相关逻辑主要由 `ConfChanger`、`ProgressTracker` 和 `RawNode::ApplyConfChange()` 协同完成。

## 变更模型

`raftpp` 支持基于 `ConfChangeV2` 的配置变更。文档层面应区分以下几种形式：

- simple change
- joint consensus
- leave joint

## simple change

simple change 适用于单次只修改一个 voter 的情况。

`ConfChanger::Simple()` 会在应用后比较新旧 voter 集合；如果一次 simple change 影响多个 voter，将返回 `MultipleVotersChangedWithoutJoint`。

因此，以下规则必须成立：

- 一次 simple change 不能同时增加或删除多个 voter。
- 多 voter 变更必须进入 joint consensus。

## joint consensus

当需要在一次变更中影响多个 voter 时，应使用 joint consensus。

`ConfChanger::EnterJoint()` 会：

- 把当前 `incoming` voter 集合复制到 `outgoing`
- 对新配置应用变更
- 根据参数设置 `auto_leave`

joint 状态下，配置同时包含 `incoming` 和 `outgoing` 两组 voter。

## 离开 joint

`ConfChanger::LeaveJoint()` 会：

- 把 `learners_next` 合并到 `learners`
- 移除只存在于 `outgoing`、但不在 `incoming` 和 `learners` 中的节点进度
- 清空 `outgoing`
- 将 `auto_leave` 设为 `false`

如果当前配置不是 joint 状态，调用 `LeaveJoint()` 会失败。

## learner 与 `learners_next`

learner 节点不会参与投票。

当一个节点在 joint 配置中从 voter 转为 learner 时，并不会立即进入 `learners`；如果它仍在 `outgoing` voter 集合中，会先进入 `learners_next`，直到离开 joint 后才真正落入 `learners`。

这也是 `learners_next` 必须在非 joint 状态下为空的原因。

## `auto_leave`

`auto_leave` 仅在 joint 配置中有效。

如果配置不是 joint 状态而 `auto_leave` 为真，`CheckInvariants()` 会返回错误。

## `Raftor` 层接口

`Raftor` 暴露了两个常用接口：

- `AddNode(id, addr)`
- `RemoveNode(id)`

### `AddNode(id, addr)`

该接口会：

1. 构造一个 `ConfChangeV2`，类型为 `ADD_NODE`
2. 把 `addr` 写入配置变更的 `context`
3. 调用 `raw_node_->ProposeConfChange()` 发起提案
4. 立即调用 `transport_->AddPeer(id, addr)` 将 peer 加入传输层

需要明确的是：返回成功只表示配置变更提案已经发起，并不表示该节点已经成为生效成员。

### `RemoveNode(id)`

该接口只负责发起 `REMOVE_NODE` 配置变更提案。真正从传输层移除 peer 的动作发生在对应配置变更日志被应用时。

## 配置变更日志的应用

`ReadyProcessor::ApplyEntry()` 在处理配置变更日志时会：

- 将 v1 配置变更转换为 `ConfChangeV2`
- 调用 `raw_node_.ApplyConfChange(cc)` 更新跟踪器状态
- 对 `REMOVE_NODE` 执行 `transport_.RemovePeer()`
- 在存在上下文时完成对应提案回调

## 文档中应明确的限制

- 运行中的成员变更不能通过修改 `initial_peers` 完成。
- simple change 一次不能修改多个 voter。
- `AddNode()` 的返回成功不等于成员已经提交并生效。
- learner 与 `learners_next` 的差异必须明确区分。

## 相关文档

- [集群引导与恢复](/guides/bootstrap-and-recovery/)
- [提案与错误模型](/reference/proposals-and-errors/)
- [复制流控](/reference/replication-flow-control/)
