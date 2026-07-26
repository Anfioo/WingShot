import { Tooltip, Typography, theme } from "antd";
import type { ChatModelTestResult } from "@/core/chatModels";

const { Text } = Typography;

export const ModelAdapterTestCard: React.FC<{
	result?: ChatModelTestResult;
	compact?: boolean;
}> = ({ result, compact }) => {
	const { token } = theme.useToken();
	const status = result?.status ?? "idle";

	const getStatusColors = () => {
		switch (status) {
			case "running":
				return {
					bg: token.colorInfoBg,
					border: token.colorInfoBorder,
					text: token.colorInfo,
				};
			case "success":
				return {
					bg: token.colorSuccessBg,
					border: token.colorSuccessBorder,
					text: token.colorSuccess,
				};
			case "error":
				return {
					bg: token.colorErrorBg,
					border: token.colorErrorBorder,
					text: token.colorError,
				};
			default:
				return {
					bg: token.colorFillQuaternary,
					border: token.colorBorderSecondary,
					text: token.colorTextTertiary,
				};
		}
	};

	const colors = getStatusColors();
	const summary =
		result?.summaryText || (status === "running" ? "测试中..." : "尚未测试");

	return (
		<div
			style={{
				borderRadius: 8,
				border: `1px solid ${colors.border}`,
				background: colors.bg,
				padding: "8px 12px",
			}}
		>
			<div
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					gap: 8,
				}}
			>
				<Text
					style={{
						fontSize: compact ? 11 : 14,
						fontWeight: compact ? 500 : 600,
						textTransform: compact ? "uppercase" : undefined,
						letterSpacing: compact ? "0.08em" : undefined,
						color: compact ? token.colorTextTertiary : token.colorText,
						lineHeight: 1,
					}}
				>
					{compact ? "测试" : "模型测试"}
				</Text>
				<span
					style={{
						display: "inline-flex",
						alignItems: "center",
						borderRadius: 999,
						border: `1px solid ${colors.border}`,
						padding: "2px 6px",
						fontSize: 11,
						color: colors.text,
						lineHeight: 1.3,
					}}
				>
					{status === "running"
						? "进行中"
						: status === "success"
							? "成功"
							: status === "error"
								? "失败"
								: "未测试"}
				</span>
			</div>
			<Tooltip title={result?.rawResponse || result?.error}>
				<Text
					ellipsis
					style={{
						display: "block",
						marginTop: 4,
						fontSize: 13,
						color: colors.text,
						lineHeight: 1.4,
					}}
				>
					{summary}
				</Text>
			</Tooltip>
		</div>
	);
};
