---
title: 提案与错误模型
description: 提案、读请求、超时与回调完成条件说明。
---

`Raftor` 通过 `ProposalTracker`、`ProposalQueue` 和 `ReadIndexQueue` 管理异步提案与读请求。

## 提案路径

普通提案处理步骤：

1. 调用方调用 `Propose()`、`ProposeSync()` 或 `ProposeAsync()`。
2. 请求被放入 `ProposalQueue`。
3. 事件循环线程生成唯一上下文 `node_id:counter`。
4. `ProposalTracker::Track()` 开始跟踪该上下文。
5. 调用 `raw_node_->Propose(ctx, data)` 提交日志。
6. 当对应 entry 被状态机 `Apply()` 成功应用后，通过 `ProposalTracker::Complete()` 完成回调。

## 配置变更提案

配置变更提案通过 `raw_node_->ProposeConfChange(ctx, cc)` 发起。

在 `ReadyProcessor::ApplyEntry()` 中，当对应配置变更日志被应用后，会调用：

- `raw_node_.ApplyConfChange(cc)`
- 更新存储中的 `ConfState`
- 根据变更类型更新 WAL 地址簿和 transport peer
- 完成已注册的相关提案追踪项（如果存在）

因此，`AddNode()` / `RemoveNode()` 的同步返回只表示“提案已发起”，真正完成点仍是配置变更 entry 被应用。

地址更新通过 `UpdateNodeAddress(id, addr)` 提交普通日志。该日志使用内部 metadata context，应用后更新 WAL 地址簿和传输层 peer，并完成已注册的相关提案追踪项（如果存在）。

## 读请求路径

读请求处理步骤：

1. 调用方调用 `ReadIndex()` 或 `ReadIndexSync()`。
2. 请求被放入 `ReadIndexQueue`。
3. 事件循环线程调用 `ProposalTracker::TrackRead()`。
4. 调用 `raw_node_->ReadIndex(ctx)`。
5. 当 `Ready.read_states` 返回并且 `applied_index >= read_state.index` 时，调用 `CompleteRead(ctx)`。

## 超时

超时由 `ProposalTracker::ExpireTimeouts()` 统一处理。

超时来源：`proposal_timeout`、`read_index_timeout` 和各次调用显式传入的超时。

超时后，回调收到的错误为 `RpcErrorCode::Timeout`。

## 关闭与领导权变化

### 关闭

`Raftor::Stop()` 清空跨线程队列中的未处理请求，对已跟踪的提案调用 `FailAll(ShuttingDown)`，对已跟踪的读请求调用 `FailAllReads(ShuttingDown)`。

### 失去领导权

`ReadyProcessor::CheckLeadershipChange()` 检测到节点从 leader 退为非 leader 时，对提案调用 `FailAll(ProposalDropped)`，对读请求调用 `FailAllReads(LostLeadership)`。

## 常见错误语义

### `ShuttingDown`

节点正在关闭，请求未能完成。

### `ProposalDropped`

提案在提交或领导权变化过程中被丢弃。

### `LostLeadership`

读请求在节点失去领导权时被终止。

### `Timeout`

请求在限定时间内未完成。

### `ChecksumMismatch`

当 `enable_entry_checksum = true` 且 entry 的 CRC32C 校验失败时返回。该错误被视为致命数据完整性错误：

- 对应 entry 不会应用到状态机。
- 节点会进入 terminal state 并停止运行。
- 后续 `Start()`、提案和读请求都会收到 `ChecksumMismatch`。

### `ConfChangeParseError`

内部 metadata 变更或配置变更日志无法解析时返回。

## 回调完成条件

- 普通提案：对应日志被状态机成功应用，或状态机返回错误后失败完成。
- 配置变更：对应配置变更日志被应用。
- metadata 变更：对应内部 metadata 日志被应用。
- 读请求：对应 read index 已被确认，且本地应用进度达到该索引。

- `ProposeSync()` / `ReadIndexSync()` 超时仅表示调用方不再等待，后台状态机仍会继续处理。
- `AddNode()` 的 peer 地址在配置变更日志应用后写入 WAL 地址簿并更新 transport。
- 失去领导权时，未完成提案返回 `ProposalDropped`，未完成读请求返回 `LostLeadership`。
- 节点未 `Start()`、已 `Stop()` 或正在关闭时，请求返回 `ShuttingDown`。

## 相关文档

- [Raftor 使用](/guides/raftor/)
- [线性一致读](/guides/linearizable-reads/)
- [成员变更](/guides/membership-changes/)
