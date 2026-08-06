import {
	isPermissionGranted,
	requestPermission,
	sendNotification,
} from "@tauri-apps/plugin-notification";
import { relaunch } from "@tauri-apps/plugin-process";
import type { Update } from "@tauri-apps/plugin-updater";
import { Modal } from "antd";
import { useCallback, useEffect, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { sendNewVersionNotification } from "@/commands/core";
import { useAppSettingsLoad } from "@/hooks/useAppSettingsLoad";
import { checkAppUpdate } from "@/services/version";
import { type AppSettingsData, AppSettingsGroup } from "@/types/appSettings";
import { appError, appInfo } from "@/utils/log";
import { getPlatform } from "@/utils/platform";

const notifyReleaseUpdate = async (
	latestVersion: string,
	currentVersion: string,
	intl: ReturnType<typeof useIntl>,
) => {
	let permissionGranted = await isPermissionGranted();

	if (!permissionGranted) {
		const permission = await requestPermission();
		permissionGranted = permission === "granted";
	}

	if (!permissionGranted) {
		return false;
	}

	const title = intl.formatMessage(
		{ id: "common.newVersion.title" },
		{ latestVersion },
	);
	const body = intl.formatMessage(
		{ id: "common.newVersion" },
		{ latestVersion, currentVersion },
	);

	if (getPlatform() === "macos") {
		sendNotification({ title, body });
		return true;
	}

	await sendNewVersionNotification(title, body);
	return true;
};

export const CheckVersion: React.FC = () => {
	const intl = useIntl();
	// 是否已经发送过通知
	const hasSendRef = useRef(false);

	// 使用 Tauri Updater 下载并安装更新
	const installWithTauriUpdater = useCallback(
		async (update: Update) => {
			try {
				appInfo("[CheckVersion] Update available:", update.version);
				await update.download();

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
						try {
							await update.install();
							await relaunch();
						} catch (error) {
							appError("[CheckVersion] Failed to install update:", error);
							Modal.error({
								title: intl.formatMessage({ id: "common.newVersion.title" }),
								content: String(error),
							});
						}
					},
				});

				hasSendRef.current = true;
			} catch (downloadError) {
				appError("[CheckVersion] Failed to download update:", downloadError);
				Modal.error({
					title: intl.formatMessage({ id: "common.newVersion.title" }),
					content: String(downloadError),
				});
			}
		},
		[intl],
	);

	// 主版本检查逻辑
	const checkVersionCore = useCallback(async () => {
		try {
			appInfo("[CheckVersion] Checking for updates...");
			const result = await checkAppUpdate({ includeInstallerUpdate: true });

			if (result.status === "available" && result.source === "tauri-updater") {
				await installWithTauriUpdater(result.update);
				return;
			}

			if (result.status === "available" && result.source === "github-release") {
				if (hasSendRef.current) {
					return;
				}

				const notified = await notifyReleaseUpdate(
					result.latestVersion,
					result.currentVersion,
					intl,
				);
				if (notified) {
					hasSendRef.current = true;
				}
				return;
			}

			if (result.status === "up-to-date") {
				appInfo("[CheckVersion] No update available");
			}
		} catch (error) {
			appError("[CheckVersion] Failed to check version:", error);
		}
	}, [installWithTauriUpdater, intl]);

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
		if (process.env.NODE_ENV === "development") {
			return;
		}

		if (autoCheckVersion === undefined) {
			return;
		}

		if (autoCheckVersion) {
			if (!hasCheckedVersionRef.current) {
				checkVersion();
				hasCheckedVersionRef.current = true;
			}
		}
	}, [autoCheckVersion, checkVersion]);

	return undefined;
};
