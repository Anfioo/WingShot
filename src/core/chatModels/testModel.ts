import { fetch } from "@tauri-apps/plugin-http";
import type { ChatModelAdapterConfig } from "@/types/appSettings";
import { appError } from "@/utils/log";
import {
	buildChatModelRequestBody,
	createAbortSignal,
	getChatModelEndpoint,
	getChatModelRequestHeaders,
	REQUEST_TIMEOUT_MS,
} from "./requests";
import { validateChatModelAdapter } from "./schema";

export type ChatModelTestResult = {
	status: "idle" | "running" | "success" | "error";
	summaryText: string;
	error?: string;
	rawResponse?: string;
	totalDurationMS?: number;
};

const testModel = async (adapter: ChatModelAdapterConfig) => {
	const endpoint = getChatModelEndpoint(adapter);
	const abortSignal = createAbortSignal(REQUEST_TIMEOUT_MS);
	const response = await fetch(endpoint, {
		method: "POST",
		headers: getChatModelRequestHeaders(adapter),
		body: JSON.stringify(
			buildChatModelRequestBody(adapter, {
				messages: [{ role: "user", content: 'Say "Hello, world!"' }],
				stream: false,
				maxTokens: 256,
			}),
		),
		signal: abortSignal,
	});
	const text = await response.text();
	if (!response.ok) {
		throw new Error(
			text
				? `请求失败 (${response.status}): ${text.slice(0, 500)}`
				: `HTTP ${response.status}: ${response.statusText}`,
		);
	}
	return text;
};

export const testChatModelAdapter = async (
	adapter: ChatModelAdapterConfig,
): Promise<ChatModelTestResult> => {
	const validationError = validateChatModelAdapter(adapter);
	if (validationError) {
		return {
			status: "error",
			summaryText: validationError,
			error: validationError,
		};
	}
	const startedAt = Date.now();
	try {
		const rawResponse = await testModel(adapter);
		return {
			status: "success",
			summaryText: `测试成功，耗时 ${Date.now() - startedAt}ms`,
			rawResponse,
			totalDurationMS: Date.now() - startedAt,
		};
	} catch (error) {
		appError("[testChatModelAdapter] error", error);
		const message =
			error instanceof Error
				? error.name === "TimeoutError"
					? `请求超时 (${REQUEST_TIMEOUT_MS / 1000}秒)`
					: error.message
				: `${error}`;
		return {
			status: "error",
			summaryText: message || "模型测试失败",
			error: message,
			rawResponse: message,
			totalDurationMS: Date.now() - startedAt,
		};
	}
};
