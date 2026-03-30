---
title: 快速开始
description: 从构建仓库到运行最小节点的入门步骤。
---

本文说明 `raftpp` 的基本构建方式，以及最小接入流程所需的核心接口。

## 环境要求

- C++17 编译器
- CMake 3.28+
- Ninja
- Linux 或 macOS 开发环境

## 常用命令

以下命令在仓库根目录执行：

```bash
task cmake
task build
task test
task fmt
```

说明：

- `task cmake`：使用 `Debug` preset 配置工程。
- `task build`：构建测试目标。
- `task test`：运行单元测试与数据驱动测试。
- `task fmt`：通过仓库提供的容器化 `clang-format` 统一格式化代码。

## 可选构建参数

```bash
cmake --preset=Debug -B build -DRAFTPP_SANITIZE=address
cmake --preset=Debug -B build -DRAFTPP_SANITIZE=thread
cmake --preset=Debug -B build -DRAFTPP_WITH_LIBURING=ON
```

- `RAFTPP_SANITIZE=address`：启用 AddressSanitizer。
- `RAFTPP_SANITIZE=thread`：启用 ThreadSanitizer。
- `RAFTPP_WITH_LIBURING=ON`：在 Linux 上启用 `io_uring` 支持，要求系统已提供 `liburing`。

## 最小集成步骤

最小接入流程可分为三个步骤：

1. 实现一个 `StateMachine`。
2. 构造 `RaftorConfig` 并创建 `Raftor`。
3. 启动事件循环并提交提案。

### 1. 实现状态机

`StateMachine` 是业务状态与 RAFT 复制层之间的边界。最小实现需要覆盖：

- `Apply()`：应用已提交日志。
- `TakeSnapshot()`：导出快照。
- `RestoreSnapshot()`：从快照恢复。

仓库里的最小示例位于 `examples/minimal_node/main.cc`。

### 2. 配置并创建 `Raftor`

```cpp
#include <chrono>

#include "raftpp/raftor/raftor.h"

using namespace std::chrono_literals;

raftpp::raftor::RaftorConfig config;
config.node_id = 1;
config.listen_addr = "127.0.0.1:9001";
config.data_dir = "./minimal-node-data";
config.tick_interval = 100ms;

auto result = raftpp::raftor::Raftor::Create(config, std::make_unique<MyStateMachine>());
```

单节点引导时，`initial_peers` 保持为空即可，`Raftor` 会把本节点作为唯一投票节点启动。

多节点首次引导时，`initial_peers` 应包含完整初始成员列表，并且需要包含当前节点自己。

### 3. 启动并轮询

```cpp
if (auto result = raftor->Start(); !result) {
    return 1;
}

for (int i = 0; i < 20; ++i) {
    raftor->Poll(config.tick_interval);
}

raftor->Stop();
```

如果需要阻塞式事件循环，可以调用 `Run()`；如果需要嵌入现有事件循环，则使用 `Start()` + `Poll()`。

## 提交提案

```cpp
raftor->Propose("my-data", [](raftpp::Result<std::string> result) {
    if (result) {
        // result 中是状态机 Apply() 返回的响应数据
    }
});

auto sync_result = raftor->ProposeSync("my-data");
auto future = raftor->ProposeAsync("my-data");
```

## 发起线性一致读

```cpp
raftor->ReadIndex("read-ctx", [](raftpp::Result<void> result) {
    if (result) {
        // 现在可以安全地从状态机读取线性一致数据
    }
});
```

`ReadIndex()` 只负责建立线性一致读许可，不直接返回业务数据。实际读取仍由应用层完成。

## 运行示例程序

仓库内置两个示例目标：

```bash
cmake --build build --target minimal-node-example kvstore-example
```

- `minimal-node-example`：最小单节点示例。
- `kvstore-example`：带 HTTP 接口的分布式 KV 示例。

首次验证接入流程时，可优先构建并运行 `minimal-node-example`。
