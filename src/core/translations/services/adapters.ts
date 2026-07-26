import { fetch } from "@tauri-apps/plugin-http";
import {
	translateTextCustomWithLimits,
	translateTextDeepL,
	translateTextGoogle,
	translateTextMicrosoft,
} from "@/services/tools/translation";
import {
	TranslationApiType,
	type TranslationServiceConfig,
	type TranslationServiceInstance,
	TranslationServiceType,
} from "@/types/appSettings";
import type { TranslationDomain } from "@/types/servies/translation";
import {
	mapDeepLSourceLanguage,
	mapDeepLTargetLanguage,
	mapTranslationLanguage,
} from "./language";

export type TranslationAdapterParams = {
	service: TranslationServiceInstance;
	sourceContent: string[];
	sourceLanguage: string;
	targetLanguage: string;
	domain: TranslationDomain;
};

export type TranslationAdapterResult = { content: string }[];

type TranslationAdapter = (
	params: TranslationAdapterParams,
) => Promise<TranslationAdapterResult>;

const assertText = (value: unknown, serviceName: string) => {
	if (typeof value !== "string" || value.trim() === "") {
		throw new Error(`${serviceName} returned empty result`);
	}
	return value.trim();
};

const toResultList = (values: string[]) =>
	values.map((content) => ({ content: content.trim() })).filter(Boolean);

const fetchJson = async <T>(
	url: string,
	options?: Parameters<typeof fetch>[1],
): Promise<T> => {
	const response = await fetch(url, options);
	if (!response.ok) {
		throw new Error(`HTTP ${response.status}: ${response.statusText}`);
	}
	return (await response.json()) as T;
};

const fetchText = async (
	url: string,
	options?: Parameters<typeof fetch>[1],
) => {
	const response = await fetch(url, options);
	if (!response.ok) {
		throw new Error(`HTTP ${response.status}: ${response.statusText}`);
	}
	return response.text();
};

const postJson = async <T>(url: string, data: unknown, headers?: HeadersInit) =>
	fetchJson<T>(url, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			...headers,
		},
		body: JSON.stringify(data),
	});

const createRandomId = () => {
	if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
		return crypto.randomUUID().replace(/-/g, "");
	}
	return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
};

const sha256Hex = async (text: string) => {
	const buffer = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(text),
	);
	return Array.from(new Uint8Array(buffer))
		.map((item) => item.toString(16).padStart(2, "0"))
		.join("");
};

const truncateForYoudao = (text: string) => {
	const len = text.length;
	if (len <= 20) return text;
	return `${text.substring(0, 10)}${len}${text.substring(len - 10, len)}`;
};

const formatUnknownResult = (value: unknown): string => {
	if (typeof value === "string") {
		return value;
	}
	if (!value || typeof value !== "object") {
		return "";
	}

	const data = value as Record<string, unknown>;
	const parts: string[] = [];

	const pronunciations = data.pronunciations;
	if (Array.isArray(pronunciations)) {
		for (const item of pronunciations) {
			if (!item || typeof item !== "object") continue;
			const pronunciation = item as Record<string, unknown>;
			const region = pronunciation.region ? `${pronunciation.region} ` : "";
			const symbol = pronunciation.symbol ? `[${pronunciation.symbol}]` : "";
			if (region || symbol) {
				parts.push(`${region}${symbol}`.trim());
			}
		}
	}

	const explanations = data.explanations;
	if (Array.isArray(explanations)) {
		for (const item of explanations) {
			if (!item || typeof item !== "object") continue;
			const explanation = item as Record<string, unknown>;
			const trait = explanation.trait ? `${explanation.trait} ` : "";
			const explains = Array.isArray(explanation.explains)
				? explanation.explains.join("; ")
				: explanation.explains;
			if (explains) {
				parts.push(`${trait}${explains}`.trim());
			}
		}
	}

	const associations = data.associations;
	if (Array.isArray(associations) && associations.length > 0) {
		parts.push(associations.join("; "));
	}

	return parts.length > 0 ? parts.join("\n") : JSON.stringify(value);
};

const getConfig = (
	service: TranslationServiceInstance,
): TranslationServiceConfig => service.config ?? {};

const translateDeepL: TranslationAdapter = async ({
	service,
	sourceContent,
	sourceLanguage,
	targetLanguage,
}) => {
	const config = getConfig(service);
	const deeplType = config.deeplType ?? "free";
	const from = mapDeepLSourceLanguage(sourceLanguage);
	const to = mapDeepLTargetLanguage(targetLanguage);

	if (deeplType === "api") {
		if (!config.apiKey) {
			throw new Error("DeepL API key is not configured");
		}
		const result = await translateTextDeepL(
			config.apiUri || "https://api-free.deepl.com/v2/translate",
			config.apiKey,
			sourceContent,
			from,
			to,
			config.deeplPreferQualityOptimized ?? false,
		);
		if (!result?.translations?.length) {
			throw new Error("DeepL returned empty result");
		}
		return result.translations.map((item) => ({ content: item.text }));
	}

	if (deeplType === "deeplx") {
		if (!config.apiUri) {
			throw new Error("DeepLX URL is not configured");
		}
		const results: string[] = [];
		for (const text of sourceContent) {
			const result = await postJson<{ data?: string }>(config.apiUri, {
				source_lang: from ?? "auto",
				target_lang: to,
				text,
			});
			results.push(assertText(result.data, "DeepLX"));
		}
		return toResultList(results);
	}

	const results: string[] = [];
	for (const text of sourceContent) {
		const rand = Math.floor(Math.random() * 99999 + 100000) * 1000;
		const body = {
			jsonrpc: "2.0",
			method: "LMT_handle_texts",
			params: {
				splitting: "newlines",
				lang: {
					source_lang_user_selected: from ? from.slice(0, 2) : "auto",
					target_lang: to.slice(0, 2),
				},
				texts: [{ text, requestAlternatives: 3 }],
				timestamp: Date.now(),
			},
			id: rand,
		};
		const result = await postJson<{
			result?: { texts?: { text?: string }[] };
		}>("https://www2.deepl.com/jsonrpc", body);
		results.push(assertText(result.result?.texts?.[0]?.text, "DeepL"));
	}
	return toResultList(results);
};

const translateGoogle: TranslationAdapter = async ({
	sourceContent,
	sourceLanguage,
	targetLanguage,
}) => {
	const result = await translateTextGoogle(
		sourceContent,
		sourceLanguage,
		targetLanguage,
	);
	if (!result?.translations?.length) {
		throw new Error("Google returned empty result");
	}
	return result.translations.map((item) => ({ content: item.text }));
};

const translateBing: TranslationAdapter = async ({
	sourceContent,
	sourceLanguage,
	targetLanguage,
}) => {
	const result = await translateTextMicrosoft(
		sourceContent,
		sourceLanguage,
		targetLanguage,
	);
	if (!result?.translations?.length) {
		throw new Error("Bing returned empty result");
	}
	return result.translations.map((item) => ({ content: item.text }));
};

const translateLingva: TranslationAdapter = async ({
	service,
	sourceContent,
	sourceLanguage,
	targetLanguage,
}) => {
	const config = getConfig(service);
	const apiUri = (config.apiUri || "https://lingva.pot-app.com/api/v1").replace(
		/\/$/,
		"",
	);
	const from = mapTranslationLanguage(
		TranslationServiceType.Lingva,
		sourceLanguage,
	);
	const to = mapTranslationLanguage(
		TranslationServiceType.Lingva,
		targetLanguage,
	);
	const results: string[] = [];
	for (const text of sourceContent) {
		const result = await fetchJson<{ translation?: string }>(
			`${apiUri}/${from}/${to}/${encodeURIComponent(text.replace(/\//g, "@@"))}`,
		);
		results.push(assertText(result.translation, "Lingva").replace(/@@/g, "/"));
	}
	return toResultList(results);
};

const translateYandex: TranslationAdapter = async ({
	sourceContent,
	sourceLanguage,
	targetLanguage,
}) => {
	const from = mapTranslationLanguage(
		TranslationServiceType.Yandex,
		sourceLanguage,
	);
	const to = mapTranslationLanguage(
		TranslationServiceType.Yandex,
		targetLanguage,
	);
	const results: string[] = [];
	for (const text of sourceContent) {
		const params = new URLSearchParams({
			id: `${createRandomId()}-0-0`,
			srv: "android",
		});
		const body = new URLSearchParams({
			source_lang: from,
			target_lang: to,
			text,
		});
		const result = await fetchJson<{ text?: string[] }>(
			`https://translate.yandex.net/api/v1/tr.json/translate?${params.toString()}`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/x-www-form-urlencoded",
				},
				body,
			},
		);
		results.push(assertText(result.text?.[0], "Yandex"));
	}
	return toResultList(results);
};

const translateECDict: TranslationAdapter = async ({
	service,
	sourceContent,
}) => {
	const config = getConfig(service);
	const apiUri = config.apiUri || "https://pot-app.com/api/dict";
	const results: string[] = [];
	for (const text of sourceContent) {
		const result = await postJson<unknown>(apiUri, { text });
		results.push(assertText(formatUnknownResult(result), "ECDict"));
	}
	return toResultList(results);
};

const translateBingDict: TranslationAdapter = async ({ sourceContent }) => {
	const results: string[] = [];
	for (const text of sourceContent) {
		const params = new URLSearchParams({
			q: text,
			appid: "371E7B2AF0F9B84EC491D731DF90A55719C7D209",
			mkt: "zh-cn",
			pname: "bingdict",
		});
		const result = await fetchJson<unknown>(
			`https://www.bing.com/api/v6/dictionarywords/search?${params.toString()}`,
		);
		results.push(assertText(formatUnknownResult(result), "Bing Dict"));
	}
	return toResultList(results);
};

const translateCambridgeDict: TranslationAdapter = async ({
	sourceContent,
	sourceLanguage,
	targetLanguage,
}) => {
	const from = mapTranslationLanguage(
		TranslationServiceType.CambridgeDict,
		sourceLanguage,
	);
	const to = mapTranslationLanguage(
		TranslationServiceType.CambridgeDict,
		targetLanguage,
	);
	if (from !== "english") {
		throw new Error("Cambridge Dict only supports English source words");
	}
	const results: string[] = [];
	for (const text of sourceContent) {
		if (text.trim().split(/\s+/).length > 1) {
			throw new Error("Cambridge Dict only supports single word lookup");
		}
		const html = await fetchText(
			`https://dictionary.cambridge.org/search/direct/?datasetsearch=${from}-${to}&q=${encodeURIComponent(text)}`,
		);
		const doc = new DOMParser().parseFromString(html, "text/html");
		const translations = Array.from(
			doc.querySelectorAll(".trans.dtrans.dtrans-se.break-cj"),
		)
			.map((item) => item.textContent?.replace(/\s+/g, " ").trim() ?? "")
			.filter(Boolean);
		results.push(assertText(translations.join("\n"), "Cambridge Dict"));
	}
	return toResultList(results);
};

const translateCaiyun: TranslationAdapter = async ({
	service,
	sourceContent,
	sourceLanguage,
	targetLanguage,
}) => {
	const config = getConfig(service);
	if (!config.apiKey) {
		throw new Error("Caiyun token is not configured");
	}
	const from = mapTranslationLanguage(
		TranslationServiceType.Caiyun,
		sourceLanguage,
	);
	const to = mapTranslationLanguage(
		TranslationServiceType.Caiyun,
		targetLanguage,
	);
	const result = await postJson<{ target?: string[] }>(
		"https://api.interpreter.caiyunai.com/v1/translator",
		{
			source: sourceContent,
			trans_type: `${from}2${to}`,
			request_id: createRandomId(),
			detect: true,
		},
		{
			"x-authorization": `token ${config.apiKey}`,
		},
	);
	if (!result.target?.length) {
		throw new Error("Caiyun returned empty result");
	}
	return toResultList(result.target);
};

const translateNiuTrans: TranslationAdapter = async ({
	service,
	sourceContent,
	sourceLanguage,
	targetLanguage,
}) => {
	const config = getConfig(service);
	if (!config.apiKey) {
		throw new Error("NiuTrans API key is not configured");
	}
	const from = mapTranslationLanguage(
		TranslationServiceType.NiuTrans,
		sourceLanguage,
	);
	const to = mapTranslationLanguage(
		TranslationServiceType.NiuTrans,
		targetLanguage,
	);
	const results: string[] = [];
	for (const text of sourceContent) {
		const result = await postJson<{ tgt_text?: string }>(
			"https://api.niutrans.com/NiuTransServer/translation",
			{
				from,
				to,
				apikey: config.apiKey,
				src_text: text,
			},
		);
		results.push(assertText(result.tgt_text, "NiuTrans"));
	}
	return toResultList(results);
};

const translateYoudao: TranslationAdapter = async ({
	service,
	sourceContent,
	sourceLanguage,
	targetLanguage,
}) => {
	const config = getConfig(service);
	if (!config.appId || !config.secretKey) {
		throw new Error("Youdao app ID or secret key is not configured");
	}
	const from = mapTranslationLanguage(
		TranslationServiceType.Youdao,
		sourceLanguage,
	);
	const to = mapTranslationLanguage(
		TranslationServiceType.Youdao,
		targetLanguage,
	);
	const results: string[] = [];
	for (const text of sourceContent) {
		const curtime = `${Math.round(Date.now() / 1000)}`;
		const salt = createRandomId();
		const sign = await sha256Hex(
			`${config.appId}${truncateForYoudao(text.trim())}${salt}${curtime}${config.secretKey}`,
		);
		const params = new URLSearchParams({
			q: text.trim(),
			from,
			to,
			appKey: config.appId,
			salt,
			sign,
			signType: "v3",
			curtime,
		});
		const result = await fetchJson<{ translation?: string[]; basic?: unknown }>(
			`https://openapi.youdao.com/api?${params.toString()}`,
		);
		results.push(
			assertText(
				result.translation?.join("\n") || formatUnknownResult(result.basic),
				"Youdao",
			),
		);
	}
	return toResultList(results);
};

const translateCustom: TranslationAdapter = async ({
	service,
	sourceContent,
	sourceLanguage,
	targetLanguage,
}) => {
	const config = getConfig(service);
	if (!config.apiUri) {
		throw new Error("Custom API URL is not configured");
	}
	const result = await translateTextCustomWithLimits(
		{
			api_type: TranslationApiType.Custom,
			api_uri: config.apiUri,
			api_key: config.apiKey,
			max_requests_per_second: config.maxRequestsPerSecond,
			max_paragraph_count: config.maxParagraphCount,
		},
		sourceContent,
		sourceLanguage,
		targetLanguage,
	);
	if (!result?.translations?.length) {
		throw new Error("Custom API returned empty result");
	}
	return result.translations.map((item) => ({ content: item.text }));
};

const unsupportedSignedService =
	(serviceName: string): TranslationAdapter =>
	async () => {
		throw new Error(
			`${serviceName} requires vendor signature support and is currently configurable but not executable`,
		);
	};

export const translationAdapters: Record<
	TranslationServiceType,
	TranslationAdapter
> = {
	[TranslationServiceType.DeepL]: translateDeepL,
	[TranslationServiceType.Bing]: translateBing,
	[TranslationServiceType.Lingva]: translateLingva,
	[TranslationServiceType.Yandex]: translateYandex,
	[TranslationServiceType.Google]: translateGoogle,
	[TranslationServiceType.ECDict]: translateECDict,
	[TranslationServiceType.Alibaba]:
		unsupportedSignedService("Alibaba Translate"),
	[TranslationServiceType.Baidu]: unsupportedSignedService("Baidu Translate"),
	[TranslationServiceType.BaiduField]: unsupportedSignedService(
		"Baidu Field Translate",
	),
	[TranslationServiceType.BingDict]: translateBingDict,
	[TranslationServiceType.Caiyun]: translateCaiyun,
	[TranslationServiceType.CambridgeDict]: translateCambridgeDict,
	[TranslationServiceType.Tencent]:
		unsupportedSignedService("Tencent Translate"),
	[TranslationServiceType.Volcengine]: unsupportedSignedService(
		"Volcengine Translate",
	),
	[TranslationServiceType.NiuTrans]: translateNiuTrans,
	[TranslationServiceType.Youdao]: translateYoudao,
	[TranslationServiceType.Custom]: translateCustom,
};
