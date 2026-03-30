---
title: 项目概览
description: raftpp 的定位、核心能力与主要组件关系。
---

`raftpp` 是一个以现代 C++ 实现的 RAFT 共识库。仓库当前实际构建标准为 `C++17`，并使用 CMake + Ninja 作为主要构建方式。

## 核心特性

- 完整的 RAFT 状态机实现：选主、日志复制、成员变更、快照。
- 支持 `pre_vote`，减少网络分区节点恢复时对集群的干扰。
- 支持 Joint Consensus，用于安全的成员增删。
- 支持线性一致读，包含 `Safe` 和 `LeaseBased` 两种模式。
- 存储可插拔，内置内存存储与 WAL 存储实现。
- 传输可插拔，默认提供 Cap'n Proto RPC。
- 集成 OpenTelemetry 观测能力。

## 组件分层

### Core 层

位于 `include/raftpp/core/`，负责纯 RAFT 状态机逻辑。

- `Raft`：核心状态机，处理角色切换和消息分发。
- `RawNode`：对外暴露的底层驱动接口。
- `RaftLog`：统一管理稳定存储与 `Unstable` 日志。
- `ProgressTracker`：维护副本复制进度和法定人数判断。
- 配置变更与只读路径：`ConfChanger`、`ReadOnly` 等。

### Raftor 层

位于 `include/raftpp/raftor/`，负责将底层状态机组织为可直接集成的运行时组件。

- 统一生命周期：`Create()`、`Start()`、`Run()`、`Stop()`。
- 线程安全的提案与读接口。
- Ready 处理流程编排。
- 状态机回调、快照读写、超时控制。
- WAL 与 RPC 的默认集成。

## 适用场景

- 在 C++ 服务中嵌入可控的 RAFT 复制层。
- 对状态机、存储布局或网络边界有明确控制需求。
- 同时需要高层接入接口和底层扩展能力。

## 两种接入方式

### 使用 `Raftor`

- 特点：提供统一生命周期、线程安全的提案与读接口，以及默认 WAL 和 RPC 集成。
- 适用：大多数业务系统和服务框架。

### 使用 `RawNode`

适合对 Ready 流程、持久化顺序和传输层有完全控制需求的场景。

- 特点：控制粒度更细。
- 代价：需要自行处理持久化、消息发送和已提交日志应用流程。

## 仓库结构

```text
include/raftpp/core/      RAFT 核心接口与类型
include/raftpp/raftor/    高层编排接口
lib/core/                 Core 层实现
lib/raftor/               Raftor、WAL、RPC 实现
examples/minimal_node/    最小可运行示例
examples/kvstore/         分布式 KV 示例
tests/                    单元测试与数据驱动测试
```

## 相关文档

- [快速开始](/getting-started/)
- [状态机开发](/guides/state-machine/)
- [RawNode 参考](/reference/raw-node/)
