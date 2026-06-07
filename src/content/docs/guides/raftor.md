---
title: Raftor 使用
description: 高层编排 API 的生命周期、提案、读索引与成员管理说明。
---

`Raftor` 是 `raftpp` 的高层运行时入口，接口定义位于 `include/raftpp/raftor/raftor.h`。

不需要自行处理 `Ready` 持久化顺序、消息发送和应用回调时，优先使用该接口。

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
- 第二种：注入自定义 `WritableStorage` 和传输，适用于测试或定制化集成场景。

默认传输由 `RaftorConfig.transport_kind` 决定：`Capnp` 打开网络监听，`Noop` 不打开 socket，仅适合无远端 peer 的单节点或测试。

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

`Raftor` 内部是单线程事件循环，以下接口线程安全：

- `Propose()`
- `ProposeSync()`
- `ProposeAsync()`
- `ReadIndex()`
- `ReadIndexSync()`

业务线程可直接投递请求到 RAFT 事件循环，无需额外同步协议。

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

- `ReadIndex()` 不直接返回业务数据。
- 读许可建立后，应用自行从状态机或业务存储中取值。
- `RaftorConfig.read_only_option` 决定该路径采用的算法。

## 集群成员管理

### `AddNode(id, addr)`

提交一个配置变更提案，把新节点加入集群。

### `RemoveNode(id)`

提交一个配置变更提案，把指定节点移出集群。

### `UpdateNodeAddress(id, addr)`

提交一个内部 metadata 日志来更新已有成员的传输地址。该成员必须已经存在于当前 `ConfState` 中。

地址更新应用后同步更新 WAL 地址簿和传输层 peer。节点重启后，默认 WAL 从地址簿恢复 peer 地址。

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

长期运行场景通常通过 `RaftorConfig` 快照阈值自动触发。

节点启动时，如果存储中存在本地快照，`Raftor::Create()` 先恢复到状态机，再以快照 index 作为 `RawNode` 的初始 applied index。

## 数据完整性

`config.enable_entry_checksum = true` 时，Raftor 校验提案 entry 的 checksum。发现 `ChecksumMismatch` 进入 terminal state，节点停止运行，后续 `Start()`、提案和读请求均返回该错误。

默认关闭，用于兼容旧 WAL 和滚动升级。

## 何时直接使用 `RawNode`

以下场景直接使用 `RawNode`：

- 必须自己控制 Ready 持久化与发送顺序。
- 已经有一套现成的传输和存储框架，且不想适配到 `Raftor` 约定。
- 需要对复制流程、批处理或推进时机做精细调优。


