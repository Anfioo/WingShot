"use client";

import {
	DeleteOutlined,
	FolderOpenOutlined,
	MenuOutlined,
	PlusOutlined,
	SaveOutlined,
	SyncOutlined,
} from "@ant-design/icons";
import { openPath, openUrl } from "@tauri-apps/plugin-opener";
import {
	Badge,
	Button,
	Card,
	Input,
	List,
	Space,
	Switch,
	Typography,
	theme,
} from "antd";
import {
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { pluginInstallPlugin, pluginUninstallPlugin } from "@/commands/plugin";
import {
	PLUGIN_ID_FFMPEG,
	PLUGIN_ID_RAPID_OCR,
} from "@/constants/pluginService";
import { AntdContext } from "@/contexts/antdContext";
import { AppSettingsActionContext } from "@/contexts/appSettingsActionContext";
import { usePluginServiceContext } from "@/contexts/pluginServiceContext";
import { AppSettingsGroup } from "@/types/appSettings";
import { PluginStatus } from "@/types/commands/plugin";
import {
	createPluginDownloadSourceId,
	normalizePluginDownloadSources,
	type PluginDownloadSource,
} from "@/types/components/pluginService";
import { appError } from "@/utils/log";

const moveItem = <T,>(items: T[], fromIndex: number, toIndex: number) => {
	const nextItems = [...items];
	const [item] = nextItems.splice(fromIndex, 1);
	nextItems.splice(toIndex, 0, item);
	return nextItems;
};

const PluginDownloadSourceSetting = () => {
	const intl = useIntl();
	const { token } = theme.useToken();
	const { message } = useContext(AntdContext);
	const { updateAppSettings } = useContext(AppSettingsActionContext);
	const { pluginConfig, updatePluginDownloadSources } =
		usePluginServiceContext();
	const [downloadSources, setDownloadSources] = useState<
		PluginDownloadSource[]
	>([]);
	const draggingSourceIdRef = useRef<string | undefined>(undefined);

	useEffect(() => {
		setDownloadSources(
			normalizePluginDownloadSources(pluginConfig?.plugin_download_sources),
		);
	}, [pluginConfig?.plugin_download_sources]);

	const updateSource = useCallback(
		(id: string, patch: Partial<PluginDownloadSource>) => {
			setDownloadSources((sources) =>
				sources.map((source) =>
					source.id === id ? { ...source, ...patch } : source,
				),
			);
		},
		[],
	);

	const handlePointerDown = useCallback((id: string) => {
		draggingSourceIdRef.current = id;
		const handlePointerUp = () => {
			draggingSourceIdRef.current = undefined;
			window.removeEventListener("pointerup", handlePointerUp);
			window.removeEventListener("pointercancel", handlePointerUp);
		};
		window.addEventListener("pointerup", handlePointerUp);
		window.addEventListener("pointercancel", handlePointerUp);
	}, []);

	const handlePointerEnter = useCallback((targetId: string) => {
		const draggingId = draggingSourceIdRef.current;
		if (!draggingId || draggingId === targetId) {
			return;
		}

		setDownloadSources((sources) => {
			const fromIndex = sources.findIndex((source) => source.id === draggingId);
			const toIndex = sources.findIndex((source) => source.id === targetId);
			if (fromIndex < 0 || toIndex < 0) {
				return sources;
			}
			return moveItem(sources, fromIndex, toIndex);
		});
	}, []);

	const addSource = useCallback(() => {
		setDownloadSources((sources) => [
			...sources,
			{
				id: createPluginDownloadSourceId(),
				name: intl.formatMessage({ id: "plugin.downloadSource.customName" }),
				urlTemplate:
					"https://example.com/plugins/{version}/{platform}/{plugin}.zip",
				enabled: true,
			},
		]);
	}, [intl]);

	const removeSource = useCallback((id: string) => {
		setDownloadSources((sources) =>
			sources.length <= 1
				? sources
				: sources.filter((source) => source.id !== id),
		);
	}, []);

	const saveSources = useCallback(async () => {
		const normalizedSources = normalizePluginDownloadSources(downloadSources);
		updateAppSettings(
			AppSettingsGroup.PluginService,
			{ downloadSources: normalizedSources },
			false,
			true,
			true,
			false,
			false,
		);
		await updatePluginDownloadSources(normalizedSources);
		message.success(
			intl.formatMessage({ id: "plugin.downloadSource.saveSuccess" }),
		);
	}, [
		downloadSources,
		intl,
		message,
		updateAppSettings,
		updatePluginDownloadSources,
	]);

	return (
		<Card
			size="small"
			title={intl.formatMessage({ id: "plugin.downloadSource.title" })}
			extra={
				<Button
					variant="solid"
					color="primary"
					size="small"
					icon={<SaveOutlined />}
					onClick={saveSources}
				>
					<FormattedMessage id="plugin.downloadSource.save" />
				</Button>
			}
			style={{ marginBottom: 16 }}
		>
			<Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
				<FormattedMessage id="plugin.downloadSource.description" />
			</Typography.Paragraph>
			<Space direction="vertical" style={{ width: "100%" }} size={8}>
				{downloadSources.map((source, index) => (
					<div
						key={source.id}
						onPointerEnter={() => handlePointerEnter(source.id)}
						style={{
							display: "grid",
							gridTemplateColumns: "28px 32px 160px minmax(260px, 1fr) 88px",
							gap: 8,
							alignItems: "center",
							padding: 8,
							border: `1px solid ${token.colorBorder}`,
							borderRadius: token.borderRadius,
						}}
					>
						<MenuOutlined
							onPointerDown={(event) => {
								event.preventDefault();
								handlePointerDown(source.id);
							}}
							style={{ cursor: "grab", color: token.colorTextSecondary }}
						/>
						<Typography.Text type="secondary">{index + 1}</Typography.Text>
						<Input
							value={source.name}
							onChange={(event) =>
								updateSource(source.id, { name: event.target.value })
							}
							placeholder={intl.formatMessage({
								id: "plugin.downloadSource.namePlaceholder",
							})}
						/>
						<Input
							value={source.urlTemplate}
							onChange={(event) =>
								updateSource(source.id, { urlTemplate: event.target.value })
							}
							placeholder="https://example.com/plugins/{version}/{platform}/{plugin}.zip"
						/>
						<Space>
							<Switch
								checked={source.enabled}
								onChange={(enabled) => updateSource(source.id, { enabled })}
							/>
							<Button
								variant="text"
								color="red"
								size="small"
								icon={<DeleteOutlined />}
								disabled={downloadSources.length <= 1}
								onClick={() => removeSource(source.id)}
							/>
						</Space>
					</div>
				))}
				<Button icon={<PlusOutlined />} onClick={addSource}>
					<FormattedMessage id="plugin.downloadSource.add" />
				</Button>
			</Space>
		</Card>
	);
};

export const PluginsPage = () => {
	const intl = useIntl();
	const { pluginConfig, pluginStatus } = usePluginServiceContext();

	const pluginList = useMemo(() => {
		return Array.from(pluginConfig?.plugins.values() || []).map((plugin) => {
			let link: string | undefined;
			switch (plugin.id) {
				case PLUGIN_ID_FFMPEG:
					link = "https://ffmpeg.org/";
					break;
				case PLUGIN_ID_RAPID_OCR:
					link = "https://github.com/RapidAI/RapidOCR";
					break;
			}

			return {
				id: plugin.id,
				link,
				title: intl.formatMessage({ id: `plugin.${plugin.id}.name` }),
				description: intl.formatMessage({
					id: `plugin.${plugin.id}.description`,
				}),
				functionDescription: intl.formatMessage({
					id: `plugin.${plugin.id}.functionDescription`,
				}),
				status: pluginStatus?.[plugin.id]?.status || PluginStatus.NotInstalled,
			};
		});
	}, [intl, pluginConfig?.plugins, pluginStatus]);

	const convertPluginStatusToBadgeStatus = (status: PluginStatus) => {
		switch (status) {
			case PluginStatus.Installed:
				return "success";
			case PluginStatus.NotInstalled:
				return "default";
			case PluginStatus.Downloading:
				return "processing";
			case PluginStatus.Unzipping:
				return "processing";
			case PluginStatus.Uninstalling:
				return "error";
		}
	};

	return (
		<div>
			<PluginDownloadSourceSetting />
			<List
				loading={pluginStatus === undefined || pluginList.length === 0}
				itemLayout="vertical"
				dataSource={pluginList}
				renderItem={(item) => (
					<List.Item
						actions={[
							item.status === PluginStatus.Installed ||
							item.status === PluginStatus.Uninstalling ? (
								<Button
									key="uninstall"
									variant="text"
									color="red"
									size="small"
									icon={<DeleteOutlined />}
									loading={item.status === PluginStatus.Uninstalling}
									onClick={() => {
										try {
											pluginUninstallPlugin(item.id);
										} catch (error) {
											appError("[PluginsPage] uninstall plugin error", error);
										}
									}}
								>
									<FormattedMessage id="plugin.uninstall" />
								</Button>
							) : (
								<Button
									key="install"
									variant="text"
									color="primary"
									size="small"
									icon={<PlusOutlined />}
									loading={
										item.status === PluginStatus.Downloading ||
										item.status === PluginStatus.Unzipping
									}
									onClick={() => {
										try {
											pluginInstallPlugin(item.id);
										} catch (error) {
											appError("[PluginsPage] install plugin error", error);
										}
									}}
								>
									<FormattedMessage id="plugin.install" />
								</Button>
							),
							<Button
								key="forceInstall"
								variant="text"
								color="green"
								size="small"
								icon={<SyncOutlined />}
								disabled={item.status !== PluginStatus.Installed}
								onClick={() => {
									try {
										pluginInstallPlugin(item.id, true);
									} catch (error) {
										appError("[PluginsPage] force install plugin error", error);
									}
								}}
							>
								<FormattedMessage id="plugin.forceInstall" />
							</Button>,
							<Button
								key="openDataDir"
								variant="text"
								color="primary"
								size="small"
								icon={<FolderOpenOutlined />}
								disabled={item.status !== PluginStatus.Installed}
								onClick={async () => {
									try {
										const dirPath = await pluginConfig?.getPluginDirPath(
											item.id,
										);
										if (dirPath) {
											await openPath(dirPath);
										}
									} catch (error) {
										appError("[PluginsPage] open data dir error", error);
									}
								}}
							>
								<FormattedMessage id="plugin.openDataDir" />
							</Button>,
						]}
						extra={
							<Badge
								status={convertPluginStatusToBadgeStatus(item.status)}
								key="status"
								text={intl.formatMessage({
									id: `plugin.status.${item.status}`,
								})}
							/>
						}
					>
						<List.Item.Meta
							title={
								<a
									onClick={(event) => {
										event.preventDefault();
										if (item.link) {
											openUrl(item.link);
										}
									}}
								>
									{item.title}
								</a>
							}
							description={item.description}
						/>
						{/* <div style={{ whiteSpace: 'pre-wrap' }}>
                            <FormattedMessage id="plugin.extensionFunction" />
                            {`: ${item.functionDescription}`}
                        </div> */}
					</List.Item>
				)}
			/>
		</div>
	);
};

export default PluginsPage;
