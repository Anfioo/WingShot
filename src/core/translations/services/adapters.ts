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

const bytesToHex = (bytes: ArrayBuffer | Uint8Array) =>
	Array.from(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes))
		.map((item) => item.toString(16).padStart(2, "0"))
		.join("");

const bytesToBase64 = (bytes: ArrayBuffer | Uint8Array) => {
	const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
	let binary = "";
	for (const byte of view) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary);
};

const sha256Hex = async (text: string) => {
	const buffer = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(text),
	);
	return bytesToHex(buffer);
};

const hmacDigest = async (
	algorithm: "SHA-1" | "SHA-256",
	message: string,
	key: string | ArrayBuffer | Uint8Array,
) => {
	const keyData =
		typeof key === "string"
			? new TextEncoder().encode(key)
			: key instanceof ArrayBuffer
				? key
				: new Uint8Array(key);
	const cryptoKey = await crypto.subtle.importKey(
		"raw",
		keyData,
		{ name: "HMAC", hash: algorithm },
		false,
		["sign"],
	);
	return crypto.subtle.sign(
		"HMAC",
		cryptoKey,
		new TextEncoder().encode(message),
	);
};

const hmacSha256Bytes = (
	message: string,
	key: string | ArrayBuffer | Uint8Array,
) =>
	hmacDigest("SHA-256", message, key).then((buffer) => new Uint8Array(buffer));

const hmacSha256Hex = (
	message: string,
	key: string | ArrayBuffer | Uint8Array,
) => hmacDigest("SHA-256", message, key).then(bytesToHex);

const hmacSha1Base64 = (message: string, key: string) =>
	hmacDigest("SHA-1", message, key).then(bytesToBase64);

const md5Hex = (input: string) => {
	const bytes = new TextEncoder().encode(input);
	const words: number[] = [];
	for (let i = 0; i < bytes.length; i++) {
		words[i >> 2] |= bytes[i] << ((i % 4) * 8);
	}
	const bitLength = bytes.length * 8;
	words[bitLength >> 5] |= 0x80 << (bitLength % 32);
	words[(((bitLength + 64) >>> 9) << 4) + 14] = bitLength;

	let a = 0x67452301;
	let b = 0xefcdab89;
	let c = 0x98badcfe;
	let d = 0x10325476;

	const rotateLeft = (value: number, shift: number) =>
		(value << shift) | (value >>> (32 - shift));
	const add = (x: number, y: number) => (x + y) | 0;
	const cmn = (
		q: number,
		a: number,
		b: number,
		x: number,
		s: number,
		t: number,
	) => add(rotateLeft(add(add(a, q), add(x, t)), s), b);
	const ff = (
		a: number,
		b: number,
		c: number,
		d: number,
		x: number,
		s: number,
		t: number,
	) => cmn((b & c) | (~b & d), a, b, x, s, t);
	const gg = (
		a: number,
		b: number,
		c: number,
		d: number,
		x: number,
		s: number,
		t: number,
	) => cmn((b & d) | (c & ~d), a, b, x, s, t);
	const hh = (
		a: number,
		b: number,
		c: number,
		d: number,
		x: number,
		s: number,
		t: number,
	) => cmn(b ^ c ^ d, a, b, x, s, t);
	const ii = (
		a: number,
		b: number,
		c: number,
		d: number,
		x: number,
		s: number,
		t: number,
	) => cmn(c ^ (b | ~d), a, b, x, s, t);

	for (let i = 0; i < words.length; i += 16) {
		const oldA = a;
		const oldB = b;
		const oldC = c;
		const oldD = d;

		a = ff(a, b, c, d, words[i], 7, -680876936);
		d = ff(d, a, b, c, words[i + 1], 12, -389564586);
		c = ff(c, d, a, b, words[i + 2], 17, 606105819);
		b = ff(b, c, d, a, words[i + 3], 22, -1044525330);
		a = ff(a, b, c, d, words[i + 4], 7, -176418897);
		d = ff(d, a, b, c, words[i + 5], 12, 1200080426);
		c = ff(c, d, a, b, words[i + 6], 17, -1473231341);
		b = ff(b, c, d, a, words[i + 7], 22, -45705983);
		a = ff(a, b, c, d, words[i + 8], 7, 1770035416);
		d = ff(d, a, b, c, words[i + 9], 12, -1958414417);
		c = ff(c, d, a, b, words[i + 10], 17, -42063);
		b = ff(b, c, d, a, words[i + 11], 22, -1990404162);
		a = ff(a, b, c, d, words[i + 12], 7, 1804603682);
		d = ff(d, a, b, c, words[i + 13], 12, -40341101);
		c = ff(c, d, a, b, words[i + 14], 17, -1502002290);
		b = ff(b, c, d, a, words[i + 15], 22, 1236535329);

		a = gg(a, b, c, d, words[i + 1], 5, -165796510);
		d = gg(d, a, b, c, words[i + 6], 9, -1069501632);
		c = gg(c, d, a, b, words[i + 11], 14, 643717713);
		b = gg(b, c, d, a, words[i], 20, -373897302);
		a = gg(a, b, c, d, words[i + 5], 5, -701558691);
		d = gg(d, a, b, c, words[i + 10], 9, 38016083);
		c = gg(c, d, a, b, words[i + 15], 14, -660478335);
		b = gg(b, c, d, a, words[i + 4], 20, -405537848);
		a = gg(a, b, c, d, words[i + 9], 5, 568446438);
		d = gg(d, a, b, c, words[i + 14], 9, -1019803690);
		c = gg(c, d, a, b, words[i + 3], 14, -187363961);
		b = gg(b, c, d, a, words[i + 8], 20, 1163531501);
		a = gg(a, b, c, d, words[i + 13], 5, -1444681467);
		d = gg(d, a, b, c, words[i + 2], 9, -51403784);
		c = gg(c, d, a, b, words[i + 7], 14, 1735328473);
		b = gg(b, c, d, a, words[i + 12], 20, -1926607734);

		a = hh(a, b, c, d, words[i + 5], 4, -378558);
		d = hh(d, a, b, c, words[i + 8], 11, -2022574463);
		c = hh(c, d, a, b, words[i + 11], 16, 1839030562);
		b = hh(b, c, d, a, words[i + 14], 23, -35309556);
		a = hh(a, b, c, d, words[i + 1], 4, -1530992060);
		d = hh(d, a, b, c, words[i + 4], 11, 1272893353);
		c = hh(c, d, a, b, words[i + 7], 16, -155497632);
		b = hh(b, c, d, a, words[i + 10], 23, -1094730640);
		a = hh(a, b, c, d, words[i + 13], 4, 681279174);
		d = hh(d, a, b, c, words[i], 11, -358537222);
		c = hh(c, d, a, b, words[i + 3], 16, -722521979);
		b = hh(b, c, d, a, words[i + 6], 23, 76029189);
		a = hh(a, b, c, d, words[i + 9], 4, -640364487);
		d = hh(d, a, b, c, words[i + 12], 11, -421815835);
		c = hh(c, d, a, b, words[i + 15], 16, 530742520);
		b = hh(b, c, d, a, words[i + 2], 23, -995338651);

		a = ii(a, b, c, d, words[i], 6, -198630844);
		d = ii(d, a, b, c, words[i + 7], 10, 1126891415);
		c = ii(c, d, a, b, words[i + 14], 15, -1416354905);
		b = ii(b, c, d, a, words[i + 5], 21, -57434055);
		a = ii(a, b, c, d, words[i + 12], 6, 1700485571);
		d = ii(d, a, b, c, words[i + 3], 10, -1894986606);
		c = ii(c, d, a, b, words[i + 10], 15, -1051523);
		b = ii(b, c, d, a, words[i + 1], 21, -2054922799);
		a = ii(a, b, c, d, words[i + 8], 6, 1873313359);
		d = ii(d, a, b, c, words[i + 15], 10, -30611744);
		c = ii(c, d, a, b, words[i + 6], 15, -1560198380);
		b = ii(b, c, d, a, words[i + 13], 21, 1309151649);
		a = ii(a, b, c, d, words[i + 4], 6, -145523070);
		d = ii(d, a, b, c, words[i + 11], 10, -1120210379);
		c = ii(c, d, a, b, words[i + 2], 15, 718787259);
		b = ii(b, c, d, a, words[i + 9], 21, -343485551);

		a = add(a, oldA);
		b = add(b, oldB);
		c = add(c, oldC);
		d = add(d, oldD);
	}

	return [a, b, c, d]
		.flatMap((word) => [word, word >>> 8, word >>> 16, word >>> 24])
		.map((value) => (value & 0xff).toString(16).padStart(2, "0"))
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

const translateBaiduBase = async ({
	service,
	sourceContent,
	sourceLanguage,
	targetLanguage,
	field,
}: TranslationAdapterParams & { field?: string }) => {
	const config = getConfig(service);
	if (!config.appId || !config.secretKey) {
		throw new Error("Baidu app ID or secret key is not configured");
	}
	const from = mapTranslationLanguage(service.type, sourceLanguage);
	const to = mapTranslationLanguage(service.type, targetLanguage);
	const url = field
		? "https://fanyi-api.baidu.com/api/trans/vip/fieldtranslate"
		: "https://fanyi-api.baidu.com/api/trans/vip/translate";
	const results: string[] = [];

	for (const text of sourceContent) {
		const salt = createRandomId();
		const sign = md5Hex(
			field
				? `${config.appId}${text}${salt}${field}${config.secretKey}`
				: `${config.appId}${text}${salt}${config.secretKey}`,
		);
		const params = new URLSearchParams({
			q: text,
			from,
			to,
			appid: config.appId,
			salt,
			sign,
		});
		if (field) {
			params.set("domain", field);
		}
		const result = await fetchJson<{ trans_result?: { dst?: string }[] }>(
			`${url}?${params.toString()}`,
		);
		results.push(
			assertText(
				result.trans_result?.map((item) => item.dst ?? "").join("\n"),
				field ? "Baidu Field" : "Baidu",
			),
		);
	}

	return toResultList(results);
};

const translateBaidu: TranslationAdapter = (params) =>
	translateBaiduBase(params);

const translateBaiduField: TranslationAdapter = (params) => {
	const field = getConfig(params.service).domain || params.domain;
	if (!field) {
		throw new Error("Baidu field domain is not configured");
	}
	return translateBaiduBase({ ...params, field });
};

const percentEncode = (value: string) =>
	encodeURIComponent(value)
		.replace(/!/g, "%21")
		.replace(/'/g, "%27")
		.replace(/\(/g, "%28")
		.replace(/\)/g, "%29")
		.replace(/\*/g, "%2A");

const toUtcDate = (timestampSeconds: number) => {
	const date = new Date(timestampSeconds * 1000);
	const year = date.getUTCFullYear();
	const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
	const day = `${date.getUTCDate()}`.padStart(2, "0");
	return `${year}-${month}-${day}`;
};

const translateTencent: TranslationAdapter = async ({
	service,
	sourceContent,
	sourceLanguage,
	targetLanguage,
}) => {
	const config = getConfig(service);
	if (!config.apiKey || !config.secretKey) {
		throw new Error("Tencent secret ID or secret key is not configured");
	}
	const endpoint = "tmt.tencentcloudapi.com";
	const serviceName = "tmt";
	const region = config.region || "ap-beijing";
	const action = "TextTranslate";
	const version = "2018-03-21";
	const source = mapTranslationLanguage(
		TranslationServiceType.Tencent,
		sourceLanguage,
	);
	const target = mapTranslationLanguage(
		TranslationServiceType.Tencent,
		targetLanguage,
	);
	const results: string[] = [];

	for (const text of sourceContent) {
		const timestamp = Math.ceil(Date.now() / 1000);
		const date = toUtcDate(timestamp);
		const body = {
			SourceText: text,
			Source: source,
			Target: target,
			ProjectId: 0,
		};
		const payload = JSON.stringify(body);
		const hashedRequestPayload = await sha256Hex(payload);
		const canonicalHeaders = `content-type:application/json\nhost:${endpoint}\n`;
		const signedHeaders = "content-type;host";
		const canonicalRequest = [
			"POST",
			"/",
			"",
			canonicalHeaders,
			signedHeaders,
			hashedRequestPayload,
		].join("\n");
		const credentialScope = `${date}/${serviceName}/tc3_request`;
		const stringToSign = [
			"TC3-HMAC-SHA256",
			`${timestamp}`,
			credentialScope,
			await sha256Hex(canonicalRequest),
		].join("\n");
		const kDate = await hmacSha256Bytes(date, `TC3${config.secretKey}`);
		const kService = await hmacSha256Bytes(serviceName, kDate);
		const kSigning = await hmacSha256Bytes("tc3_request", kService);
		const signature = await hmacSha256Hex(stringToSign, kSigning);
		const authorization = `TC3-HMAC-SHA256 Credential=${config.apiKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
		const result = await postJson<{
			Response?: { TargetText?: string; Error?: { Message?: string } };
		}>(`https://${endpoint}`, body, {
			Authorization: authorization,
			Host: endpoint,
			"X-TC-Action": action,
			"X-TC-Timestamp": `${timestamp}`,
			"X-TC-Version": version,
			"X-TC-Region": region,
		});
		if (result.Response?.Error?.Message) {
			throw new Error(result.Response.Error.Message);
		}
		results.push(assertText(result.Response?.TargetText, "Tencent"));
	}

	return toResultList(results);
};

const translateAlibaba: TranslationAdapter = async ({
	service,
	sourceContent,
	sourceLanguage,
	targetLanguage,
}) => {
	const config = getConfig(service);
	if (!config.accessKeyId || !config.accessKeySecret) {
		throw new Error(
			"Alibaba AccessKey ID or AccessKey Secret is not configured",
		);
	}
	const endpoint =
		"https://mt.cn-hangzhou.aliyuncs.com/api/translate/web/general";
	const from = mapTranslationLanguage(
		TranslationServiceType.Alibaba,
		sourceLanguage,
	);
	const to = mapTranslationLanguage(
		TranslationServiceType.Alibaba,
		targetLanguage,
	);
	const results: string[] = [];

	for (const text of sourceContent) {
		const params = new URLSearchParams({
			AccessKeyId: config.accessKeyId,
			Action: "TranslateGeneral",
			Format: "JSON",
			FormatType: "text",
			Scene: "general",
			SignatureMethod: "HMAC-SHA1",
			SignatureNonce: createRandomId(),
			SignatureVersion: "1.0",
			SourceLanguage: from,
			SourceText: text,
			TargetLanguage: to,
			Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
			Version: "2018-10-12",
		});
		const canonicalQuery = Array.from(params.entries())
			.sort(([left], [right]) => left.localeCompare(right))
			.map(([key, value]) => `${percentEncode(key)}=${percentEncode(value)}`)
			.join("&");
		const stringToSign = `GET&${percentEncode("/")}&${percentEncode(canonicalQuery)}`;
		const signature = await hmacSha1Base64(
			stringToSign,
			`${config.accessKeySecret}&`,
		);
		const result = await fetchJson<{
			Code?: string;
			Message?: string;
			Data?: { Translated?: string };
		}>(`${endpoint}?${canonicalQuery}&Signature=${percentEncode(signature)}`);
		if (result.Code !== "200") {
			throw new Error(result.Message || JSON.stringify(result));
		}
		results.push(assertText(result.Data?.Translated, "Alibaba"));
	}

	return toResultList(results);
};

const toVolcengineDate = () =>
	new Date()
		.toISOString()
		.replace(/-/g, "")
		.replace(/:/g, "")
		.replace(/\.\d{3}Z$/, "Z");

const translateVolcengine: TranslationAdapter = async ({
	service,
	sourceContent,
	sourceLanguage,
	targetLanguage,
}) => {
	const config = getConfig(service);
	if (!config.accessKeyId || !config.accessKeySecret) {
		throw new Error(
			"Volcengine AccessKey ID or AccessKey Secret is not configured",
		);
	}
	const host = "open.volcengineapi.com";
	const region = config.region || "cn-north-1";
	const serviceName = "translate";
	const dateTime = toVolcengineDate();
	const date = dateTime.slice(0, 8);
	const target = mapTranslationLanguage(
		TranslationServiceType.Volcengine,
		targetLanguage,
	);
	const source = mapTranslationLanguage(
		TranslationServiceType.Volcengine,
		sourceLanguage,
	);
	const body = {
		TargetLanguage: target,
		TextList: sourceContent,
		...(source && source !== "auto" ? { SourceLanguage: source } : {}),
	};
	const payload = JSON.stringify(body);
	const bodyHash = await sha256Hex(payload);
	const signedHeadersMap = {
		"content-type": "application/json",
		host,
		"x-content-sha256": bodyHash,
		"x-date": dateTime,
	};
	const signedHeaders = Object.keys(signedHeadersMap).join(";");
	const canonicalHeaders = Object.entries(signedHeadersMap)
		.map(([key, value]) => `${key}:${value}\n`)
		.join("");
	const canonicalQuery = "Action=TranslateText&Version=2020-06-01";
	const canonicalRequest = [
		"POST",
		"/",
		canonicalQuery,
		canonicalHeaders,
		signedHeaders,
		bodyHash,
	].join("\n");
	const credentialScope = `${date}/${region}/${serviceName}/request`;
	const stringToSign = [
		"HMAC-SHA256",
		dateTime,
		credentialScope,
		await sha256Hex(canonicalRequest),
	].join("\n");
	const kDate = await hmacSha256Bytes(date, config.accessKeySecret);
	const kRegion = await hmacSha256Bytes(region, kDate);
	const kService = await hmacSha256Bytes(serviceName, kRegion);
	const kSigning = await hmacSha256Bytes("request", kService);
	const signature = await hmacSha256Hex(stringToSign, kSigning);
	const authorization = `HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
	const result = await postJson<{
		TranslationList?: { Translation?: string }[];
		ResponseMetadata?: { Error?: { Message?: string } };
	}>(`https://${host}/?${canonicalQuery}`, body, {
		Authorization: authorization,
		Host: host,
		"X-Content-Sha256": bodyHash,
		"X-Date": dateTime,
	});
	if (result.ResponseMetadata?.Error?.Message) {
		throw new Error(result.ResponseMetadata.Error.Message);
	}
	return toResultList(
		(result.TranslationList ?? []).map((item) => item.Translation ?? ""),
	);
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
	[TranslationServiceType.Alibaba]: translateAlibaba,
	[TranslationServiceType.Baidu]: translateBaidu,
	[TranslationServiceType.BaiduField]: translateBaiduField,
	[TranslationServiceType.BingDict]: translateBingDict,
	[TranslationServiceType.Caiyun]: translateCaiyun,
	[TranslationServiceType.CambridgeDict]: translateCambridgeDict,
	[TranslationServiceType.Tencent]: translateTencent,
	[TranslationServiceType.Volcengine]: translateVolcengine,
	[TranslationServiceType.NiuTrans]: translateNiuTrans,
	[TranslationServiceType.Youdao]: translateYoudao,
	[TranslationServiceType.Custom]: translateCustom,
};
