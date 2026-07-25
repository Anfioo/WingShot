import { defineConfig } from "@rsbuild/core";
import { pluginNodePolyfill } from "@rsbuild/plugin-node-polyfill";
import { pluginReact } from "@rsbuild/plugin-react";
import { tanstackRouter } from "@tanstack/router-plugin/rspack";

export default defineConfig(({ command }) => ({
	plugins: [pluginReact(), pluginNodePolyfill()],
	resolve: {
		alias: {
			"@": "./src",
		},
	},
	output: {
		cleanDistPath: true,
	},
	performance: {
		chunkSplit: {
			// Pixi 在模块顶层注册全局 extension handler。
			// dev + HMR + split-by-module 可能重复执行 Pixi 子模块，触发
			// "Extension type application already has a handler"。
			strategy: command === "dev" ? "all-in-one" : "split-by-module",
		},
	},
	html: {
		tags: [
			{
				tag: "script",
				attrs: {
					src:
						import.meta.env.PUBLIC_ONLINE_STATUS === "true"
							? "/scripts/excalidraw.js"
							: "/scripts/excalidraw.offline.js",
				},
			},
			{
				tag: "script",
				attrs: {
					src: "/scripts/markdownItFix.js",
				},
			},
		],
	},
	tools: {
		swc: {
			jsc: {
				experimental: {
					plugins: [["@swc/plugin-styled-jsx", {}]],
				},
			},
		},
		rspack: {
			plugins: [
				tanstackRouter({
					target: "react",
					autoCodeSplitting: true,
				}),
			],
			optimization: {},
		},
	},
}));
