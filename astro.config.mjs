// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
	site: 'https://raftpp.cc',
	base: '/',
	integrations: [
		starlight({
			title: 'raftpp 文档',
			description: 'raftpp 的中文使用文档与架构说明。',
			components: {
				Sidebar: 'starlight-theme-obsidian/overrides/Sidebar.astro',
				PageFrame: 'starlight-theme-obsidian/overrides/PageFrame.astro',
				PageSidebar: './src/components/PageSidebar.astro',
				Pagination: 'starlight-theme-obsidian/overrides/Pagination.astro',
				ThemeSelect: 'starlight-theme-obsidian/overrides/ThemeSelect.astro',
			},
			customCss: [
				'starlight-theme-obsidian/styles/layers.css',
				'starlight-theme-obsidian/styles/theme.css',
				'starlight-theme-obsidian/styles/centered-reading.css',
				'starlight-theme-obsidian/styles/common.css',
			],
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
						{ label: '状态机开发', slug: 'guides/state-machine' },
						{ label: 'Raftor 使用', slug: 'guides/raftor' },
					],
				},
				{
					label: '参考',
					items: [
						{ label: 'RaftorConfig', slug: 'reference/raftor-config' },
						{ label: 'RawNode', slug: 'reference/raw-node' },
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
