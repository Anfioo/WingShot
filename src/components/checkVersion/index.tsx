import { getVersion } from "@tauri-apps/api/app";
import { fetch } from "@tauri-apps/plugin-http";
import {
	isPermissionGranted,
	requestPermission,
	sendNotification,
} from "@tauri-apps/plugin-notification";
import { relaunch } from "@tauri-apps/plugin-process";
import { check } from "@tauri-apps/plugin-updater";
import { Modal } from "antd";
import { compare } from "compare-versions";
import { useCallback, useEffect, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { sendNewVersionNotification } from "@/commands/core";
import { isPortableApp } from "@/commands/file";
import { useAppSettingsLoad } from "@/hooks/useAppSettingsLoad";
import { type AppSettingsData, AppSettingsGroup } from "@/types/appSettings";
import { appError, appInfo } from "@/utils/log";
import { getPlatform } from "@/utils/platform";

const WEBSITE_URL = "https://snowshot.top/";

export const getLatestVersion = async () => {
	const response = await fetch(`${WEBSITE_URL}latest-version.txt`);
	if (!response.ok) {
		appError("Failed to get latest version:", response.statusText);
		return;
	}

	return (await response.text()).trim();
};

export const CheckVersion: React.FC = () => {
	const intl = useIntl();
	const intervalRef = useRef<NodeJS.Timeout | null>(null);

	const clearIntervalRef = useCallback(() => {
		if (intervalRef.current) {
			clearInterval(intervalRef.current);
			intervalRef.current = null;
		}
	}, []);

	// 是否已经发送过通知
	const hasSendRef = useRef(false);

	// 使用 Tauri Updater 检查更新
	const checkVersionWithTauriUpdater = useCallback(async () => {
		try {
			appInfo("[CheckVersion] Checking for updates with Tauri updater...");
			const update = await check();

			if (update) {
				appInfo("[CheckVersion] Update available:", update.version);

				try {
					// 在后台静默下载更新
					await update.download();

					// 下载完成，显示确认对话框
					Modal.confirm({
						title: intl.formatMessage({
							id: "common.newVersion.updateReady",
						}),
						content: intl.formatMessage(
							{ id: "common.newVersion.updateReady.description" },
							{ version: update.version },
						),
						okText: intl.formatMessage({
							id: "common.newVersion.updateNow",
						}),
						cancelText: intl.formatMessage({
							id: "common.newVersion.updateLater",
						}),
						onOk: async () => {
							// 重启应用并安装更新
							await update.install();
							await relaunch();
						},
					});

					hasSendRef.current = true;
					clearIntervalRef();
					return true;
				} catch (downloadError) {
					appError("[CheckVersion] Failed to download update:", downloadError);
					return false;
				}
			} else {
				appInfo("[CheckVersion] No update available");
			}
			return true;
		} catch (error) {
			appError("[CheckVersion] Tauri updater check failed:", error);
			return false;
		}
	}, [clearIntervalRef, intl]);

	// 使用传统方式检查更新（备用方案）
	const checkVersionWithNotification = useCallback(async () => {
		try {
			const currentVersion = await getVersion();

			const latestVersion = await getLatestVersion();

			if (!latestVersion) {
				return;
			}

			if (compare(currentVersion, latestVersion, ">=")) {
				return;
			}

			if (hasSendRef.current) {
				return;
			}

			let permissionGranted = await isPermissionGranted();

			if (!permissionGranted) {
				const permission = await requestPermission();
				permissionGranted = permission === "granted";
			}

			if (permissionGranted) {
				if (getPlatform() === "macos") {
					sendNotification({
						title: intl.formatMessage(
							{ id: "common.newVersion.title" },
							{
								latestVersion,
							},
						),
						body: intl.formatMessage(
							{ id: "common.newVersion" },
							{
								latestVersion,
								currentVersion,
							},
						),
					});
				} else {
					sendNewVersionNotification(
						intl.formatMessage(
							{ id: "common.newVersion.title" },
							{
								latestVersion,
							},
						),
						intl.formatMessage(
							{ id: "common.newVersion" },
							{
								latestVersion,
								currentVersion,
							},
						),
					).then(() => {
						hasSendRef.current = true;
						clearIntervalRef();
					});
				}
			}
		} catch (error) {
			appError(
				"[CheckVersion] Failed to check version with notification:",
				error,
			);
		}
	}, [clearIntervalRef, intl]);

	// 主版本检查逻辑
	const checkVersionCore = useCallback(async () => {
		try {
			// 首先尝试使用 Tauri updater
			let tauriUpdaterSuccess = false;
			// 绿色版不进行安装包升级
			if (!(await isPortableApp())) {
				tauriUpdaterSuccess = await checkVersionWithTauriUpdater();
			}

			// 如果 Tauri updater 检查失败，使用传统方式
			if (!tauriUpdaterSuccess) {
				appInfo(
					"[CheckVersion] Falling back to notification-based update check...",
				);
				await checkVersionWithNotification();
			}
		} catch (error) {
			appError("[CheckVersion] Failed to check version:", error);
		}
	}, [checkVersionWithTauriUpdater, checkVersionWithNotification]);

	const checkVersionLoadingRef = useRef(false);
	const checkVersion = useCallback(async () => {
		if (checkVersionLoadingRef.current) {
			return;
		}

		checkVersionLoadingRef.current = true;
		await checkVersionCore();
		checkVersionLoadingRef.current = false;
	}, [checkVersionCore]);

	const [autoCheckVersion, setAutoCheckVersion] = useState<boolean | undefined>(
		undefined,
	);
	useAppSettingsLoad(
		useCallback((appSettings: AppSettingsData) => {
			setAutoCheckVersion(
				appSettings[AppSettingsGroup.SystemCommon].autoCheckVersion,
			);
		}, []),
		true,
	);

	const hasCheckedVersionRef = useRef(false);
	useEffect(() => {
		if (autoCheckVersion === undefined) {
			return;
		}

		if (autoCheckVersion) {
			if (!hasCheckedVersionRef.current) {
				checkVersion();
				hasCheckedVersionRef.current = true;
			}

			clearIntervalRef();

			intervalRef.current = setInterval(checkVersion, 1000 * 60 * 60);
		} else {
			clearIntervalRef();
		}

		return () => {
			if (intervalRef.current) {
				clearInterval(intervalRef.current);
				intervalRef.current = null;
			}
		};
	}, [autoCheckVersion, checkVersion, clearIntervalRef]);

	return undefined;
};
