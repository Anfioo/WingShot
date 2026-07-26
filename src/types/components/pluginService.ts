import * as path from "@tauri-apps/api/path";
import { appError } from "@/utils/log";
import type { PluginStatusResult } from "../commands/plugin";

export type PluginItem = {
	id: string;
	file_list: string[];
};

export type PluginDownloadSource = {
	id: string;
	name: string;
	urlTemplate: string;
	enabled: boolean;
};

export const PLUGIN_RESOURCE_VERSION = "20251005";

export const defaultPluginDownloadSources: PluginDownloadSource[] = [
	{
		id: "snowshot-default",
		name: "SnowShot",
		urlTemplate:
			"https://snowshot.top/plugins/{version}/{platform}/{plugin}.zip",
		enabled: true,
	},
	{
		id: "wingshot-default",
		name: "WingShot",
		urlTemplate:
			"https://wingshot.anfioo.com/plugins/{version}/{platform}/{plugin}.zip",
		enabled: true,
	},
	{
		id: "github-default",
		name: "GitHub Releases",
		urlTemplate:
			"https://github.com/Anfioo/WingShot/releases/download/Resources_20260725/{plugin}.zip",
		enabled: true,
	},
];

export const createPluginDownloadSourceId = () =>
	`plugin-source@${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export const normalizePluginDownloadSources = (
	sources: unknown,
	fallbackSources: PluginDownloadSource[] = defaultPluginDownloadSources,
): PluginDownloadSource[] => {
	const sourceList = Array.isArray(sources) ? sources : [];
	const usedIds = new Set<string>();
	const result = sourceList
		.map((item) => {
			if (!item || typeof item !== "object") {
				return undefined;
			}

			const data = item as Partial<PluginDownloadSource>;
			const urlTemplate =
				typeof data.urlTemplate === "string" ? data.urlTemplate.trim() : "";
			if (!urlTemplate) {
				return undefined;
			}

			let id = typeof data.id === "string" ? data.id.trim() : "";
			if (!id || usedIds.has(id)) {
				id = createPluginDownloadSourceId();
			}
			usedIds.add(id);

			return {
				id,
				name:
					typeof data.name === "string" && data.name.trim()
						? data.name.trim()
						: "Plugin Source",
				urlTemplate,
				enabled: typeof data.enabled === "boolean" ? data.enabled : true,
			};
		})
		.filter((item): item is PluginDownloadSource => Boolean(item));

	if (result.length > 0) {
		return result;
	}

	return fallbackSources.map((item) => ({ ...item }));
};

export const getPluginDownloadUrlTemplates = (
	sources: PluginDownloadSource[],
): string[] =>
	normalizePluginDownloadSources(sources)
		.filter((source) => source.enabled)
		.map((source) => source.urlTemplate);

export class PluginConfig {
	plugins: Map<string, PluginItem> = new Map();
	version: string = "";
	plugin_install_dir: string = "";
	plugin_download_dir: string = "";
	plugin_download_sources: PluginDownloadSource[] = [];

	constructor(
		plugins: PluginItem[],
		version: string,
		plugin_install_dir: string,
		plugin_download_dir: string,
		plugin_download_sources: PluginDownloadSource[],
	) {
		this.plugins = new Map(plugins.map((plugin) => [plugin.id, plugin]));
		this.version = version;
		this.plugin_install_dir = plugin_install_dir;
		this.plugin_download_dir = plugin_download_dir;
		this.plugin_download_sources = normalizePluginDownloadSources(
			plugin_download_sources,
		);
	}

	getPluginDownloadUrlTemplates() {
		return getPluginDownloadUrlTemplates(this.plugin_download_sources);
	}

	async getPluginDirPath(name: string) {
		const pluginId = this.plugins.get(name)?.id ?? "";
		if (pluginId === "") {
			appError("[PluginConfig::getPluginDirPath] pluginId is empty");
		}

		return await path.join(
			this.plugin_install_dir,
			this.version,
			this.plugins.get(name)?.id ?? "",
		);
	}
}

export type PluginStatusRecord = Record<string, PluginStatusResult>;
