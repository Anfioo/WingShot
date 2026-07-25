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
	const intervalRef = useRef<NodeJS.Timeout | null>(null);

	const clearIntervalRef = useCallback(() => {
		if (intervalRef.current) {
			clearInterval(intervalRef.current);
			intervalRef.current = null;
		}
	}, []);

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
						await update.install();
						await relaunch();
					},
				});

				hasSendRef.current = true;
				clearIntervalRef();
			} catch (downloadError) {
				appError("[CheckVersion] Failed to download update:", downloadError);
			}
		},
		[clearIntervalRef, intl],
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
					clearIntervalRef();
				}
				return;
			}

			if (result.status === "up-to-date") {
				appInfo("[CheckVersion] No update available");
			}
		} catch (error) {
			appError("[CheckVersion] Failed to check version:", error);
		}
	}, [clearIntervalRef, installWithTauriUpdater, intl]);

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
