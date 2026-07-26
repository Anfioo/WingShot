import type {
	ChatApiConfig,
	ChatModelAdapterConfig,
	ChatModelOpenAIEndpoint,
	ChatModelProviderType,
	ChatModelReasoningEffort,
} from "@/types/appSettings";

export const OPENAI_ENDPOINT_RESPONSES: ChatModelOpenAIEndpoint =
	"/v1/responses";
export const OPENAI_ENDPOINT_CHAT_COMPLETIONS: ChatModelOpenAIEndpoint =
	"/v1/chat/completions";
export const OPENAI_ENDPOINT_CUSTOM: ChatModelOpenAIEndpoint = "/custom";

export const OPENAI_EXTRA_PARAMS_DEFAULT_JSON = `{
  "service_tier": "priority"
}`;
export const EXTRA_PARAMS_DEFAULT_JSON = `{
}`;
export const CUSTOM_HEADERS_DEFAULT_JSON = `{
}`;
export const DEFAULT_ANTHROPIC_THINKING_EFFORT: ChatModelReasoningEffort =
	"xhigh";

const supportedProviderTypes = new Set<ChatModelProviderType>([
	"openai",
	"anthropic",
	"snowshot",
]);
const supportedReasoningEfforts = new Set<ChatModelReasoningEffort>([
	"low",
	"medium",
	"high",
	"xhigh",
	"max",
]);
const supportedOpenAIEndpoints = new Set<ChatModelOpenAIEndpoint>([
	OPENAI_ENDPOINT_RESPONSES,
	OPENAI_ENDPOINT_CHAT_COMPLETIONS,
	OPENAI_ENDPOINT_CUSTOM,
]);

export const createChatModelAdapterId = () =>
	`model@${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

const asString = (value: unknown) => {
	if (typeof value === "string") return value.trim();
	if (typeof value === "number" || typeof value === "boolean") {
		return `${value}`.trim();
	}
	return "";
};

const asBoolean = (value: unknown, fallback = false) => {
	if (typeof value === "boolean") return value;
	if (typeof value === "number") return value !== 0;
	const text = asString(value).toLowerCase();
	if (!text) return fallback;
	return text === "true" || text === "1" || text === "yes";
};

const asPositiveInteger = (value: unknown) => {
	const text = asString(value);
	if (!/^\d+$/.test(text)) return 0;
	const parsed = Number(text);
	return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
};

export const normalizeBaseURL = (value: unknown) => {
	const text = asString(value);
	if (!text) return "";
	try {
		const parsed = new URL(text);
		if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
		parsed.protocol = parsed.protocol.toLowerCase();
		parsed.hostname = parsed.hostname.toLowerCase();
		return parsed.toString().replace(/\/+$/, "");
	} catch {
		return text.replace(/\/+$/, "");
	}
};

export const normalizeOpenAIEndpoint = (
	value: unknown,
): ChatModelOpenAIEndpoint => {
	const text = asString(value).toLowerCase() as ChatModelOpenAIEndpoint;
	return supportedOpenAIEndpoints.has(text)
		? text
		: OPENAI_ENDPOINT_CHAT_COMPLETIONS;
};

const normalizeProviderType = (value: unknown): ChatModelProviderType => {
	const text = asString(value).toLowerCase() as ChatModelProviderType;
	return supportedProviderTypes.has(text) ? text : "openai";
};

const normalizeReasoningEffort = (
	value: unknown,
	fallback: ChatModelReasoningEffort,
): ChatModelReasoningEffort => {
	const text = asString(value).toLowerCase() as ChatModelReasoningEffort;
	return supportedReasoningEfforts.has(text) ? text : fallback;
};

const getDefaultBaseURL = (type: ChatModelProviderType) => {
	if (type === "anthropic") return "https://api.anthropic.com";
	if (type === "snowshot") return "https://snowshot.top";
	return "https://api.openai.com/v1";
};

export const createEmptyChatModelAdapter = (
	type: ChatModelProviderType = "openai",
): ChatModelAdapterConfig => ({
	id: createChatModelAdapterId(),
	displayName: "",
	type,
	baseURL: getDefaultBaseURL(type),
	apiKey: "",
	modelID: "",
	tooltipData: "备注",
	supportThinking: false,
	supportVision: false,
	supportImageInput: false,
	contextWindowTokens: 0,
	openAIEndpoint: OPENAI_ENDPOINT_CHAT_COMPLETIONS,
	reasoningEffort: "medium",
	maxCompletionTokens: 0,
	openAIExtraParamsEnabled: false,
	openAIExtraParamsJSON: OPENAI_EXTRA_PARAMS_DEFAULT_JSON,
	anthropicMaxTokens: 0,
	anthropicThinkingEffort: DEFAULT_ANTHROPIC_THINKING_EFFORT,
	anthropicExtraParamsEnabled: false,
	anthropicExtraParamsJSON: EXTRA_PARAMS_DEFAULT_JSON,
	customHeadersEnabled: false,
	customHeadersJSON: CUSTOM_HEADERS_DEFAULT_JSON,
});

export const normalizeChatModelAdapter = (
	source: Partial<ChatModelAdapterConfig> | Record<string, unknown> | undefined,
): ChatModelAdapterConfig => {
	const raw: Record<string, unknown> =
		source && typeof source === "object" ? source : {};
	const type = normalizeProviderType(raw.type);
	const empty = createEmptyChatModelAdapter(type);
	return {
		...empty,
		id: asString(raw.id) || empty.id,
		displayName: asString(raw.displayName ?? raw.name),
		type,
		baseURL: normalizeBaseURL(raw.baseURL ?? raw.url),
		apiKey: asString(raw.apiKey ?? raw.key),
		modelID: asString(raw.modelID ?? raw.api_model),
		tooltipData: asString(raw.tooltipData) || "备注",
		supportThinking: asBoolean(raw.supportThinking ?? raw.support_thinking),
		supportVision: asBoolean(raw.supportVision ?? raw.support_vision),
		supportImageInput: asBoolean(
			raw.supportImageInput ?? raw.support_image_input,
		),
		contextWindowTokens: asPositiveInteger(raw.contextWindowTokens),
		openAIEndpoint:
			type === "openai"
				? normalizeOpenAIEndpoint(raw.openAIEndpoint ?? raw.endpoint)
				: OPENAI_ENDPOINT_CHAT_COMPLETIONS,
		reasoningEffort: normalizeReasoningEffort(raw.reasoningEffort, "medium"),
		maxCompletionTokens: asPositiveInteger(raw.maxCompletionTokens),
		openAIExtraParamsEnabled:
			type === "openai" && asBoolean(raw.openAIExtraParamsEnabled),
		openAIExtraParamsJSON:
			asString(raw.openAIExtraParamsJSON) || OPENAI_EXTRA_PARAMS_DEFAULT_JSON,
		anthropicMaxTokens: asPositiveInteger(raw.anthropicMaxTokens),
		anthropicThinkingEffort: normalizeReasoningEffort(
			raw.anthropicThinkingEffort,
			DEFAULT_ANTHROPIC_THINKING_EFFORT,
		),
		anthropicExtraParamsEnabled:
			type === "anthropic" && asBoolean(raw.anthropicExtraParamsEnabled),
		anthropicExtraParamsJSON:
			asString(raw.anthropicExtraParamsJSON) || EXTRA_PARAMS_DEFAULT_JSON,
		customHeadersEnabled: asBoolean(raw.customHeadersEnabled),
		customHeadersJSON:
			asString(raw.customHeadersJSON) || CUSTOM_HEADERS_DEFAULT_JSON,
	};
};

export const migrateChatApiConfigToModelAdapter = (
	config: ChatApiConfig,
): ChatModelAdapterConfig =>
	normalizeChatModelAdapter({
		id: createChatModelAdapterId(),
		displayName: config.model_name,
		type: "openai",
		baseURL: config.api_uri,
		apiKey: config.api_key,
		modelID: config.api_model,
		supportThinking: config.support_thinking,
		supportVision: config.support_vision ?? false,
		supportImageInput: false,
		openAIEndpoint: OPENAI_ENDPOINT_CHAT_COMPLETIONS,
	});

const validateJSONObject = (value: string, label: string) => {
	if (!value.trim()) return `${label}不能为空`;
	try {
		const parsed = JSON.parse(value);
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
			return `${label}必须是 JSON 对象`;
		}
	} catch {
		return `${label}必须是合法 JSON 对象`;
	}
	return "";
};

export const validateChatModelAdapter = (adapter: ChatModelAdapterConfig) => {
	if (!adapter.displayName) return "显示名称不能为空";
	if (!adapter.modelID) return "模型标识不能为空";
	if (!adapter.baseURL) return "接口地址不能为空";
	if (adapter.openAIExtraParamsEnabled) {
		const error = validateJSONObject(
			adapter.openAIExtraParamsJSON,
			"OpenAI 额外参数 JSON",
		);
		if (error) return error;
	}
	if (adapter.anthropicExtraParamsEnabled) {
		const error = validateJSONObject(
			adapter.anthropicExtraParamsJSON,
			"Anthropic 额外参数 JSON",
		);
		if (error) return error;
	}
	if (adapter.customHeadersEnabled) {
		const error = validateJSONObject(
			adapter.customHeadersJSON,
			"自定义请求头 JSON",
		);
		if (error) return error;
		const headers = JSON.parse(adapter.customHeadersJSON) as Record<
			string,
			unknown
		>;
		for (const [key, value] of Object.entries(headers)) {
			if (!key.trim()) return "自定义请求头名称不能为空";
			if (typeof value !== "string")
				return `自定义请求头 ${key} 的值必须是字符串`;
		}
	}
	return "";
};

export const maskSecret = (value: string) => {
	const text = value.trim();
	if (!text) return "-";
	if (text.length <= 8)
		return `${"*".repeat(Math.max(text.length - 2, 0))}${text.slice(-2)}`;
	return `${text.slice(0, 4)}****${text.slice(-4)}`;
};

export const formatHost = (value: string) => {
	const text = value.trim();
	if (!text) return "-";
	try {
		const parsed = new URL(text);
		return parsed.host || text;
	} catch {
		return text.replace(/^https?:\/\//, "");
	}
};

export const getModelAdapterDisplayName = (adapter: ChatModelAdapterConfig) =>
	adapter.displayName || adapter.modelID || "模型";
