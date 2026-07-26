import type { ChatModelProviderType } from "@/types/appSettings";
import {
	OPENAI_ENDPOINT_CHAT_COMPLETIONS,
	OPENAI_ENDPOINT_CUSTOM,
	OPENAI_ENDPOINT_RESPONSES,
} from "./schema";

export const chatModelProviderTabs: {
	label: string;
	value: ChatModelProviderType;
}[] = [
	{ label: "OpenAI", value: "openai" },
	{ label: "Anthropic", value: "anthropic" },
	{ label: "Snow Shot API", value: "snowshot" },
];

export const reasoningEffortOptions = [
	{ label: "低", value: "low" },
	{ label: "中", value: "medium" },
	{ label: "高", value: "high" },
	{ label: "极高", value: "xhigh" },
	{ label: "最高", value: "max" },
];

export const openAIEndpointOptions = [
	{ label: "/v1/responses", value: OPENAI_ENDPOINT_RESPONSES },
	{ label: "/v1/chat/completions", value: OPENAI_ENDPOINT_CHAT_COMPLETIONS },
	{ label: "自定义路径", value: OPENAI_ENDPOINT_CUSTOM },
];

export const getProviderLabel = (type: ChatModelProviderType) => {
	if (type === "anthropic") return "Anthropic";
	if (type === "snowshot") return "Snow Shot API";
	return "OpenAI";
};
