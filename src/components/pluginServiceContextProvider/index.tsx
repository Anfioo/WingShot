import { isDeepEqualReact } from "@ant-design/pro-components";
import * as path from "@tauri-apps/api/path";
import { throttle } from "es-toolkit";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { textFileRead } from "@/commands/file";
import {
	pluginGetPluginsStatus,
	pluginInit,
	pluginRegisterPlugin,
} from "@/commands/plugin";
import {
	PLUGIN_ID_AI_CHAT,
	PLUGIN_ID_FFMPEG,
	PLUGIN_ID_RAPID_OCR,
	PLUGIN_ID_TRANSLATE,
} from "@/constants/pluginService";
import { PluginServiceContext } from "@/contexts/pluginServiceContext";
import { useStateRef } from "@/hooks/useStateRef";
import { AppSettingsGroup } from "@/types/appSettings";
import { PluginStatus, type PluginStatusResult } from "@/types/commands/plugin";
import {
	defaultPluginDownloadSources,
	normalizePluginDownloadSources,
	PLUGIN_RESOURCE_VERSION,
	PluginConfig,
	type PluginDownloadSource,
	type PluginItem,
	type PluginStatusRecord,
} from "@/types/components/pluginService";
import {
	getAppConfigBaseDirWithCache,
	getConfigDirPath,
} from "@/utils/environment";
import { getPlatform } from "@/utils/platform";

const readPluginDownloadSources = async () => {
	try {
		const content = await textFileRead(
			`${await getConfigDirPath()}/${AppSettingsGroup.PluginService}.json`,
		);
		if (!content) {
			return defaultPluginDownloadSources;
		}

		const settings = JSON.parse(content) as { downloadSources?: unknown };
		return normalizePluginDownloadSources(settings.downloadSources);
	} catch {
		return defaultPluginDownloadSources;
	}
};

export const PluginServiceContextProvider: React.FC<{
	children: React.ReactNode;
	autoInit: boolean;
}> = ({ children, autoInit }) => {
	const pluginList = useMemo<PluginItem[]>(() => {
		return [
			{
				id: PLUGIN_ID_RAPID_OCR,
				file_list: [
					"ch_ppocr_mobile_v2.0_cls_infer.onnx",
					"ch_PP-OCRv4_det_infer.onnx",
					"ch_PP-OCRv4_rec_infer.onnx",
				],
			},
			{
				id: PLUGIN_ID_FFMPEG,
				file_list: getPlatform() === "windows" ? ["ffmpeg.exe"] : ["ffmpeg"],
			},
			{
				id: PLUGIN_ID_TRANSLATE,
				file_list: [],
			},
			{
				id: PLUGIN_ID_AI_CHAT,
				file_list: [],
			},
		];
	}, []);

	const [pluginConfig, setPluginConfig, pluginConfigRef] = useStateRef<
		PluginConfig | undefined
	>(undefined);
	const pluginStatusResultRef = useRef<PluginStatusResult[] | undefined>(
		undefined,
	);
	const [pluginStatus, setPluginStatus, pluginStatusRef] = useStateRef<
		PluginStatusRecord | undefined
	>(undefined);
	const [pluginReadyStatus, setPluginReadyStatus, pluginReadyStatusRef] =
		useStateRef<Record<string, boolean> | undefined>(undefined);

	const hasRegisterService = useRef(false);
	const initServiceReadyRef = useRef(false);
	const applyPluginConfig = useCallback(
		async (downloadSources: PluginDownloadSource[]) => {
			const configDirPath = await getAppConfigBaseDirWithCache();

			const pluginConfig = new PluginConfig(
				pluginList,
				PLUGIN_RESOURCE_VERSION,
				await path.join(configDirPath, "plugins"),
				await path.join(configDirPath, "pluginsDownloads"),
				downloadSources,
			);
			setPluginConfig(pluginConfig);

			if (autoInit) {
				await pluginInit(
					pluginConfig.version,
					pluginConfig.plugin_install_dir,
					pluginConfig.plugin_download_dir,
					pluginConfig.getPluginDownloadUrlTemplates(),
				);
			}

			if (!hasRegisterService.current) {
				hasRegisterService.current = true;

				if (autoInit) {
					await Promise.all(
						pluginList.map(async (plugin) => {
							await pluginRegisterPlugin(plugin.id, plugin.file_list);
						}),
					);
				}

				initServiceReadyRef.current = true;
			}
		},
		[setPluginConfig, pluginList, autoInit],
	);
	const initPluginConfig = useCallback(async () => {
		await applyPluginConfig(await readPluginDownloadSources());
	}, [applyPluginConfig]);

	const updatePluginDownloadSources = useCallback(
		async (downloadSources: PluginDownloadSource[]) => {
			await applyPluginConfig(normalizePluginDownloadSources(downloadSources));
		},
		[applyPluginConfig],
	);

	const refreshPluginStatus = useCallback(async () => {
		const pluginStatus = await pluginGetPluginsStatus();

		if (isDeepEqualReact(pluginStatus, pluginStatusResultRef.current)) {
			return;
		}

		pluginStatusResultRef.current = pluginStatus;

		setPluginStatus(
			pluginStatus.reduce((acc, plugin) => {
				acc[plugin.name] = plugin;
				return acc;
			}, {} as PluginStatusRecord),
		);

		const pluginReadyStatus = pluginStatus.reduce(
			(acc, plugin) => {
				acc[plugin.name] = plugin.status === PluginStatus.Installed;
				return acc;
			},
			{} as Record<string, boolean>,
		);

		if (isDeepEqualReact(pluginReadyStatus, pluginReadyStatusRef.current)) {
			return;
		}

		pluginReadyStatusRef.current = pluginReadyStatus;

		setPluginReadyStatus(pluginReadyStatus);
	}, [setPluginStatus, setPluginReadyStatus, pluginReadyStatusRef]);

	const refreshPluginStatusThrottle = useMemo(
		() => throttle(refreshPluginStatus, 1000),
		[refreshPluginStatus],
	);

	const initPluginPendingRef = useRef(false);
	useEffect(() => {
		if (initPluginPendingRef.current) {
			return;
		}

		initPluginPendingRef.current = true;
		initPluginConfig().then(() => {
			refreshPluginStatus();
			initPluginPendingRef.current = false;
		});
	}, [initPluginConfig, refreshPluginStatus]);

	const isReadyCore = useCallback(
		(pluginId: string) => {
			return pluginReadyStatusRef.current?.[pluginId] ?? false;
		},
		[pluginReadyStatusRef],
	);

	const isReadyStatusCore = useCallback(
		(pluginId: string) => {
			return pluginReadyStatus?.[pluginId] ?? false;
		},
		[pluginReadyStatus],
	);

	const contextValues = useMemo(() => {
		return {
			pluginConfig,
			pluginConfigRef,
			pluginStatus,
			pluginStatusRef,
			refreshPluginStatus,
			refreshPluginStatusThrottle,
			updatePluginDownloadSources,
			isReady: pluginStatus ? isReadyCore : undefined,
			isReadyStatus: pluginStatus ? isReadyStatusCore : undefined,
		};
	}, [
		isReadyCore,
		pluginConfig,
		pluginConfigRef,
		pluginStatus,
		pluginStatusRef,
		refreshPluginStatus,
		refreshPluginStatusThrottle,
		updatePluginDownloadSources,
		isReadyStatusCore,
	]);

	return (
		<PluginServiceContext.Provider value={contextValues}>
			{children}
		</PluginServiceContext.Provider>
	);
};
