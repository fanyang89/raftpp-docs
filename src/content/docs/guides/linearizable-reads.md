---
title: 线性一致读
description: ReadIndex 路径、读一致性模式与完成条件说明。
---

`raftpp` 通过 `ReadIndex` 路径提供线性一致读支持。该路径不直接返回业务数据，而是为业务层建立一个可以安全读取的时刻。

## 两种模式

`ReadOnlyOption` 定义在 `include/raftpp/core/read_only.h` 中，提供两种模式：

- `Safe`
- `LeaseBased`

### `Safe`

通过法定多数确认读许可。该模式更保守，适合默认使用。

### `LeaseBased`

基于 leader lease 判定读许可，延迟更低，但前提更严格。

文档层面必须明确：`LeaseBased` 依赖 `check_quorum = true`。如果不满足这一前提，则无法正确建立基于 lease 的读语义。

## `ReadIndex()` 的语义

`Raftor::ReadIndex()` 的成功回调表示：

- RAFT 层已经确认该读取上下文对应的读索引；并且
- 本地状态机应用进度已经达到该读索引。

这一定义来自 `ReadyProcessor` 的完成逻辑：只有当 `applied_index >= read_state.index` 时，挂起的读请求才会调用 `CompleteRead()`。

## 不直接返回业务数据的原因

`ReadIndex()` 的职责是建立一致性边界，而不是代替状态机读取业务数据。实际读取通常发生在：

1. `ReadIndex()` 回调成功之后。
2. 应用层从状态机或业务存储读取所需值。

## 在 `Raftor` 中的处理路径

`Raftor` 中的只读请求大致经历以下步骤：

1. 业务线程调用 `ReadIndex()`。
2. 请求进入线程安全的 `ReadIndexQueue`。
3. 事件循环线程调用 `ProposalTracker::TrackRead()` 跟踪该请求。
4. 事件循环线程调用 `raw_node_->ReadIndex(ctx)` 向 RAFT 层发起读索引请求。
5. 当 `Ready.read_states` 返回读索引结果后，`ReadyProcessor` 把它们加入 `pending_reads_`。
6. 当本地 `applied_index` 达到对应索引时，触发回调成功。

## 领导权变化的影响

`ReadyProcessor` 在检测到当前节点失去领导权时，会：

- 将所有挂起提案以 `ProposalDropped` 结束。
- 将所有挂起读请求以 `LostLeadership` 结束。

因此，线性一致读的客户端需要把 `LostLeadership` 视为正常控制流的一部分。

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

- 如果没有明确的延迟优化需求，优先使用 `ReadOnlyOption::Safe`。
- 如果使用 `LeaseBased`，必须同时启用 `check_quorum`。
- `read_index_timeout` 应与部署环境的网络和调度延迟相匹配。

## 相关文档

- [Raftor 使用](/guides/raftor/)
- [RaftorConfig](/reference/raftor-config/)
- [提案与错误模型](/reference/proposals-and-errors/)
