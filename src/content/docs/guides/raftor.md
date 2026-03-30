---
title: Raftor 使用
description: 高层编排 API 的生命周期、提案、读索引与成员管理说明。
---

`Raftor` 是 `raftpp` 的高层运行时入口，接口定义位于 `include/raftpp/raftor/raftor.h`。

对于不需要自行处理 `Ready` 持久化顺序、消息发送和应用回调的场景，应优先使用该接口。

## 创建实例

`Raftor` 提供两个工厂方法：

```cpp
auto raftor = raftpp::raftor::Raftor::Create(config, std::move(state_machine));
auto raftor = raftpp::raftor::Raftor::Create(
    config,
    std::move(state_machine),
    storage,
    std::move(transport)
);
```

- 第一种：使用默认 WAL 存储和默认传输实现。
- 第二种：注入自定义存储和传输，适用于测试或定制化集成场景。

## 生命周期

### `Start()`

初始化运行时，开始接收连接，但不阻塞当前线程。

### `Run()`

进入阻塞式事件循环，直到 `Stop()` 被调用。

### `Poll(timeout)`

手动驱动一次事件循环，适合嵌入已有 reactor、game loop 或调度框架。

### `Stop()`

优雅停止节点。未完成的提案与读请求会以关闭错误结束。

## 线程模型

`Raftor` 内部采用单线程事件循环模型，但以下接口可以从任意线程安全调用：

- `Propose()`
- `ProposeSync()`
- `ProposeAsync()`
- `ReadIndex()`
- `ReadIndexSync()`

这意味着业务线程可以将请求投递到 RAFT 事件循环线程，而无需额外实现同步协议。

## 提案接口

### 异步回调

```cpp
raftor->Propose("payload", [](raftpp::Result<std::string> result) {
    if (!result) {
        return;
    }
});
```

### 同步阻塞

```cpp
auto result = raftor->ProposeSync("payload", std::chrono::milliseconds{5000});
```

### Future 风格

```cpp
auto future = raftor->ProposeAsync("payload");
auto result = future.get();
```

返回值来自状态机 `Apply()` 的 `ApplyResult.response`。

## 线性一致读

`ReadIndex()` 用来确认当前读取可以满足线性一致性要求。

```cpp
raftor->ReadIndex("ctx", [](raftpp::Result<void> result) {
    if (result) {
        // 在这里读取状态机中的业务状态
    }
});
```

说明：

- `ReadIndex()` 不直接返回业务数据。
- 你的应用需要在读许可建立后，自行从状态机或业务存储中取值。
- `RaftorConfig.read_only_option` 会影响该路径采用的算法。

## 集群成员管理

### `AddNode(id, addr)`

提交一个配置变更提案，把新节点加入集群。

### `RemoveNode(id)`

提交一个配置变更提案，把指定节点移出集群。

### `TransferLeader(target_id)`

发起领导权转移。这是 best-effort 操作；如果目标节点未追平或不可达，转移可能失败。

### `Campaign()`

主动触发当前节点发起选举，主要用于测试或人工干预。

## 状态查询

`NodeStatus` 提供以下观测字段：

- `id`
- `role`
- `term`
- `leader_id`
- `commit_index`
- `applied_index`
- `pending_proposals`

常用接口：

- `GetStatus()`
- `IsLeader()`
- `GetLeaderId()`
- `IsRunning()`

## 快照

`TakeSnapshot()` 会主动触发一次快照流程。

在长期运行场景中，通常通过 `RaftorConfig` 中的快照阈值进行自动触发。

## 何时直接使用 `RawNode`

在以下场景中，可以考虑直接使用 `RawNode`：

- 必须自己控制 Ready 持久化与发送顺序。
- 已经有一套现成的传输和存储框架，且不想适配到 `Raftor` 约定。
- 需要对复制流程、批处理或推进时机做精细调优。

除上述场景外，`Raftor` 通常可以满足集成需求。
