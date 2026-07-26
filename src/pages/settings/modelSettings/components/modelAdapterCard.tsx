import { Button, Flex, Typography, theme } from "antd";
import { useMemo } from "react";
import type { ChatModelTestResult } from "@/core/chatModels";
import {
	formatHost,
	getModelAdapterDisplayName,
	getProviderLabel,
	maskSecret,
} from "@/core/chatModels";
import type { ChatModelAdapterConfig } from "@/types/appSettings";
import { ModelAdapterTestCard } from "./modelAdapterTestCard";

const { Text } = Typography;

const ProviderBadge: React.FC<{ type: ChatModelAdapterConfig["type"] }> = ({
	type,
}) => {
	const { token } = theme.useToken();
	return (
		<span
			style={{
				display: "inline-flex",
				alignItems: "center",
				gap: 4,
				borderRadius: 999,
				border: `1px solid ${token.colorBorderSecondary}`,
				padding: "4px 7px",
				fontSize: 11,
				fontWeight: 500,
				color: token.colorTextSecondary,
				lineHeight: 1,
				whiteSpace: "nowrap",
				flexShrink: 0,
			}}
		>
			{getProviderLabel(type)}
		</span>
	);
};

export const ModelAdapterCard: React.FC<{
	adapter: ChatModelAdapterConfig;
	testResult?: ChatModelTestResult;
	testing?: boolean;
	disabled?: boolean;
	onTest: () => void;
	onEdit: () => void;
	onDuplicate: () => void;
	onDelete: () => void;
}> = ({
	adapter,
	testResult,
	testing,
	disabled,
	onTest,
	onEdit,
	onDuplicate,
	onDelete,
}) => {
	const { token } = theme.useToken();
	return (
		<div
			style={{
				borderRadius: 8,
				padding: 1,
				background: `linear-gradient(to bottom, ${token.colorBorderSecondary} 0%, ${token.colorBorder} 10px, ${token.colorBorder} 100%)`,
			}}
		>
			<div
				style={{
					borderRadius: 7,
					background: token.colorBgElevated,
					padding: 16,
					height: "100%",
				}}
			>
				<Flex
					vertical
					justify="space-between"
					gap={12}
					style={{ minHeight: 180 }}
				>
					<Flex vertical gap={10}>
						<Flex justify="space-between" align="flex-start" gap={12}>
							<div style={{ minWidth: 0, flex: 1 }}>
								<Text
									strong
									ellipsis
									style={{ display: "block", fontSize: 16, lineHeight: 1.3 }}
								>
									{getModelAdapterDisplayName(adapter)}
								</Text>
								<Text
									type="secondary"
									ellipsis
									style={{ display: "block", marginTop: 4 }}
								>
									{adapter.modelID}
								</Text>
								{adapter.type === "openai" ? (
									<Text
										type="secondary"
										style={{ fontSize: 12, marginTop: 2, display: "block" }}
									>
										{adapter.openAIEndpoint}
									</Text>
								) : null}
							</div>
							<ProviderBadge type={adapter.type} />
						</Flex>

						<div
							style={{
								display: "grid",
								gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
								gap: 8,
							}}
						>
							<div
								style={{
									borderRadius: 8,
									background: token.colorFillTertiary,
									padding: "8px 12px",
								}}
							>
								<div
									style={{
										fontSize: 11,
										textTransform: "uppercase",
										letterSpacing: "0.08em",
										color: token.colorTextTertiary,
										marginBottom: 4,
									}}
								>
									Host
								</div>
								<Text
									ellipsis
									style={{ display: "block", color: token.colorTextSecondary }}
									title={adapter.baseURL}
								>
									{formatHost(adapter.baseURL)}
								</Text>
							</div>
							<div
								style={{
									borderRadius: 8,
									background: token.colorFillTertiary,
									padding: "8px 12px",
								}}
							>
								<div
									style={{
										fontSize: 11,
										textTransform: "uppercase",
										letterSpacing: "0.08em",
										color: token.colorTextTertiary,
										marginBottom: 4,
									}}
								>
									API Key
								</div>
								<Text ellipsis style={{ display: "block" }}>
									{maskSecret(adapter.apiKey)}
								</Text>
							</div>
						</div>

						<ModelAdapterTestCard
							compact
							result={
								testing
									? { status: "running", summaryText: "测试中..." }
									: testResult
							}
						/>
					</Flex>

					<Flex
						wrap
						justify="end"
						gap={8}
						style={{
							borderTop: `1px solid ${token.colorBorderSecondary}`,
							paddingTop: 12,
						}}
					>
						<Button
							size="small"
							onClick={onTest}
							loading={testing}
							disabled={testing || disabled}
						>
							{testing ? "测试中..." : "测试"}
						</Button>
						<Button size="small" onClick={onEdit} disabled={disabled}>
							编辑
						</Button>
						<Button size="small" onClick={onDuplicate} disabled={disabled}>
							复制
						</Button>
						<Button
							size="small"
							danger
							type="text"
							onClick={onDelete}
							disabled={disabled}
						>
							删除
						</Button>
					</Flex>
				</Flex>
			</div>
		</div>
	);
};

export const ModelAdapterGrid: React.FC<{
	adapters: ChatModelAdapterConfig[];
	testResults: Record<string, ChatModelTestResult | undefined>;
	testingIds: Set<string>;
	disabled?: boolean;
	onTest: (adapter: ChatModelAdapterConfig) => void;
	onEdit: (adapter: ChatModelAdapterConfig) => void;
	onDuplicate: (adapter: ChatModelAdapterConfig) => void;
	onDelete: (adapter: ChatModelAdapterConfig) => void;
	providerLabel: string;
}> = ({
	adapters,
	testResults,
	testingIds,
	disabled,
	onTest,
	onEdit,
	onDuplicate,
	onDelete,
	providerLabel,
}) => {
	const { token } = theme.useToken();
	const gridStyle = useMemo(
		() => ({
			display: "grid",
			gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
			gap: 12,
		}),
		[],
	);

	if (adapters.length === 0) {
		return (
			<div
				style={{
					minHeight: 220,
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					border: `1px dashed ${token.colorBorder}`,
					borderRadius: token.borderRadiusLG,
					padding: "0 16px",
				}}
			>
				<Text type="secondary" style={{ fontSize: 14 }}>
					当前还没有配置任何 {providerLabel} 模型。
				</Text>
			</div>
		);
	}

	return (
		<div style={gridStyle}>
			{adapters.map((adapter) => (
				<ModelAdapterCard
					key={adapter.id}
					adapter={adapter}
					testResult={testResults[adapter.id]}
					testing={testingIds.has(adapter.id)}
					disabled={disabled}
					onTest={() => onTest(adapter)}
					onEdit={() => onEdit(adapter)}
					onDuplicate={() => onDuplicate(adapter)}
					onDelete={() => onDelete(adapter)}
				/>
			))}
		</div>
	);
};
