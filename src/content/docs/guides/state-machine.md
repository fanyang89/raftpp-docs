---
title: 状态机开发
description: 如何实现 raftpp::raftor::StateMachine 并与业务逻辑对接。
---

`raftpp::raftor::StateMachine` 是业务代码与 RAFT 复制层的核心边界。所有已提交日志最终都会以 `Entry` 的形式进入状态机。

接口定义位于 `include/raftpp/raftor/state_machine.h`。

## 接口要求

### `Apply(const Entry& entry)`

把已提交日志应用到业务状态。

- 调用顺序与提交顺序一致。
- 输入可能是普通数据日志、配置变更日志，或者 leader 当选后产生的空日志。
- 返回值中的 `ApplyResult.response` 会回传给提案方。
- Raftor 会自行处理配置变更和内部 metadata entry；业务状态机可能收到配置变更 entry，但不要将其当作普通业务命令处理。

典型处理步骤：

1. 从 `entry.data` 反序列化业务命令。
2. 修改内存状态或落盘状态。
3. 返回业务执行结果。

```cpp
raftpp::Result<raftpp::raftor::ApplyResult> Apply(const raftpp::Entry& entry) override {
    (void)entry;
    return raftpp::raftor::ApplyResult{.response = "ok"};
}
```

### `TakeSnapshot(...)`

把当前状态机状态导出为快照。

- 快照应覆盖到 `applied_index` 对应的状态。
- 快照元信息中必须正确写入 `index`、`term` 和 `conf_state`。
- 业务负载通过 `SnapshotWriter` 以流式方式写出。

```cpp
raftpp::Result<raftpp::SnapshotMetadata> TakeSnapshot(
    uint64_t applied_index,
    uint64_t applied_term,
    const raftpp::ConfState& conf_state,
    raftpp::raftor::SnapshotWriter& writer
) override {
    // 将你的业务状态序列化后写入 writer
}
```

- 使用自描述格式，例如 JSON、Cap'n Proto、protobuf 或带版本号的自定义二进制格式。
- 快照内容应包含版本字段，便于后续演进状态格式。

### `RestoreSnapshot(...)`

从 leader 下发的快照恢复本地状态。

- 这是一次完整替换，而不是增量合并。
- 恢复完成后，本地业务状态应与快照描述完全一致。
- `reader.Read()` 返回 `0` 表示 EOF。

```cpp
raftpp::Result<void> RestoreSnapshot(
    const raftpp::SnapshotMetadata& metadata,
    raftpp::raftor::SnapshotReader& reader
) override {
    (void)metadata;
    return {};
}
```

## 可选回调

### `OnLeadershipChange(bool is_leader, uint64_t term, uint64_t leader_id)`

- 启停 leader 专属后台任务。
- 上报监控指标。
- 通知外围系统主从角色变化。

### `OnPeerUnreachable(uint64_t peer_id)`

- 记录告警或诊断日志。
- 更新面板上的节点可达性状态。

## 设计注意事项

### 让 `Apply()` 幂等或可恢复

状态机实现应避免异常恢复演变为数据损坏。

### 不要在 `Apply()` 中做长时间阻塞操作

`Apply()` 处于已提交日志的应用主路径上，过重的 I/O 或外部 RPC 会直接拖慢复制延迟。

### 明确日志格式边界

业务层应定义清晰的命令模型，例如：

- `put key value`
- `delete key`
- `transfer account`

不要长期把随意拼接的字符串作为协议。

### 快照要能独立恢复

快照不是缓存，必须可作为完整恢复点使用，不依赖快照之外的隐含状态。

节点重启时，Raftor 会优先用本地快照恢复状态机，再从对应 applied index 继续驱动 RAFT。

## 参考实现

- 最小状态机：`examples/minimal_node/main.cc`
- KV 示例状态机：`examples/kvstore/kv_store_state_machine.h`

进一步说明见[Raftor 使用](/guides/raftor/)。
