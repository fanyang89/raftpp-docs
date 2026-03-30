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

## 示例覆盖内容

- 如何把 `Raftor` 嵌入一个长期运行的服务进程。
- 如何把业务命令编码成日志并在状态机中解析。
- 如何在应用层区分“复制提交成功”和“本地读请求已线性一致”。

## 阅读顺序

建议按以下顺序阅读：

1. `main.cc`
2. `kv_store_state_machine.h/.cc`
3. `http_server.h/.cc`
4. `cli.cc`

该顺序有助于先理解进程装配，再阅读状态机实现和外围接口。
