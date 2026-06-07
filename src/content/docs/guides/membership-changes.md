---
title: 成员变更
description: 配置变更、 Joint Consensus、learner 与运行期成员管理说明。
---

成员变更由 `ConfChanger`、`ProgressTracker` 和 `RawNode::ApplyConfChange()` 协同完成。

## 变更模型

`raftpp` 支持基于 `ConfChangeV2` 的配置变更，分为三种形式：

- simple change
- joint consensus
- leave joint

## simple change

simple change 适用于单次只修改一个 voter 的情况。

`ConfChanger::Simple()` 应用后比较新旧 voter 集合；一次影响多个 voter 时返回 `MultipleVotersChangedWithoutJoint`。

规则：

- 一次 simple change 不能同时增加或删除多个 voter。
- 多 voter 变更必须进入 joint consensus。

## joint consensus

当需要在一次变更中影响多个 voter 时，应使用 joint consensus。

`ConfChanger::EnterJoint()`：

- 把当前 `incoming` voter 集合复制到 `outgoing`
- 对新配置应用变更
- 根据参数设置 `auto_leave`

joint 状态下，配置同时包含 `incoming` 和 `outgoing` 两组 voter。

## 离开 joint

`ConfChanger::LeaveJoint()`：

- 把 `learners_next` 合并到 `learners`
- 移除只存在于 `outgoing`、但不在 `incoming` 和 `learners` 中的节点进度
- 清空 `outgoing`
- 将 `auto_leave` 设为 `false`

如果当前配置不是 joint 状态，调用 `LeaveJoint()` 会失败。

## learner 与 `learners_next`

learner 节点不会参与投票。

当一个节点在 joint 配置中从 voter 转为 learner 时，并不会立即进入 `learners`；如果它仍在 `outgoing` voter 集合中，会先进入 `learners_next`，直到离开 joint 后才正式成为 `learners`。

因此 `learners_next` 在非 joint 状态下必须为空。

## `auto_leave`

`auto_leave` 仅在 joint 配置中有效。

如果配置不是 joint 状态而 `auto_leave` 为真，`CheckInvariants()` 会返回错误。

## `Raftor` 层接口

`Raftor` 暴露的常用接口：

- `AddNode(id, addr)`
- `RemoveNode(id)`
- `UpdateNodeAddress(id, addr)`

### `AddNode(id, addr)`

该接口构造 `ConfChangeV2`（`ADD_NODE`），把 `addr` 写入 `context`，调用 `raw_node_->ProposeConfChange()` 发起提案。

返回成功只表示提案已发起，不代表该节点已成为生效成员。

对应配置变更日志被应用后，Raftor 才会把地址写入 WAL 地址簿，并对非本节点调用 `transport_.AddPeer(id, addr)`。

### `RemoveNode(id)`

该接口发起 `REMOVE_NODE` 配置变更提案；传输层移除 peer 发生在配置变更日志应用时。

### `UpdateNodeAddress(id, addr)`

该接口更新已存在成员的传输地址，不修改成员集合。

流程：

1. 校验 `id` 非零，`addr` 非空。
2. 从当前 `ConfState` 确认该节点已存在。
3. 使用内部 metadata context 提交普通日志。
4. 日志应用后更新 WAL 地址簿。
5. 如果目标不是本节点且地址非空，调用 `transport_.AddPeer(id, addr)`；如果目标是本节点或地址为空，则移除对应 peer。

运行期节点地址变化应通过该接口提交，不能只修改 `initial_peers` 后重启。

## 配置变更日志的应用

`ReadyProcessor::ApplyEntry()` 处理配置变更日志时：

- 将 v1 配置变更转换为 `ConfChangeV2`
- 调用 `raw_node_.ApplyConfChange(cc)` 更新跟踪器状态
- 对 `ADD_NODE` / `ADD_LEARNER_NODE` 写入地址簿并执行 `transport_.AddPeer()`
- 对 `REMOVE_NODE` 删除地址簿并执行 `transport_.RemovePeer()`
- 在存在上下文时完成对应提案回调

## 限制

- 运行中的成员变更不能通过修改 `initial_peers` 完成。
- simple change 一次不能修改多个 voter。
- `AddNode()` 返回成功只表示提案已发起，不代表成员已生效。
- `AddNode()` 不会在提案发起时立即加入 transport；peer 加入发生在配置变更日志应用后。
- 地址更新应使用 `UpdateNodeAddress()`，目标节点必须已在当前配置中。
- learner 与 `learners_next` 的差异见上文。

## 相关文档

- [集群引导与恢复](/guides/bootstrap-and-recovery/)
- [提案与错误模型](/reference/proposals-and-errors/)
- [复制流控](/reference/replication-flow-control/)
