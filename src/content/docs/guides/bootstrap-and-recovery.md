---
title: 集群引导与恢复
description: 首次部署、节点重启以及 WAL 初始化状态对启动行为的影响。
---

`Raftor::Create()` 在不同存储状态下的启动语义，以及单节点、多节点和重启场景的配置要求。

## 启动路径

默认工厂先创建 `WALStorage`，再根据 WAL 是否包含集群配置决定启动路径。自定义工厂传入的 `WritableStorage` 也走同样的 bootstrap 判断。

### WAL 未初始化

如果 `WALStorage::IsInitialized()` 返回 `false`，执行引导流程：

- 当 `initial_peers` 为空时，写入仅包含当前节点的 `ConfState`。
- 当 `initial_peers` 非空时，写入完整的初始投票成员集合。

### WAL 已初始化

如果 WAL 已有有效 `ConfState`，启动时直接使用 WAL 中的配置，忽略 `initial_peers`。

- `initial_peers` 只在首次引导时生效。
- 节点重启后，不应依赖修改 `initial_peers` 来变更集群拓扑。
- 默认 WAL 从持久化的 peer address book 恢复对等节点地址。

### 本地快照恢复

`Raftor::Create()` 在创建 `RawNode` 前调用 `storage.LocalSnapshot()`：

- 如果存在本地快照，先调用状态机 `RestoreSnapshot()` 恢复业务状态。
- 然后把快照 index 作为初始 applied index 传给 `RawNode`。
- 如果不存在本地快照，则从 applied index `0` 启动。

## 单节点引导

单节点场景留空 `initial_peers`：

```cpp
raftpp::raftor::RaftorConfig config;
config.node_id = 1;
config.listen_addr = "127.0.0.1:9001";
config.data_dir = "./node-1";
```

`Raftor::Create()` 把当前节点写入 `ConfState.voters`，作为唯一投票节点启动。

## 多节点首次部署

多节点首次部署时，`initial_peers` 须满足：

- 每个节点看到的成员集合必须一致。
- 成员集合必须包含当前节点自己。
- 每个节点的 `node_id` 必须在该集合中唯一。

如果当前节点的 `node_id` 不在 `initial_peers` 中，`Create()` 会返回 `NodeIdNotInInitialPeers`。

示例：

```cpp
config.initial_peers = {
    {1, "10.0.0.1:9000"},
    {2, "10.0.0.2:9000"},
    {3, "10.0.0.3:9000"},
};
```

## 节点重启

节点重启时保持以下信息稳定：

- `node_id`
- `data_dir`
- 对外监听地址和对等节点地址映射

`data_dir` 尤其关键。`raftpp` 默认把 WAL 放在 `data_dir / "wal"` 下；切换到新的数据目录会被视为未初始化节点。

peer 地址变化应在运行期调用 `UpdateNodeAddress(id, addr)` 提交；只修改重启参数不会更新 WAL 中的地址簿。

## 与成员变更的关系

运行中的成员变更通过配置变更日志完成，不是修改 `initial_peers`：

- `initial_peers` 只参与首次引导。
- 重启后集群配置以 WAL 为准。
- 运行期修改成员需要遵守 RAFT 配置变更语义。

## 地址与节点 ID 约束

- `node_id` 长期稳定。
- 同一 `node_id` 不复用于其他节点实例。
- `listen_addr` 应与节点实际对外服务地址一致。
- `AddNode(id, addr)` 中的 `addr` 会随配置变更日志一起提交，并在日志应用后写入地址簿和加入传输层。
- `UpdateNodeAddress(id, addr)` 只适用于当前配置中已经存在的节点。

## 推荐部署流程

### 单节点

1. 固定 `node_id` 和 `data_dir`。
2. 留空 `initial_peers`。
3. 启动节点并等待成为 leader。

### 多节点首次部署

1. 为每个节点分配唯一 `node_id`。
2. 在所有节点上写入一致的 `initial_peers` 列表。
3. 保证每个节点的 `data_dir` 初始为空或未初始化。
4. 启动节点。

### 重启

1. 保持 `node_id` 不变。
2. 继续使用原有 `data_dir`。
3. 不依赖 `initial_peers` 重新定义成员关系。

## 相关文档

- [成员变更](/guides/membership-changes/)
- [快照与日志压缩](/guides/snapshots-and-compaction/)
- [WAL](/reference/wal/)
