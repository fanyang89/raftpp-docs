---
title: kvstore
description: 带 HTTP 接口的分布式键值存储示例。
---

`examples/kvstore/` 展示了如何基于 `Raftor` 构建一个具备 HTTP 接口的应用示例。

## 示例包含哪些部分

- `main.cc`：解析参数、构造配置、启动 `Raftor` 和 HTTP 服务。
- `kv_store_state_machine.*`：KV 状态机实现。
- `http_server.*`：对外暴露 HTTP 接口。
- `cli.cc`：简单命令行客户端。
- `cli_options.*`：解析 `kvstore-cli` 参数。

## 构建目标

- `kvstore-example`
- `kvstore-cli`

## 构建

```bash
task cmake
cmake --build build --target kvstore-example kvstore-cli
```

## 启动参数

示例程序支持以下主要参数：

- `--node-id <id>`：节点 ID。
- `--port <port>`：HTTP 服务端口。
- `--raft-port <port>`：RAFT 传输端口。
- `--peers <list>`：初始节点列表，格式如 `1:localhost:9000,2:localhost:9001,3:localhost:9002`。
- `--data-dir <dir>`：数据目录。
- `--help`：显示帮助。

首次启动多节点集群时，`--peers` 需要包含完整初始节点列表，并且包含当前节点自己。已有 WAL 数据后，启动会优先使用 WAL 中的配置和地址簿。

## 三节点启动示例

```bash
./build/examples/kvstore/kvstore-example \
  --node-id 1 \
  --port 8081 \
  --raft-port 9001 \
  --peers 1:127.0.0.1:9001,2:127.0.0.1:9002,3:127.0.0.1:9003 \
  --data-dir ./kv-node-1
```

其余两个节点只需要替换 `node-id`、端口和数据目录。

## HTTP 接口

示例 HTTP 服务提供以下接口：

- `PUT /kv`：请求体为 `{"key":"k","value":"v"}`，通过 `ProposeAsync()` 提交写入。
- `GET /kv/<key>`：仅 leader 处理；先调用 `ReadIndexSync()` 建立线性一致读许可，再从本地状态机读取。
- `DELETE /kv/<key>`：通过 `ProposeAsync()` 提交删除。
- `GET /leader`：返回当前 leader 信息。
- `GET /health`：返回 term、commit index 和 applied index 等状态。

`GET /kv/<key>` 如果请求到非 leader 节点，会返回 `503` 和当前已知 `leader_id`。

## CLI 用法

构建 `kvstore-cli` 后可以执行：

```bash
./build/examples/kvstore/kvstore-cli put foo bar --node localhost:8081
./build/examples/kvstore/kvstore-cli get foo --node localhost:8081
./build/examples/kvstore/kvstore-cli del foo --node localhost:8081
./build/examples/kvstore/kvstore-cli leader --node localhost:8081
./build/examples/kvstore/kvstore-cli health --node localhost:8081 --json
```

也可以用 `--peers` 提供多个 HTTP 地址，CLI 会按顺序尝试：

```bash
./build/examples/kvstore/kvstore-cli get foo \
  --peers "localhost:8081,localhost:8082,localhost:8083"
```

## 示例覆盖内容

- 如何把 `Raftor` 嵌入一个长期运行的服务进程。
- 如何把业务命令编码成日志并在状态机中解析。
- 如何在应用层区分“复制提交成功”和“本地读请求已线性一致”。
- 如何用快照流式保存和恢复 `std::map<std::string, std::string>`。

## 阅读顺序

建议按以下顺序阅读：

1. `main.cc`
2. `kv_store_state_machine.h/.cc`
3. `http_server.h/.cc`
4. `cli.cc`

该顺序有助于先理解进程装配，再阅读状态机实现和外围接口。
