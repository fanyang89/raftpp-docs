---
title: RPC Transport
description: 传输层抽象、编解码协议与 Peer 管理说明。
---

RPC 传输层位于 `include/raftpp/raftor/rpc/`，负责节点间消息发送、连接维护和编解码。

## `Transport` 抽象

`Transport` 提供以下核心接口：

- `Start()`
- `Stop()`
- `AddPeer(id, addr)`
- `RemovePeer(id)`
- `Send(messages)`
- `SetMessageCallback(cb)`
- `SetErrorCallback(cb)`
- `Poll(timeout)`
- `Run()`

## 回调线程模型

`transport.h` 明确规定：

- `MessageCallback`
- `ErrorCallback`

都只会在调用 `Transport::Poll()` 或 `Transport::Run()` 的线程上触发。

因此，回调逻辑应视为运行在传输事件循环线程上。

## `Send()` 语义

`Send(nonstd::span<const Message>)` 根据消息的 `to` 字段路由。

对于未知 peer，接口定义明确说明：消息会被静默丢弃。

## `Codec`

`Codec` 用于普通消息帧，格式为：

- 4 字节 magic：`RAPF`
- 4 字节 header length
- Cap'n Proto `RpcHeader`
- Cap'n Proto payload

关键常量：

- `kMagic = 0x52415046`
- `kVersion = 1`
- `kDefaultMaxMessageSize = 64MB`

## `HandshakeCodec`

握手帧使用独立编码器，magic 为 `RAPH`，用于连接建立阶段的协商。

## `PeerManager`

`PeerManager` 维护 peer 的连接状态和重连节奏。每个 peer 记录以下信息：

- `id`
- `addr`
- `state`
- `last_activity`
- `failure_count`
- `reconnect_after`

连接状态包含：

- `Disconnected`
- `Connecting`
- `Connected`

当连接失败时，`PeerManager` 会记录失败次数，并基于指数退避安排下一次重连时间。

## 配置项

`TransportConfig` 的主要字段包括：

- `listen_addr`
- `node_id`
- `max_message_size`
- `connect_timeout`
- `reconnect_interval`

## 文档中应明确的事项

- 回调线程与调用 `Poll()` / `Run()` 的线程一致。
- 未知 peer 的消息会被丢弃。
- callback 必须在 `Start()` 前设置，且不能与 `Poll()` / `Run()` 并发修改。

## 相关文档

- [Raftor 使用](/guides/raftor/)
- [提案与错误模型](/reference/proposals-and-errors/)
- [WAL](/reference/wal/)
