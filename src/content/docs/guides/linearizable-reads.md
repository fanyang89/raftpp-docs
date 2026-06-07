---
title: 线性一致读
description: ReadIndex 路径、读一致性模式与完成条件说明。
---

`raftpp` 通过 `ReadIndex` 路径提供线性一致读支持，不直接返回业务数据，而是为业务层建立安全读取的时刻。

## 两种模式

两种模式定义在 `include/raftpp/core/read_only.h`：

- `Safe`
- `LeaseBased`

### `Safe`

通过法定多数确认读许可，更保守，适合默认使用。

### `LeaseBased`

基于 leader lease 判定读许可，延迟更低，前提更严格。

`LeaseBased` 依赖 `check_quorum = true`，不满足则无法正确建立 lease 读语义。

## `ReadIndex()` 的语义

`Raftor::ReadIndex()` 成功回调表示 RAFT 层已确认读索引，且本地状态机应用进度已达到该索引。

`ReadyProcessor` 仅在 `applied_index >= read_state.index` 时才调用 `CompleteRead()`。

## 不直接返回业务数据的原因

`ReadIndex()` 建立一致性边界，不代替状态机读取业务数据。实际读取发生在：

1. `ReadIndex()` 回调成功之后。
2. 应用层从状态机或业务存储读取所需值。

## 在 `Raftor` 中的处理路径

`Raftor` 中只读请求的处理步骤：

1. 业务线程调用 `ReadIndex()`。
2. 请求进入线程安全的 `ReadIndexQueue`。
3. 事件循环线程调用 `ProposalTracker::TrackRead()` 跟踪该请求。
4. 事件循环线程调用 `raw_node_->ReadIndex(ctx)` 向 RAFT 层发起读索引请求。
5. 当 `Ready.read_states` 返回读索引结果后，`ReadyProcessor` 把它们加入 `pending_reads_`。
6. 当本地 `applied_index` 达到对应索引时，触发回调成功。

## 领导权变化的影响

`ReadyProcessor` 检测到节点失去领导权时：

- 将所有挂起提案以 `ProposalDropped` 结束。
- 将所有挂起读请求以 `LostLeadership` 结束。

客户端须将 `LostLeadership` 视为正常控制流。

## 接口示例

```cpp
raftor->ReadIndex("ctx", [](raftpp::Result<void> result) {
    if (!result) {
        return;
    }

    // 在这里读取业务状态
});
```

## 配置建议

- 无明确延迟优化需求时优先使用 `ReadOnlyOption::Safe`。
- 如果使用 `LeaseBased`，必须同时启用 `check_quorum`。
- `read_index_timeout` 与部署环境的网络和调度延迟相匹配。

## 相关文档

- [Raftor 使用](/guides/raftor/)
- [RaftorConfig](/reference/raftor-config/)
- [提案与错误模型](/reference/proposals-and-errors/)
