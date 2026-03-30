---
title: RaftorConfig
description: raftpp::raftor::RaftorConfig 主要字段说明与推荐配置。
---

`RaftorConfig` 定义位于 `include/raftpp/raftor/raftor_config.h`，用于描述一个 `Raftor` 节点的运行参数。

## 基础字段

### `node_id`

- 当前节点 ID。
- 必须非零。
- 在同一集群内必须唯一。

### `listen_addr`

- 当前节点监听地址。
- 例如 `0.0.0.0:9000` 或 `127.0.0.1:9001`。

### `transport_kind`

- 当前仅提供 `TransportKind::Capnp`。

### `initial_peers`

- 首次引导集群时的初始成员列表。
- 多节点启动时应包含完整初始成员，并包含当前节点自己。
- 单节点引导时可以留空。
- 如果本地 WAL 已经存在，启动过程通常不会再依赖该字段重建集群状态。

### `data_dir`

- 节点数据目录。
- 用于保存 WAL、快照和其他持久化状态。

## 时钟与选举

### `election_tick`

- 选举超时 tick 数。
- 实际超时时间约等于 `election_tick * tick_interval`。

### `heartbeat_tick`

- leader 心跳间隔 tick 数。
- 实际间隔约等于 `heartbeat_tick * tick_interval`。

### `tick_interval`

- 每个 tick 的墙钟间隔。
- 默认值为 `100ms`。

配置说明：

- `election_tick` 应明显大于 `heartbeat_tick`。
- 网络稳定的小规模集群可直接使用默认值。
- 如果部署环境抖动较大，可适当增大 `tick_interval` 或 `election_tick`。

## 复制与流控

### `max_size_per_message`

- 单条复制消息允许携带的最大字节数。
- 默认 1MB。

### `max_inflight_messages`

- 每个 follower 允许同时在路上的 Append 消息数。
- 默认 256。

## 一致性相关

### `pre_vote`

- 建议保持为 `true`。
- 能降低网络分区节点恢复后对稳定 leader 的冲击。

### `check_quorum`

- 建议保持为 `true`。
- 对基于 leader lease 的线性一致读尤其重要。

### `read_only_option`

- `ReadOnlyOption::Safe`：通过法定多数确认读许可，更保守。
- `ReadOnlyOption::LeaseBased`：基于 leader lease，延迟更低，但更依赖时钟与 quorum 检查配置。

## 网络与请求超时

### `connect_timeout`

- 建立网络连接的超时时间。

### `proposal_timeout`

- 异步提案默认超时时间。
- 设为 `0` 表示禁用默认超时。

### `read_index_timeout`

- 异步读索引默认超时时间。
- 设为 `0` 表示禁用默认超时。

## 快照策略

### `snapshot_entries_threshold`

- 当 `applied_index - snapshot_index >= threshold` 时自动触发快照。
- 设为 `0` 表示禁用。

### `snapshot_log_size_bytes`

- 当 WAL 目录体积达到阈值时自动触发快照。
- 设为 `0` 表示禁用。

### `snapshot_interval`

- 按固定时间间隔触发自动快照。
- 设为 `0` 表示禁用。

实际配置时，通常只需启用一到两种自动快照条件，不建议同时将三个阈值设置得过于激进。

## 常见配置示例

### 单节点开发环境

```cpp
raftpp::raftor::RaftorConfig config;
config.node_id = 1;
config.listen_addr = "127.0.0.1:9001";
config.data_dir = "./node-1";
config.tick_interval = std::chrono::milliseconds{100};
```

### 三节点生产起步配置

```cpp
raftpp::raftor::RaftorConfig config;
config.node_id = 1;
config.listen_addr = "10.0.0.1:9000";
config.data_dir = "/var/lib/raftpp/node-1";
config.initial_peers = {
    {1, "10.0.0.1:9000"},
    {2, "10.0.0.2:9000"},
    {3, "10.0.0.3:9000"},
};
config.pre_vote = true;
config.check_quorum = true;
config.read_only_option = raftpp::ReadOnlyOption::Safe;
config.snapshot_entries_threshold = 10000;
```

## 校验

创建节点前，建议显式执行：

```cpp
auto validation = config.Validate();
if (!validation) {
    // 处理非法配置
}
```

如无明确约束，可先使用默认值，再根据网络延迟、日志吞吐和快照成本逐步调整。
