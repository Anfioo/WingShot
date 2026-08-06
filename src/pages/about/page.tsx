"use client";

import {
	GithubOutlined,
	MailOutlined,
	MessageOutlined,
	QqOutlined,
} from "@ant-design/icons";
import { getVersion } from "@tauri-apps/api/app";
import { openUrl } from "@tauri-apps/plugin-opener";
import { relaunch } from "@tauri-apps/plugin-process";
import {
	Badge,
	Button,
	Divider,
	Modal,
	message,
	Space,
	Tag,
	Tooltip,
	Typography,
	theme,
} from "antd";
import { compare } from "compare-versions";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { getCommitSha } from "@/commands/core";
import {
	checkAppUpdate,
	getLatestVersion,
	openLatestReleasePage,
	WING_SHOT_GITHUB_RELEASES_URL,
	WING_SHOT_WEBSITE_URL,
} from "@/services/version";
import { appError } from "@/utils/log";

const { Title, Paragraph, Text } = Typography;

export const AboutPage = () => {
	const { token } = theme.useToken();
	const intl = useIntl();
	const [messageApi, contextHolder] = message.useMessage();
	const [version, setVersion] = useState("0.1.3");
	const [latestVersion, setLatestVersion] = useState<string>();
	const [commitSha, setCommitSha] = useState<string>("");
	const [checkingUpdate, setCheckingUpdate] = useState(false);

	const inited = useRef(false);
	const init = useCallback(async () => {
		if (inited.current) {
			return;
		}
		inited.current = true;

		const version = await getVersion();
		setVersion(version);

		const latestVersion = await getLatestVersion();
		if (latestVersion) {
			setLatestVersion(latestVersion);
		}

		const commitSha = await getCommitSha();
		setCommitSha(commitSha);
	}, []);

	useEffect(() => {
		init();
	}, [init]);

	const hasNewVersion = useMemo(() => {
		return latestVersion !== undefined && compare(latestVersion, version, ">");
	}, [latestVersion, version]);

	const handleCheckUpdate = useCallback(async () => {
		if (checkingUpdate) {
			return;
		}

		setCheckingUpdate(true);
		try {
			messageApi.loading({
				content: intl.formatMessage({ id: "about.update.checking" }),
				key: "about-check-update",
			});
			const result = await checkAppUpdate({ includeInstallerUpdate: true });

			if (result.status === "available") {
				setLatestVersion(result.latestVersion);
				messageApi.destroy("about-check-update");

				if (result.source === "tauri-updater") {
					Modal.confirm({
						title: intl.formatMessage(
							{ id: "common.newVersion.title" },
							{
								latestVersion: result.latestVersion,
							},
						),
						content: intl.formatMessage(
							{ id: "common.newVersion.updateReady.description" },
							{ version: result.latestVersion },
						),
						okText: intl.formatMessage({ id: "common.newVersion.updateNow" }),
						cancelText: intl.formatMessage({
							id: "common.newVersion.updateLater",
						}),
						onOk: async () => {
							const hide = messageApi.loading(
								intl.formatMessage({ id: "common.newVersion.downloading" }),
								0,
							);
							try {
								await result.update.download();
								await result.update.install();
								await relaunch();
							} catch (error) {
								appError("[AboutPage] Failed to install update:", error);
								messageApi.error({
									content: String(error),
									key: "about-update-error",
								});
							} finally {
								hide();
							}
						},
					});
					return;
				}

				Modal.confirm({
					title: intl.formatMessage(
						{ id: "common.newVersion.title" },
						{
							latestVersion: result.latestVersion,
						},
					),
					content: intl.formatMessage(
						{ id: "about.update.githubRelease.description" },
						{
							currentVersion: result.currentVersion,
							latestVersion: result.latestVersion,
						},
					),
					okText: intl.formatMessage({ id: "about.update.openRelease" }),
					cancelText: intl.formatMessage({
						id: "common.newVersion.updateLater",
					}),
					onOk: openLatestReleasePage,
				});
				return;
			}

			if (result.status === "up-to-date") {
				if (result.latestVersion) {
					setLatestVersion(result.latestVersion);
				}
				messageApi.success({
					content: intl.formatMessage({ id: "about.update.upToDate" }),
					key: "about-check-update",
				});
				return;
			}

			messageApi.error({
				content: intl.formatMessage({ id: "about.update.checkFailed" }),
				key: "about-check-update",
			});
		} finally {
			setCheckingUpdate(false);
		}
	}, [checkingUpdate, intl, messageApi]);

	return (
		<>
			{contextHolder}
			<div
				style={{
					margin: `${token.marginLG}px 0`,
					minHeight: "100vh",
				}}
			>
				{/* 头部信息 */}
				<div style={{ textAlign: "center", marginBottom: token.marginLG }}>
					<div style={{ marginBottom: -12 }}>
						<img
							src={"/images/app-icon.png"}
							alt="Wing Shot"
							width={100}
							height={100}
						/>
					</div>

					<Title level={2} style={{ marginTop: token.marginSM }}>
						<Badge
							count={
								hasNewVersion
									? intl.formatMessage({ id: "about.newVersion" })
									: undefined
							}
							style={{ display: "block", cursor: "pointer" }}
							size="small"
							onClick={() => openUrl(WING_SHOT_WEBSITE_URL)}
						>
							<span style={{ color: "var(--wing-shot-purple-color)" }}>
								{intl.formatMessage({ id: "about.title" })}
							</span>
						</Badge>
					</Title>
					<div>
						<Text type="secondary">
							{intl.formatMessage({ id: "about.subtitle" })}
						</Text>
					</div>
					<Space wrap size={0} style={{ marginTop: token.margin }}>
						<Tooltip title={commitSha ? `Commit SHA: ${commitSha}` : undefined}>
							<Tag color="blue" variant="outlined">
								<a
									style={{ color: token.colorLink, cursor: "pointer" }}
									onClick={handleCheckUpdate}
								>
									{checkingUpdate
										? intl.formatMessage({ id: "about.update.checking" })
										: `${intl.formatMessage({ id: "about.version" })} ${version}`}
								</a>
							</Tag>
						</Tooltip>
						<Tag color="green" variant="outlined">
							<a
								style={{ color: token.colorLink }}
								onClick={() => openUrl("https://github.com/anfioo")}
							>
								{intl.formatMessage({ id: "about.author" })}
							</a>
						</Tag>
						<Tag color="purple" variant="outlined">
							<a
								style={{ color: token.colorLink }}
								onClick={() => openUrl(WING_SHOT_GITHUB_RELEASES_URL)}
							>
								{intl.formatMessage({ id: "about.basedOn" })}
							</a>
						</Tag>
					</Space>
				</div>

				<Divider />

				{/* 开源协议 */}
				<div style={{ marginBottom: token.marginLG }}>
					<Title level={3}>
						{intl.formatMessage({ id: "about.license.title" })}
					</Title>
					<Paragraph>
						{intl.formatMessage({ id: "about.license.description" })}
					</Paragraph>
					<ul>
						<li>
							<strong>
								{intl.formatMessage({ id: "about.license.nonCommercial" })}
							</strong>
							<a
								onClick={() =>
									openUrl("https://www.apache.org/licenses/LICENSE-2.0")
								}
							>
								{intl.formatMessage({ id: "about.license.nonCommercialType" })}
							</a>
						</li>
						<li>
							<strong>
								{intl.formatMessage({ id: "about.license.commercial" })}
							</strong>
							<a
								onClick={() =>
									openUrl("https://www.gnu.org/licenses/gpl-3.0.html")
								}
							>
								{intl.formatMessage({ id: "about.license.commercialType" })}
							</a>
						</li>
					</ul>
				</div>

				{/* 联系方式 */}
				<div style={{ marginBottom: token.marginLG }}>
					<Title level={3}>
						{intl.formatMessage({ id: "about.contact.title" })}
					</Title>
					<Space orientation="vertical" style={{ width: "100%" }}>
						<Button
							type="primary"
							icon={<GithubOutlined />}
							onClick={() =>
								openUrl("https://github.com/Anfioo/WingShot/issues")
							}
							block
						>
							{intl.formatMessage({ id: "about.contact.github" })}
						</Button>
						<Button
							icon={<MessageOutlined />}
							onClick={() =>
								openUrl("https://space.bilibili.com/3546897042114689")
							}
							block
						>
							{intl.formatMessage({ id: "about.contact.bilibili" })}
						</Button>
						<Button
							icon={<MailOutlined />}
							onClick={() => openUrl("mailto:anfioo@wingshot.anfioo.com")}
							block
						>
							{intl.formatMessage({ id: "about.contact.email" })}
						</Button>
						<Button
							icon={<QqOutlined />}
							onClick={() => openUrl("https://qm.qq.com/q/w9B2gLdoYg")}
							block
						>
							{intl.formatMessage({ id: "about.contact.qqGroup" })}
						</Button>
					</Space>
				</div>
			</div>
		</>
	);
};
