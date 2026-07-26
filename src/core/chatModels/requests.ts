import { fetch } from "@tauri-apps/plugin-http";
import type { ChatModelAdapterConfig } from "@/types/appSettings";
import { appError } from "@/utils/log";
import { OPENAI_ENDPOINT_CUSTOM, OPENAI_ENDPOINT_RESPONSES } from "./schema";

export const REQUEST_TIMEOUT_MS = 30_000;

type TextContentBlock = {
	type: "text";
	text: string;
};

type ImageURLContentBlock = {
	type: "image_url";
	image_url: { url: string };
};

type ChatModelContentBlock = TextContentBlock | ImageURLContentBlock;

export type ChatModelRequestMessage = {
	role: "system" | "user" | "assistant";
	content: string | ChatModelContentBlock[];
};

export type ChatModelRequestOptions = {
	messages: ChatModelRequestMessage[];
	model?: string;
	stream?: boolean;
	temperature?: number;
	maxTokens?: number;
	enableThinking?: boolean;
	thinkingBudgetTokens?: number;
};

export type ChatModelTextStreamCallbacks = {
	onText: (text: string) => void;
};

export const createAbortSignal = (ms: number = REQUEST_TIMEOUT_MS) => {
	const controller = new AbortController();
	setTimeout(
		() => controller.abort(new DOMException("请求超时", "TimeoutError")),
		ms,
	);
	return controller.signal;
};

const parseJsonObject = (value: string) => {
	try {
		const parsed = JSON.parse(value);
		return parsed && typeof parsed === "object" && !Array.isArray(parsed)
			? (parsed as Record<string, unknown>)
			: {};
	} catch {
		return {};
	}
};

export const buildChatModelHeaders = (adapter: ChatModelAdapterConfig) => {
	const customHeaders = adapter.customHeadersEnabled
		? parseJsonObject(adapter.customHeadersJSON)
		: {};
	const headers: Record<string, string> = {};
	for (const [key, value] of Object.entries(customHeaders)) {
		if (typeof value === "string") headers[key] = value;
	}
	return headers;
};

const splitURLSuffix = (url: string) => {
	const hashIndex = url.indexOf("#");
	const queryIndex = url.indexOf("?");
	const suffixStart =
		hashIndex >= 0 ? hashIndex : queryIndex >= 0 ? queryIndex : url.length;
	return { path: url.slice(0, suffixStart), suffix: url.slice(suffixStart) };
};

const lastPathSegment = (url: string) => {
	const { path } = splitURLSuffix(url);
	const segments = path.replace(/\/+$/, "").split("/");
	return segments[segments.length - 1] ?? "";
};

const isVersionSegment = (segment: string) =>
	/^v\d+$/i.test(segment) || segment === "beta";

const versionedBaseURL = (baseURL: string) => {
	const { path, suffix } = splitURLSuffix(baseURL);
	const last = lastPathSegment(path);
	if (isVersionSegment(last)) return baseURL;
	return `${path.replace(/\/+$/, "")}/v1${suffix}`;
};

const _unversionedBaseURL = (baseURL: string) => {
	const { path, suffix } = splitURLSuffix(baseURL);
	const last = lastPathSegment(path);
	if (isVersionSegment(last)) {
		const segments = path.replace(/\/+$/, "").split("/");
		segments.pop();
		return `${segments.join("/")}${suffix}`;
	}
	return baseURL;
};

const appendURLPath = (baseURL: string, path: string) => {
	if (/^https?:\/\//i.test(path)) return path;
	const { path: basePath, suffix } = splitURLSuffix(baseURL);
	const cleanBase = basePath.replace(/\/+$/, "");
	const cleanPath = path.replace(/^\/+/, "");
	return `${cleanBase}/${cleanPath}${suffix}`;
};

export const joinModelURL = (baseURL: string, path: string) => {
	if (/^https?:\/\//i.test(path)) return path;
	const { path: basePath, suffix } = splitURLSuffix(baseURL);
	const cleanBase = basePath.replace(/\/+$/, "");
	const cleanPath = path.replace(/^\/+/, "");
	return `${cleanBase}/${cleanPath}${suffix}`;
};

const joinOpenAIEndpoint = (baseURL: string, endpoint: string) => {
	const base = baseURL.replace(/\/+$/, "");
	if (/\/v1$/i.test(base) && endpoint.startsWith("/v1/")) {
		return `${base}${endpoint.slice("/v1".length)}`;
	}
	return joinModelURL(base, endpoint);
};

export const getOpenAIAdapterEndpoint = (adapter: ChatModelAdapterConfig) => {
	const baseURL = adapter.baseURL.replace(/\/+$/, "");
	if (/\/(chat\/completions|responses)$/i.test(baseURL)) return baseURL;
	return adapter.openAIEndpoint === OPENAI_ENDPOINT_CUSTOM
		? adapter.baseURL
		: joinOpenAIEndpoint(adapter.baseURL, adapter.openAIEndpoint);
};

export const getAnthropicAdapterEndpoint = (adapter: ChatModelAdapterConfig) =>
	appendURLPath(versionedBaseURL(adapter.baseURL), "/messages");

export const getSnowShotAdapterEndpoint = (adapter: ChatModelAdapterConfig) => {
	const baseURL = adapter.baseURL.replace(/\/+$/, "");
	if (/\/api\/v1\/chat\/completions$/i.test(baseURL)) return baseURL;
	if (/\/api\/v1\/chat\/models$/i.test(baseURL)) {
		return baseURL.replace(/\/models$/i, "/completions");
	}
	if (/\/api\/v1$/i.test(baseURL))
		return appendURLPath(baseURL, "/chat/completions");
	return appendURLPath(baseURL, "/api/v1/chat/completions");
};

export const getChatModelEndpoint = (adapter: ChatModelAdapterConfig) => {
	if (adapter.type === "anthropic") return getAnthropicAdapterEndpoint(adapter);
	if (adapter.type === "snowshot") return getSnowShotAdapterEndpoint(adapter);
	return getOpenAIAdapterEndpoint(adapter);
};

export const getChatModelModelsURL = (adapter: ChatModelAdapterConfig) => {
	if (adapter.type === "snowshot") {
		const baseURL = adapter.baseURL.replace(/\/+$/, "");
		if (/\/api\/v1\/chat\/models$/i.test(baseURL)) return baseURL;
		if (/\/api\/v1\/chat\/completions$/i.test(baseURL)) {
			return baseURL.replace(/\/completions$/i, "/models");
		}
		if (/\/api\/v1$/i.test(baseURL))
			return appendURLPath(baseURL, "/chat/models");
		return appendURLPath(baseURL, "/api/v1/chat/models");
	}

	const baseURL = adapter.baseURL.replace(/\/+$/, "");
	if (/\/chat\/completions$/i.test(baseURL)) {
		return baseURL.replace(/\/chat\/completions$/i, "/models");
	}
	if (/\/responses$/i.test(baseURL)) {
		return baseURL.replace(/\/responses$/i, "/models");
	}
	if (/\/v1\/?$/i.test(baseURL)) {
		return `${baseURL.replace(/\/+$/, "")}/models`;
	}
	const versioned = versionedBaseURL(adapter.baseURL);
	return appendURLPath(versioned, "/models");
};

export const getChatModelRequestHeaders = (adapter: ChatModelAdapterConfig) => {
	const customHeaders = buildChatModelHeaders(adapter);
	if (adapter.type === "anthropic") {
		return {
			"Content-Type": "application/json",
			...(adapter.apiKey ? { "x-api-key": adapter.apiKey } : {}),
			"anthropic-version": "2023-06-01",
			...customHeaders,
		};
	}

	if (adapter.type === "snowshot") {
		return {
			"Content-Type": "application/json",
			"Accept-Language": window.__APP_ACCEPT_LANGUAGE__,
			...(adapter.apiKey ? { Authorization: `Bearer ${adapter.apiKey}` } : {}),
			...customHeaders,
		};
	}

	return {
		"Content-Type": "application/json",
		...(adapter.apiKey ? { Authorization: `Bearer ${adapter.apiKey}` } : {}),
		...customHeaders,
	};
};

const parseDataURL = (value: string) => {
	const match = value.match(/^data:([^;,]+);base64,(.*)$/);
	return match
		? { mediaType: match[1], data: match[2] }
		: { mediaType: "image/webp", data: value };
};

const normalizeContentForAnthropic = (
	content: ChatModelRequestMessage["content"],
) => {
	if (typeof content === "string") return content;
	return content.map((block) => {
		if (block.type === "text") return block;
		const image = parseDataURL(block.image_url.url);
		return {
			type: "image",
			source: {
				type: "base64",
				media_type: image.mediaType,
				data: image.data,
			},
		};
	});
};

const normalizeMessagesForAnthropic = (messages: ChatModelRequestMessage[]) => {
	const systemText = messages
		.filter((item) => item.role === "system")
		.map((item) => (typeof item.content === "string" ? item.content : ""))
		.filter(Boolean)
		.join("\n\n");
	const anthropicMessages = messages
		.filter((item) => item.role !== "system")
		.map((item) => ({
			role: item.role === "assistant" ? "assistant" : "user",
			content: normalizeContentForAnthropic(item.content),
		}));
	return { systemText, anthropicMessages };
};

const anthropicThinkingBudgetByEffort = {
	low: 1024,
	medium: 4096,
	high: 8192,
	xhigh: 16_384,
	max: 32_768,
} as const;

const getAnthropicThinkingConfig = (
	adapter: ChatModelAdapterConfig,
	options: ChatModelRequestOptions,
) => {
	if (!options.enableThinking) return undefined;
	const requestedBudget =
		options.thinkingBudgetTokens ||
		anthropicThinkingBudgetByEffort[adapter.anthropicThinkingEffort] ||
		anthropicThinkingBudgetByEffort.medium;
	return {
		type: "enabled",
		budget_tokens: Math.max(1024, requestedBudget),
	};
};

const getAnthropicMaxTokens = (
	adapter: ChatModelAdapterConfig,
	options: ChatModelRequestOptions,
) => {
	const thinking = getAnthropicThinkingConfig(adapter, options);
	const requestedMaxTokens =
		adapter.anthropicMaxTokens || options.maxTokens || (thinking ? 4096 : 1024);
	return thinking
		? Math.max(requestedMaxTokens, thinking.budget_tokens + 1)
		: requestedMaxTokens;
};

const normalizeContentForOpenAIResponses = (
	content: ChatModelRequestMessage["content"],
) => {
	if (typeof content === "string") return content;
	return content.map((block) => {
		if (block.type === "text") {
			return { type: "input_text", text: block.text };
		}
		return { type: "input_image", image_url: block.image_url.url };
	});
};

const normalizeMessagesForOpenAIResponses = (
	messages: ChatModelRequestMessage[],
) =>
	messages.map((item) => ({
		role: item.role,
		content: normalizeContentForOpenAIResponses(item.content),
	}));

const buildSnowShotRequestBody = (
	adapter: ChatModelAdapterConfig,
	options: ChatModelRequestOptions,
) => ({
	messages: options.messages,
	model: options.model || adapter.modelID,
	...(options.temperature !== undefined
		? { temperature: options.temperature }
		: {}),
	...(options.maxTokens || adapter.maxCompletionTokens
		? { max_tokens: adapter.maxCompletionTokens || options.maxTokens }
		: {}),
	...(options.enableThinking ? { enable_thinking: true } : {}),
	stream_options: { include_usage: true },
	...(options.thinkingBudgetTokens
		? { thinking_budget: options.thinkingBudgetTokens }
		: {}),
	stream: options.stream ?? true,
});

export const buildChatModelRequestBody = (
	adapter: ChatModelAdapterConfig,
	options: ChatModelRequestOptions,
) => {
	if (adapter.type === "snowshot") {
		return buildSnowShotRequestBody(adapter, options);
	}

	if (adapter.type === "anthropic") {
		const extraParams = adapter.anthropicExtraParamsEnabled
			? parseJsonObject(adapter.anthropicExtraParamsJSON)
			: {};
		const { systemText, anthropicMessages } = normalizeMessagesForAnthropic(
			options.messages,
		);
		const thinking = getAnthropicThinkingConfig(adapter, options);
		return {
			model: options.model || adapter.modelID,
			messages: anthropicMessages,
			max_tokens: getAnthropicMaxTokens(adapter, options),
			stream: options.stream ?? true,
			...(systemText ? { system: systemText } : {}),
			...(options.temperature !== undefined && !thinking
				? { temperature: options.temperature }
				: {}),
			...(thinking ? { thinking } : {}),
			...extraParams,
		};
	}

	const extraParams = adapter.openAIExtraParamsEnabled
		? parseJsonObject(adapter.openAIExtraParamsJSON)
		: {};
	if (adapter.openAIEndpoint === OPENAI_ENDPOINT_RESPONSES) {
		return {
			model: options.model || adapter.modelID,
			input: normalizeMessagesForOpenAIResponses(options.messages),
			stream: options.stream ?? true,
			...(options.temperature !== undefined
				? { temperature: options.temperature }
				: {}),
			...(options.maxTokens || adapter.maxCompletionTokens
				? {
						max_output_tokens: adapter.maxCompletionTokens || options.maxTokens,
					}
				: {}),
			...(options.enableThinking
				? { reasoning: { effort: adapter.reasoningEffort } }
				: {}),
			...extraParams,
		};
	}
	return {
		model: options.model || adapter.modelID,
		messages: options.messages,
		stream: options.stream ?? true,
		...(options.temperature !== undefined
			? { temperature: options.temperature }
			: {}),
		...(options.maxTokens || adapter.maxCompletionTokens
			? { max_tokens: adapter.maxCompletionTokens || options.maxTokens }
			: {}),
		...(options.enableThinking
			? { reasoning: { effort: adapter.reasoningEffort } }
			: {}),
		...(options.thinkingBudgetTokens
			? { thinking_budget: options.thinkingBudgetTokens }
			: {}),
		...extraParams,
	};
};

const decodeTextStream = async (
	response: Response,
	adapter: ChatModelAdapterConfig,
	callbacks: ChatModelTextStreamCallbacks,
) => {
	if (!response.body) {
		const text = await response.text();
		callbacks.onText(text);
		return;
	}

	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		buffer += decoder.decode(value, { stream: true });
		const lines = buffer.split("\n");
		buffer = lines.pop() ?? "";
		for (const line of lines) {
			const text = line.trim();
			if (!text.startsWith("data:")) continue;
			const data = text.slice(5).trim();
			if (!data || data === "[DONE]") continue;
			try {
				const payload = JSON.parse(data);
				if (adapter.type === "anthropic") {
					if (payload.type === "content_block_delta") {
						callbacks.onText(
							payload.delta?.text ?? payload.delta?.thinking ?? "",
						);
					}
				} else {
					if (payload.type === "response.output_text.delta") {
						callbacks.onText(payload.delta ?? "");
						continue;
					}
					callbacks.onText(payload.choices?.[0]?.delta?.content ?? "");
				}
			} catch (error) {
				appError("[decodeTextStream] parse error", error);
			}
		}
	}
};

/**
 * 专用的流式请求函数，不使用 appFetch 以避免干扰 SSE 流式解析
 */
export const streamChatModelFetch = async (
	url: string,
	options: RequestInit,
	signal?: AbortSignal,
): Promise<Response> => {
	return fetch(url, {
		...options,
		signal: signal ?? createAbortSignal(),
	});
};

export const streamChatModelText = async (
	adapter: ChatModelAdapterConfig,
	options: ChatModelRequestOptions,
	callbacks: ChatModelTextStreamCallbacks,
	signal?: AbortSignal,
) => {
	const response = await streamChatModelFetch(
		getChatModelEndpoint(adapter),
		{
			method: "POST",
			headers: getChatModelRequestHeaders(adapter),
			body: JSON.stringify(buildChatModelRequestBody(adapter, options)),
		},
		signal,
	);
	if (!response.ok) {
		throw new Error(
			(await response.text()) ||
				`HTTP ${response.status}: ${response.statusText}`,
		);
	}
	await decodeTextStream(response, adapter, callbacks);
};

export const createVisionModelMessages = (params: {
	systemPrompt: string;
	imageBase64: string;
	format: "html" | "markdown";
}): ChatModelRequestMessage[] => [
	{
		role: "system",
		content: params.systemPrompt,
	},
	{
		role: "user",
		content: [
			{
				type: "image_url",
				image_url: { url: params.imageBase64 },
			},
			{
				type: "text",
				text: `Convert the image to ${params.format}`,
			},
		],
	},
];
