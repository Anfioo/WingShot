import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const packageJsonPath = path.join(rootDir, "package.json");
const tauriConfigPath = path.join(rootDir, "src-tauri", "tauri.conf.json");
const cargoTomlPath = path.join(rootDir, "src-tauri", "Cargo.toml");
const cargoLockPath = path.join(rootDir, "src-tauri", "Cargo.lock");

const rl = readline.createInterface({ input, output });

function run(command) {
	return execSync(command, {
		cwd: rootDir,
		stdio: "pipe",
		encoding: "utf8",
	}).trim();
}

function runInteractive(command, options = {}) {
	execSync(command, {
		cwd: rootDir,
		stdio: "inherit",
		env: {
			...process.env,
			...(options.env ?? {}),
		},
	});
}

async function ask(question) {
	return (await rl.question(question)).trim();
}

async function askYesNo(question, defaultValue = false) {
	const answer = (
		await ask(`${question}${defaultValue ? " (Y/n): " : " (y/N): "}`)
	).toLowerCase();

	if (!answer) {
		return defaultValue;
	}

	return answer === "y" || answer === "yes";
}

function parseVersion(version) {
	const match = version.match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/);
	if (!match) {
		throw new Error(`不支持的版本格式：${version}`);
	}

	return {
		major: Number(match[1]),
		minor: Number(match[2]),
		patch: Number(match[3]),
		prerelease: match[4] ?? null,
	};
}

function formatVersion({ major, minor, patch, prerelease }) {
	const base = `${major}.${minor}.${patch}`;
	return prerelease ? `${base}-${prerelease}` : base;
}

function bumpPrerelease(prerelease) {
	if (!prerelease) {
		return "beta.1";
	}

	const match = prerelease.match(/^(.+?)\.(\d+)$/);
	if (!match) {
		return `${prerelease}.1`;
	}

	return `${match[1]}.${Number(match[2]) + 1}`;
}

function getSuggestedVersions(currentVersion) {
	const parsed = parseVersion(currentVersion);
	const stable = { ...parsed, prerelease: null };
	const patch = { ...stable, patch: stable.patch + 1 };
	const minor = { major: stable.major, minor: stable.minor + 1, patch: 0, prerelease: null };
	const major = { major: stable.major + 1, minor: 0, patch: 0, prerelease: null };

	const suggestions = [];

	if (parsed.prerelease) {
		suggestions.push({ label: "当前预发布转正式版", version: formatVersion(stable) });
		suggestions.push({
			label: "下一个预发布版本",
			version: formatVersion({ ...stable, prerelease: bumpPrerelease(parsed.prerelease) }),
		});
	} else {
		suggestions.push({
			label: "下一个补丁 beta",
			version: formatVersion({ ...patch, prerelease: "beta.1" }),
		});
	}

	suggestions.push(
		{ label: "补丁版本", version: formatVersion(patch) },
		{ label: "次版本", version: formatVersion(minor) },
		{ label: "主版本", version: formatVersion(major) },
	);

	return suggestions;
}

async function chooseVersion(currentVersion) {
	const suggestions = getSuggestedVersions(currentVersion);

	console.log(`当前版本：${currentVersion}`);
	console.log("\n请选择下一个版本：");
	suggestions.forEach((item, index) => {
		console.log(`${index + 1}. ${item.label} -> ${item.version}`);
	});
	console.log(`${suggestions.length + 1}. 自定义版本`);

	const choiceNumber = Number(
		await ask(`\n请输入选择 (1-${suggestions.length + 1}): `),
	);

	if (choiceNumber >= 1 && choiceNumber <= suggestions.length) {
		return suggestions[choiceNumber - 1].version;
	}

	if (choiceNumber === suggestions.length + 1) {
		const customVersion = await ask("请输入自定义版本号: ");
		parseVersion(customVersion);
		return customVersion;
	}

	console.log("选择无效，默认使用第一个候选版本。");
	return suggestions[0].version;
}

function getCargoVersion(cargoToml) {
	const match = cargoToml.match(/^(version\s*=\s*")([^"]+)("\s*)$/m);
	if (!match) {
		throw new Error("未能在 src-tauri/Cargo.toml 中找到版本字段");
	}

	return match[2];
}

function getCargoPackageName(cargoToml) {
	const packageSection = cargoToml.match(/\[package\]([\s\S]*?)(?:\n\[|$)/);
	const match = packageSection?.[1].match(/^name\s*=\s*"([^"]+)"\s*$/m);
	if (!match) {
		throw new Error("未能在 src-tauri/Cargo.toml 的 [package] 中找到包名字段");
	}

	return match[1];
}

function getCargoLockPackagePattern(packageName) {
	return new RegExp(
		`(\\[\\[package\\]\\]\\s+name = "${packageName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"\\s+version = ")([^"]+)(")`,
	);
}

function getCargoLockVersion(cargoLock, packageName) {
	const match = cargoLock.match(getCargoLockPackagePattern(packageName));
	return match?.[2] ?? null;
}

function ensureVersionsAreConsistent(versions) {
	const comparedVersions = Object.entries(versions).filter(([, version]) => version);
	const uniqueVersions = new Set(comparedVersions.map(([, version]) => version));
	if (uniqueVersions.size <= 1) {
		return;
	}

	throw new Error(
		`检测到版本不一致：${comparedVersions
			.map(([name, version]) => `${name}=${version}`)
			.join("，")}`,
	);
}

async function loadCurrentVersions() {
	const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
	const tauriConfig = JSON.parse(await readFile(tauriConfigPath, "utf8"));
	const cargoToml = await readFile(cargoTomlPath, "utf8");
	const cargoLock = existsSync(cargoLockPath)
		? await readFile(cargoLockPath, "utf8")
		: "";

	const cargoPackageName = getCargoPackageName(cargoToml);
	const versions = {
		"package.json": packageJson.version,
		"src-tauri/tauri.conf.json": tauriConfig.version,
		"src-tauri/Cargo.toml": getCargoVersion(cargoToml),
		"src-tauri/Cargo.lock": cargoLock
			? getCargoLockVersion(cargoLock, cargoPackageName)
			: null,
	};

	for (const [name, version] of Object.entries(versions)) {
		if (version) {
			parseVersion(version);
		} else if (name !== "src-tauri/Cargo.lock") {
			throw new Error(`${name} 中的版本号缺失或无效`);
		}
	}

	ensureVersionsAreConsistent(versions);
	return { currentVersion: packageJson.version, cargoPackageName };
}

async function updateVersions(newVersion) {
	const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
	packageJson.version = newVersion;
	await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, "\t")}\n`);

	const tauriConfig = JSON.parse(await readFile(tauriConfigPath, "utf8"));
	tauriConfig.version = newVersion;
	await writeFile(tauriConfigPath, `${JSON.stringify(tauriConfig, null, "\t")}\n`);

	const cargoToml = await readFile(cargoTomlPath, "utf8");
	let cargoVersionFound = false;
	const nextCargoToml = cargoToml.replace(
		/^(version\s*=\s*")[^"]+("\s*)$/m,
		(_, prefix, suffix) => {
			cargoVersionFound = true;
			return `${prefix}${newVersion}${suffix}`;
		},
	);

	if (!cargoVersionFound) {
		throw new Error("未能在 src-tauri/Cargo.toml 中找到版本字段");
	}

	await writeFile(cargoTomlPath, nextCargoToml);

	if (!existsSync(cargoLockPath)) {
		return;
	}

	const cargoLock = await readFile(cargoLockPath, "utf8");
	const cargoPackageName = getCargoPackageName(cargoToml);
	const nextCargoLock = cargoLock.replace(
		getCargoLockPackagePattern(cargoPackageName),
		`$1${newVersion}$3`,
	);

	if (nextCargoLock !== cargoLock) {
		await writeFile(cargoLockPath, nextCargoLock);
	}
}

function ensureCleanWorkingTree() {
	const status = run("git status --short");
	if (status) {
		throw new Error("当前工作区不干净，请先提交或暂存现有改动后再发布。");
	}
}

function ensureTagDoesNotExist(tagName) {
	if (run(`git tag --list ${tagName}`)) {
		throw new Error(`本地已存在 Tag ${tagName}`);
	}

	if (run(`git ls-remote --tags origin refs/tags/${tagName}`)) {
		throw new Error(`远程 origin 上已存在 Tag ${tagName}`);
	}
}

function getCurrentBranch() {
	return run("git rev-parse --abbrev-ref HEAD");
}

async function main() {
	try {
		ensureCleanWorkingTree();
		const branch = getCurrentBranch();
		const shouldCreateReleaseCommit = branch === "main";
		const { currentVersion } = await loadCurrentVersions();
		const nextVersion = await chooseVersion(currentVersion);
		const tagName = `v${nextVersion}`;
		if (shouldCreateReleaseCommit) {
			ensureTagDoesNotExist(tagName);
		}

		console.log("\n发布摘要：");
		console.log(`- 分支：${branch}`);
		console.log(`- 当前版本：${currentVersion}`);
		console.log(`- 新版本：${nextVersion}`);
		if (shouldCreateReleaseCommit) {
			console.log(`- Tag：${tagName}`);
			console.log("- 操作：更新版本文件、创建提交、创建 tag，可选择推送");
		} else {
			console.log("- 操作：仅更新版本文件，不暂存、不提交、不创建 tag、不推送");
		}

		if (
			!(await askYesNo(
				shouldCreateReleaseCommit
					? "是否继续更新版本并创建 release 提交和 tag？"
					: "是否继续更新版本文件？",
			))
		) {
			console.log("已取消。");
			return;
		}

		await updateVersions(nextVersion);

		if (!shouldCreateReleaseCommit) {
			console.log("\n已更新版本文件。当前不是 main 分支，已跳过 git add、commit、tag 和 push。");
			return;
		}

		runInteractive("git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml src-tauri/Cargo.lock");
		runInteractive(`git commit -m "chore: release ${nextVersion}"`, {
			env: { ALLOW_MAIN_COMMIT: "1" },
		});
		runInteractive(`git tag ${tagName}`);

		console.log("\n已成功创建提交和 tag。");
		if (await askYesNo("是否立即推送提交和 tag 到远程仓库？")) {
			runInteractive(`git push origin ${branch}`);
			runInteractive(`git push origin ${tagName}`);
			console.log("已推送提交和 tag。");
		} else {
			console.log("已跳过推送，可稍后执行：");
			console.log(`git push origin ${branch}`);
			console.log(`git push origin ${tagName}`);
		}
	} catch (error) {
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	} finally {
		rl.close();
	}
}

await main();