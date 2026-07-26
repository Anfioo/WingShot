import { fetch } from "@tauri-apps/plugin-http";
import type { ChatModelAdapterConfig } from "@/types/appSettings";
import {
	createAbortSignal,
	getChatModelModelsURL,
	getChatModelRequestHeaders,
	REQUEST_TIMEOUT_MS,
} from "./requests";

type ProviderModelItem = {
	id?: unknown;
	model?: unknown;
	name?: unknown;
	display_name?: unknown;
	thinking?: unknown;
	support_vision?: unknown;
	supportVision?: unknown;
};

const toModelText = (value: unknown) =>
	typeof value === "string" || typeof value === "number" ? `${value}` : "";

const toModelBoolean = (value: unknown) => {
	if (typeof value === "boolean") return value;
	if (typeof value === "number") return value !== 0;
	if (typeof value === "string") {
		const text = value.trim().toLowerCase();
		return text === "true" || text === "1" || text === "yes";
	}
	return false;
};

const normalizeProviderModelItems = (payload: unknown): ProviderModelItem[] => {
	if (Array.isArray(payload)) return payload;
	if (!payload || typeof payload !== "object") return [];
	const record = payload as Record<string, unknown>;
	if (Array.isArray(record.data)) return record.data as ProviderModelItem[];
	if (Array.isArray(record.models)) return record.models as ProviderModelItem[];
	return [];
};

export const parseProviderModelIds = (
	payload: unknown,
	maxCount = 2000,
): {
	model: string;
	name: string;
	thinking: boolean;
	supportVision: boolean;
}[] => {
	const items = normalizeProviderModelItems(payload);
	const seen = new Set<string>();
	const result: {
		model: string;
		name: string;
		thinking: boolean;
		supportVision: boolean;
	}[] = [];
	for (const item of items.slice(0, maxCount)) {
		const model = toModelText(item.id ?? item.model);
		if (!model || seen.has(model)) continue;
		seen.add(model);
		const name = toModelText(item.display_name ?? item.name) || model;
		result.push({
			model,
			name,
			thinking: toModelBoolean(item.thinking),
			supportVision: toModelBoolean(item.support_vision ?? item.supportVision),
		});
	}
	return result;
};

export const getProviderChatModelOptions = async (
	adapter: ChatModelAdapterConfig,
) => {
	if (!adapter.baseURL) return [];
	const url = getChatModelModelsURL(adapter);
	const abortSignal = createAbortSignal(REQUEST_TIMEOUT_MS);

	try {
		const response = await fetch(url, {
			method: "GET",
			headers: {
				Accept: "application/json",
				...getChatModelRequestHeaders(adapter),
			},
			signal: abortSignal,
		});

		const text = await response.text();
		if (!response.ok) {
			throw new Error(
				text || `HTTP ${response.status}: ${response.statusText}`,
			);
		}

		let payload: unknown;
		try {
			payload = text ? JSON.parse(text) : undefined;
		} catch {
			throw new Error("响应格式错误，无法解析 JSON");
		}

		const models = parseProviderModelIds(payload);
		if (models.length === 0) {
			throw new Error("未获取到模型列表，请检查接口地址和访问密钥是否正确");
		}

		return models.map((item) => ({
			label: item.name,
			value: item.model,
			model: item.model,
			name: item.name,
			thinking: item.thinking,
			supportVision: item.supportVision,
		}));
	} catch (error) {
		if (error instanceof Error) {
			if (error.name === "AbortError") {
				throw new Error(
					`请求超时 (${REQUEST_TIMEOUT_MS / 1000}秒)，请检查网络连接`,
				);
			}
			throw error;
		}
		throw new Error(`获取模型列表失败: ${error}`);
	}
};
