import { getVersion } from "@tauri-apps/api/app";
import { fetch } from "@tauri-apps/plugin-http";
import { openUrl } from "@tauri-apps/plugin-opener";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { compare } from "compare-versions";
import { isPortableApp } from "@/commands/file";
import { appError } from "@/utils/log";

export const WING_SHOT_WEBSITE_URL = "https://wingshot.anfioo.com/";
export const WING_SHOT_GITHUB_RELEASES_URL =
	"https://github.com/Anfioo/WingShot/releases";
export const WING_SHOT_GITHUB_LATEST_RELEASE_URL = `${WING_SHOT_GITHUB_RELEASES_URL}/latest`;

export type AppUpdateCheckResult =
	| {
			status: "available";
			source: "tauri-updater";
			currentVersion: string;
			latestVersion: string;
			update: Update;
	  }
	| {
			status: "available";
			source: "github-release";
			currentVersion: string;
			latestVersion: string;
			releaseUrl: string;
	  }
	| {
			status: "up-to-date";
			currentVersion: string;
			latestVersion?: string;
	  }
	| {
			status: "error";
			currentVersion?: string;
			error: unknown;
	  };

export const getLatestVersion = async () => {
	const response = await fetch(`${WING_SHOT_WEBSITE_URL}latest-version.txt`);
	if (!response.ok) {
		appError("Failed to get latest version:", response.statusText);
		return;
	}

	return (await response.text()).trim();
};

const checkLatestVersionFromReleasePage = async (
	currentVersion: string,
): Promise<AppUpdateCheckResult> => {
	const latestVersion = await getLatestVersion();
	if (!latestVersion) {
		return { status: "up-to-date", currentVersion };
	}

	if (compare(currentVersion, latestVersion, ">=")) {
		return { status: "up-to-date", currentVersion, latestVersion };
	}

	return {
		status: "available",
		source: "github-release",
		currentVersion,
		latestVersion,
		releaseUrl: WING_SHOT_GITHUB_LATEST_RELEASE_URL,
	};
};

export const checkAppUpdate = async (
	options: { includeInstallerUpdate?: boolean } = {},
): Promise<AppUpdateCheckResult> => {
	let currentVersion: string | undefined;

	try {
		currentVersion = await getVersion();

		if (
			process.env.NODE_ENV !== "development" &&
			options.includeInstallerUpdate &&
			!(await isPortableApp())
		) {
			try {
				const update = await check();
				if (update) {
					return {
						status: "available",
						source: "tauri-updater",
						currentVersion,
						latestVersion: update.version,
						update,
					};
				}

				return { status: "up-to-date", currentVersion };
			} catch (error) {
				appError("[VersionService] Tauri updater check failed:", error);
			}
		}

		return await checkLatestVersionFromReleasePage(currentVersion);
	} catch (error) {
		appError("[VersionService] Failed to check app update:", error);
		return { status: "error", currentVersion, error };
	}
};

export const openLatestReleasePage = async () => {
	await openUrl(WING_SHOT_GITHUB_LATEST_RELEASE_URL);
};
