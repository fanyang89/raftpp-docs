// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightThemeNext from 'starlight-theme-next';

// https://astro.build/config
export default defineConfig({
	site: 'https://raftpp.cc',
	base: '/',
	integrations: [
		starlight({
			plugins: [starlightThemeNext()],
			title: 'raftpp 文档',
			description: 'raftpp 的中文使用文档与架构说明。',
			social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/fanyang89/raftpp' }],
			sidebar: [
				{
					label: '入门',
					items: [
						{ label: '项目概览', slug: 'overview' },
						{ label: '快速开始', slug: 'getting-started' },
					],
				},
				{
					label: '指南',
					items: [
						{ label: '集群引导与恢复', slug: 'guides/bootstrap-and-recovery' },
						{ label: '状态机开发', slug: 'guides/state-machine' },
						{ label: 'Raftor 使用', slug: 'guides/raftor' },
						{ label: 'RawNode Ready 流程', slug: 'guides/raw-node-ready-flow' },
						{ label: '线性一致读', slug: 'guides/linearizable-reads' },
						{ label: '成员变更', slug: 'guides/membership-changes' },
						{ label: '快照与日志压缩', slug: 'guides/snapshots-and-compaction' },
					],
				},
				{
					label: '参考',
					items: [
						{ label: 'RaftorConfig', slug: 'reference/raftor-config' },
						{ label: 'RawNode', slug: 'reference/raw-node' },
						{ label: 'Storage', slug: 'reference/storage' },
						{ label: 'WAL', slug: 'reference/wal' },
						{ label: 'RPC Transport', slug: 'reference/rpc-transport' },
						{ label: '复制流控', slug: 'reference/replication-flow-control' },
						{ label: '提案与错误模型', slug: 'reference/proposals-and-errors' },
					],
				},
				{
					label: '示例',
					items: [
						{ label: 'minimal_node', slug: 'examples/minimal-node' },
						{ label: 'kvstore', slug: 'examples/kvstore' },
					],
				},
				{
					label: '其他',
					items: [{ label: 'FAQ', slug: 'faq' }],
				},
			],
		}),
	],
});
