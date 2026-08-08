import { TranslationServiceType } from "@/types/appSettings";

type LanguageMap = Record<string, string | undefined>;

const commonMap: LanguageMap = {
	auto: "auto",
	"zh-CHS": "zh-CN",
	"zh-CHT": "zh-TW",
	en: "en",
	ja: "ja",
	ko: "ko",
	fr: "fr",
	de: "de",
	es: "es",
	it: "it",
	pt: "pt",
	ru: "ru",
	tr: "tr",
	ar: "ar",
};

const serviceLanguageMaps: Partial<
	Record<TranslationServiceType, LanguageMap>
> = {
	[TranslationServiceType.DeepL]: {
		...commonMap,
		auto: "auto",
		"zh-CHS": "ZH-HANS",
		"zh-CHT": "ZH-HANT",
		en: "EN",
		ja: "JA",
		ko: "KO",
		fr: "FR",
		de: "DE",
		es: "ES",
		it: "IT",
		pt: "PT",
		ru: "RU",
		tr: "TR",
	},
	[TranslationServiceType.Bing]: {
		...commonMap,
		auto: "",
		"zh-CHS": "zh-Hans",
		"zh-CHT": "zh-Hant",
	},
	[TranslationServiceType.Yandex]: {
		...commonMap,
		auto: "",
		"zh-CHS": "zh",
		"zh-CHT": "zh",
	},
	[TranslationServiceType.Lingva]: commonMap,
	[TranslationServiceType.Google]: commonMap,
	[TranslationServiceType.ECDict]: commonMap,
	[TranslationServiceType.BingDict]: {
		...commonMap,
		"zh-CHS": "zh-cn",
		"zh-CHT": "zh-tw",
		en: "en-us",
	},
	[TranslationServiceType.CambridgeDict]: {
		...commonMap,
		"zh-CHS": "chinese-simplified",
		"zh-CHT": "chinese-traditional",
		en: "english",
	},
	[TranslationServiceType.Baidu]: {
		...commonMap,
		"zh-CHS": "zh",
		"zh-CHT": "cht",
		ja: "jp",
		ko: "kor",
		fr: "fra",
		es: "spa",
		pt: "pt",
	},
	[TranslationServiceType.BaiduField]: {
		...commonMap,
		"zh-CHS": "zh",
		"zh-CHT": "cht",
		ja: "jp",
		ko: "kor",
		fr: "fra",
		es: "spa",
		pt: "pt",
	},
	[TranslationServiceType.Alibaba]: {
		...commonMap,
		"zh-CHS": "zh",
		"zh-CHT": "zh-tw",
	},
	[TranslationServiceType.Tencent]: {
		...commonMap,
		"zh-CHS": "zh",
		"zh-CHT": "zh-TW",
		pt: "pt",
	},
	[TranslationServiceType.Volcengine]: {
		...commonMap,
		"zh-CHS": "zh",
		"zh-CHT": "zh-Hant",
		pt: "pt",
	},
	[TranslationServiceType.Caiyun]: {
		...commonMap,
		"zh-CHS": "zh",
		"zh-CHT": "zhT",
	},
	[TranslationServiceType.NiuTrans]: {
		...commonMap,
		"zh-CHS": "zh",
		"zh-CHT": "cht",
	},
	[TranslationServiceType.Youdao]: {
		...commonMap,
		"zh-CHS": "zh-CHS",
		"zh-CHT": "zh-CHT",
		ja: "ja",
	},
};

export const mapTranslationLanguage = (
	serviceType: TranslationServiceType,
	language: string,
) => {
	const map = serviceLanguageMaps[serviceType] ?? commonMap;
	return map[language] ?? language;
};

export const mapDeepLSourceLanguage = (language: string) => {
	if (language === "auto") {
		return null;
	}
	const mapped = mapTranslationLanguage(TranslationServiceType.DeepL, language);
	return mapped === "auto" ? null : mapped;
};

export const mapDeepLTargetLanguage = (language: string) =>
	mapTranslationLanguage(TranslationServiceType.DeepL, language);

/**
 * 翻译服务返回的检测语言码（如 Google 的 ISO 码、微软的 zh-Hans）
 * 映射为项目内部语言码（如 zh-CHS）。无法映射时原样返回；
 * auto / 空值返回 undefined（表示无检测结果）。
 */
const detectedLanguageMap: LanguageMap = {
	"zh-CN": "zh-CHS",
	"zh-Hans": "zh-CHS",
	"zh-CHS": "zh-CHS",
	"zh-TW": "zh-CHT",
	"zh-Hant": "zh-CHT",
	"zh-CHT": "zh-CHT",
	en: "en",
	ja: "ja",
	ko: "ko",
	fr: "fr",
	de: "de",
	es: "es",
	it: "it",
	pt: "pt",
	ru: "ru",
	tr: "tr",
	ar: "ar",
};

export const mapDetectedLanguage = (lang?: string): string | undefined => {
	if (!lang || lang === "auto") {
		return undefined;
	}
	return detectedLanguageMap[lang] ?? lang;
};
