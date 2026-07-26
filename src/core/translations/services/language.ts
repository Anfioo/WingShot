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
	},
	[TranslationServiceType.BaiduField]: {
		...commonMap,
		"zh-CHS": "zh",
		"zh-CHT": "cht",
		ja: "jp",
	},
	[TranslationServiceType.Alibaba]: {
		...commonMap,
		"zh-CHS": "zh",
		"zh-CHT": "zh-tw",
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
