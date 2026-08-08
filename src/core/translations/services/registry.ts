import {
	type TranslationServiceConfig,
	type TranslationServiceInstance,
	TranslationServiceType,
} from "@/types/appSettings";

export type TranslationServiceConfigField = {
	key:
		| "apiUri"
		| "apiKey"
		| "secretKey"
		| "appId"
		| "accessKeyId"
		| "accessKeySecret"
		| "region"
		| "domain"
		| "deeplType"
		| "deeplPreferQualityOptimized"
		| "maxRequestsPerSecond"
		| "maxParagraphCount";
	type: "text" | "password" | "number" | "switch" | "select";
	messageId: string;
	tipMessageId?: string;
	required?: boolean | ((config?: TranslationServiceConfig) => boolean);
	visibleWhen?: (config?: TranslationServiceConfig) => boolean;
	options?: { labelMessageId: string; value: string }[];
};

export type TranslationServiceMeta = {
	type: TranslationServiceType;
	messageId: string;
	descriptionMessageId?: string;
	configFields: TranslationServiceConfigField[];
	guideUrl?:
		| string
		| ((config?: TranslationServiceConfig) => string | undefined);
	supportDomain?: boolean;
};

const credentialFields = {
	appId: {
		key: "appId",
		type: "text",
		messageId: "settings.translationSettings.serviceConfig.appId",
		required: true,
	},
	apiKey: {
		key: "apiKey",
		type: "password",
		messageId: "settings.translationSettings.serviceConfig.apiKey",
		required: true,
	},
	secretKey: {
		key: "secretKey",
		type: "password",
		messageId: "settings.translationSettings.serviceConfig.secretKey",
		required: true,
	},
	accessKeyId: {
		key: "accessKeyId",
		type: "text",
		messageId: "settings.translationSettings.serviceConfig.accessKeyId",
		required: true,
	},
	accessKeySecret: {
		key: "accessKeySecret",
		type: "password",
		messageId: "settings.translationSettings.serviceConfig.accessKeySecret",
		required: true,
	},
} satisfies Record<string, TranslationServiceConfigField>;

export const translationServiceMetas: TranslationServiceMeta[] = [
	{
		type: TranslationServiceType.DeepL,
		messageId: "settings.translationSettings.service.deepl",
		guideUrl: (config) => {
			if (config?.deeplType === "api") {
				return "https://pot-app.com/docs/api/translate/deepl.html";
			}
			if (config?.deeplType === "deeplx") {
				return "https://github.com/OwO-Network/DeepLX";
			}
			return undefined;
		},
		configFields: [
			{
				key: "deeplType",
				type: "select",
				messageId: "settings.translationSettings.serviceConfig.deeplType",
				options: [
					{
						labelMessageId:
							"settings.translationSettings.serviceConfig.deeplType.free",
						value: "free",
					},
					{
						labelMessageId:
							"settings.translationSettings.serviceConfig.deeplType.api",
						value: "api",
					},
					{
						labelMessageId:
							"settings.translationSettings.serviceConfig.deeplType.deeplx",
						value: "deeplx",
					},
				],
			},
			{
				key: "apiUri",
				type: "text",
				messageId: "settings.translationSettings.serviceConfig.apiUri",
				tipMessageId:
					"settings.translationSettings.serviceConfig.deeplApiUriTip",
				required: (config) => config?.deeplType === "deeplx",
				visibleWhen: (config) =>
					config?.deeplType === "api" || config?.deeplType === "deeplx",
			},
			{
				...credentialFields.apiKey,
				required: (config) => config?.deeplType === "api",
				visibleWhen: (config) => config?.deeplType === "api",
			},
			{
				key: "deeplPreferQualityOptimized",
				type: "switch",
				messageId:
					"settings.translationSettings.serviceConfig.deeplPreferQualityOptimized",
				visibleWhen: (config) => config?.deeplType === "api",
			},
		],
	},
	{
		type: TranslationServiceType.Bing,
		messageId: "settings.translationSettings.service.bing",
		configFields: [],
	},
	{
		type: TranslationServiceType.Lingva,
		messageId: "settings.translationSettings.service.lingva",
		configFields: [
			{
				key: "apiUri",
				type: "text",
				messageId: "settings.translationSettings.serviceConfig.apiUri",
				tipMessageId:
					"settings.translationSettings.serviceConfig.lingvaApiUriTip",
			},
		],
	},
	{
		type: TranslationServiceType.Yandex,
		messageId: "settings.translationSettings.service.yandex",
		configFields: [],
	},
	{
		type: TranslationServiceType.Google,
		messageId: "settings.translationSettings.service.google",
		configFields: [],
	},
	{
		type: TranslationServiceType.ECDict,
		messageId: "settings.translationSettings.service.ecdict",
		configFields: [
			{
				key: "apiUri",
				type: "text",
				messageId: "settings.translationSettings.serviceConfig.apiUri",
				tipMessageId:
					"settings.translationSettings.serviceConfig.ecdictApiUriTip",
			},
		],
	},
	{
		type: TranslationServiceType.Alibaba,
		messageId: "settings.translationSettings.service.alibaba",
		guideUrl: "https://pot-app.com/docs/api/translate/alibaba.html",
		configFields: [
			credentialFields.accessKeyId,
			credentialFields.accessKeySecret,
		],
	},
	{
		type: TranslationServiceType.Baidu,
		messageId: "settings.translationSettings.service.baidu",
		guideUrl: "https://pot-app.com/docs/api/translate/baidu.html",
		configFields: [credentialFields.appId, credentialFields.secretKey],
	},
	{
		type: TranslationServiceType.BaiduField,
		messageId: "settings.translationSettings.service.baiduField",
		guideUrl: "https://pot-app.com/docs/api/translate/baidu.html",
		configFields: [
			credentialFields.appId,
			credentialFields.secretKey,
			{
				key: "domain",
				type: "text",
				messageId: "settings.translationSettings.serviceConfig.domain",
			},
		],
		supportDomain: true,
	},
	{
		type: TranslationServiceType.BingDict,
		messageId: "settings.translationSettings.service.bingDict",
		configFields: [],
	},
	{
		type: TranslationServiceType.Caiyun,
		messageId: "settings.translationSettings.service.caiyun",
		guideUrl: "https://pot-app.com/docs/api/translate/caiyun.html",
		configFields: [credentialFields.apiKey],
	},
	{
		type: TranslationServiceType.CambridgeDict,
		messageId: "settings.translationSettings.service.cambridgeDict",
		configFields: [],
	},
	{
		type: TranslationServiceType.Tencent,
		messageId: "settings.translationSettings.service.tencent",
		guideUrl: "https://pot-app.com/docs/api/translate/tencent.html",
		configFields: [credentialFields.secretKey, credentialFields.apiKey],
	},
	{
		type: TranslationServiceType.Volcengine,
		messageId: "settings.translationSettings.service.volcengine",
		guideUrl: "https://pot-app.com/docs/api/translate/volcengine.html",
		configFields: [
			credentialFields.accessKeyId,
			credentialFields.accessKeySecret,
		],
	},
	{
		type: TranslationServiceType.NiuTrans,
		messageId: "settings.translationSettings.service.niutrans",
		guideUrl: "https://pot-app.com/docs/api/translate/niutrans.html",
		configFields: [credentialFields.apiKey],
	},
	{
		type: TranslationServiceType.Youdao,
		messageId: "settings.translationSettings.service.youdao",
		guideUrl: "https://pot-app.com/docs/api/translate/youdao.html",
		configFields: [credentialFields.appId, credentialFields.secretKey],
	},
	{
		type: TranslationServiceType.Custom,
		messageId: "settings.translationSettings.service.custom",
		configFields: [
			{
				key: "apiUri",
				type: "text",
				messageId: "settings.translationSettings.serviceConfig.apiUri",
				required: true,
			},
			{
				...credentialFields.apiKey,
				required: false,
			},
			{
				key: "maxRequestsPerSecond",
				type: "number",
				messageId:
					"settings.translationSettings.serviceConfig.maxRequestsPerSecond",
			},
			{
				key: "maxParagraphCount",
				type: "number",
				messageId:
					"settings.translationSettings.serviceConfig.maxParagraphCount",
			},
		],
	},
];

export const translationServiceMetaMap = Object.fromEntries(
	translationServiceMetas.map((item) => [item.type, item]),
) as Record<TranslationServiceType, TranslationServiceMeta>;

/**
 * 获取翻译服务显示名称
 *
 * 优先使用自定义名称（service.name），否则回退到内置服务的国际化文案。
 * `formatMessage` 由调用方注入（如 `(id) => intl.formatMessage({ id })`）。
 */
export const getTranslationServiceName = (
	service: TranslationServiceInstance,
	formatMessage: (messageId: string) => string,
) => {
	const meta = translationServiceMetaMap[service.type];
	return service.name?.trim() ? service.name : formatMessage(meta.messageId);
};

export const createTranslationServiceInstanceId = (
	type: TranslationServiceType,
) =>
	`${type}@${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
