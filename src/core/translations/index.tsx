import { useCallback, useContext, useEffect, useState } from "react";
import { useIntl } from "react-intl";
import { AntdContext } from "@/contexts/antdContext";
import { AppSettingsActionContext } from "@/contexts/appSettingsActionContext";
import { useAppSettingsLoad } from "@/hooks/useAppSettingsLoad";
import { useStateRef } from "@/hooks/useStateRef";
import {
	convertLanguageCodeToDeepLSourceLanguageCode,
	convertLanguageCodeToDeepLTargetLanguageCode,
} from "@/pages/settings/functionSettings/extra";
import type { ServiceResponse } from "@/services/tools";
import {
	translate,
	translateTextCustomWithLimits,
	translateTextDeepL,
	translateTextGoogle,
	translateTextMicrosoft,
} from "@/services/tools/translation";
import {
	type AppSettingsData,
	AppSettingsGroup,
	type TranslationApiConfig,
	TranslationApiType,
} from "@/types/appSettings";
import {
	type DeepLTranslateResult,
	type TranslateData,
	TranslationDomain,
	TranslationType,
} from "@/types/servies/translation";
import { appError } from "@/utils/log";

export type TranslationServiceConfig =
	| {
			name: string;
			type: TranslationType;
			isOfficial: true;
	  }
	| {
			name: string;
			type: TranslationApiType;
			translationApiConfig: TranslationApiConfig;
			isOfficial: false;
	  };

export const useTranslationRequest = (options?: {
	/// 配置从 Cache 中加载
	enableCacheConfig?: boolean;
	onComplete?: (result: { content: string }[], requestId?: number) => void;
}) => {
	const intl = useIntl();
	const { message } = useContext(AntdContext);

	// 翻译领域
	const [translationDomain, setTranslationDomain, translationDomainRef] =
		useStateRef<TranslationDomain>(TranslationDomain.General);
	// 翻译类型
	const [translationType, setTranslationType, translationTypeRef] = useStateRef<
		TranslationType | string
	>(TranslationType.Youdao);
	// 源语言
	const [sourceLanguage, setSourceLanguage, sourceLanguageRef] =
		useStateRef<string>("auto");
	// 目标语言
	const [targetLanguage, setTargetLanguage, targetLanguageRef] =
		useStateRef<string>("zh-CHS");

	/// 用户自定义的翻译 API 配置
	const [translationApiConfigList, setTranslationApiConfigList] = useState<
		TranslationApiConfig[] | undefined
	>(undefined);

	useAppSettingsLoad(
		useCallback(
			(settings: AppSettingsData) => {
				if (options?.enableCacheConfig) {
					setTranslationDomain(
						settings[AppSettingsGroup.FunctionTranslationCache]
							.cacheTranslationDomain,
					);
					setTranslationType(
						settings[AppSettingsGroup.FunctionTranslationCache]
							.cacheTranslationType,
					);
					setSourceLanguage(
						settings[AppSettingsGroup.FunctionTranslationCache]
							.cacheSourceLanguage,
					);
					setTargetLanguage(
						settings[AppSettingsGroup.FunctionTranslationCache]
							.cacheTargetLanguage,
					);
				} else {
					setTranslationDomain(
						settings[AppSettingsGroup.FunctionTranslation].translationDomain,
					);
					setTranslationType(
						settings[AppSettingsGroup.FunctionTranslation].translationType,
					);
					setSourceLanguage(
						settings[AppSettingsGroup.FunctionTranslation].sourceLanguage,
					);
					setTargetLanguage(
						settings[AppSettingsGroup.FunctionTranslation].targetLanguage,
					);
				}

				setTranslationApiConfigList(
					settings[AppSettingsGroup.FunctionTranslation]
						.translationApiConfigList,
				);
			},
			[
				setSourceLanguage,
				setTargetLanguage,
				setTranslationDomain,
				setTranslationType,
				options?.enableCacheConfig,
			],
		),
		true,
	);
	const { updateAppSettings } = useContext(AppSettingsActionContext);

	const [
		supportedTranslationTypes,
		setSupportedTranslationTypes,
		supportedTranslationTypesRef,
	] = useStateRef<TranslationServiceConfig[]>([]);

	const getTranslationApiConfigTypeName = useCallback(
		(apiConfigType: TranslationApiType) => {
			switch (apiConfigType) {
				case TranslationApiType.DeepL:
					return intl.formatMessage({ id: "tools.translation.type.deepl" });
				case TranslationApiType.Custom:
					return intl.formatMessage({ id: "tools.translation.type.custom" });
				default:
					return apiConfigType;
			}
		},
		[intl],
	);

	const [
		supportedTranslationTypesLoading,
		setSupportedTranslationTypesLoading,
	] = useState(false);
	useEffect(() => {
		setSupportedTranslationTypesLoading(true);
		setSupportedTranslationTypes([
			{
				type: TranslationType.Youdao,
				name: intl.formatMessage({ id: "tools.translation.type.youdao" }),
				isOfficial: true,
			},
			{
				type: TranslationType.Google,
				name: intl.formatMessage({ id: "tools.translation.type.google" }),
				isOfficial: true,
			},
			{
				type: TranslationType.Microsoft,
				name: intl.formatMessage({ id: "tools.translation.type.microsoft" }),
				isOfficial: true,
			},
			...(translationApiConfigList?.map((item): TranslationServiceConfig => {
				return {
					type: item.api_type,
					name: getTranslationApiConfigTypeName(item.api_type),
					translationApiConfig: item,
					isOfficial: false,
				};
			}) ?? []),
		]);
		setSupportedTranslationTypesLoading(false);
	}, [
		setSupportedTranslationTypes,
		translationApiConfigList,
		getTranslationApiConfigTypeName,
		intl,
	]);

	// 请求翻译的加载
	const [startTranslateLoading, setStartTranslateLoading] = useState(false);
	// 翻译内容的加载
	const [deltaTranslateLoading] = useState(false);
	const [translatedContent, setTranslatedContent, translatedContentRef] =
		useStateRef<string>("");

	const customTranslation = useCallback(
		async (params: {
			sourceContent: string[];
			sourceLanguage: string;
			targetLanguage: string;
			translationType: string;
			requestId?: number;
		}): Promise<{
			success: boolean;
			result?: {
				content: string;
			}[];
		}> => {
			const config = supportedTranslationTypesRef.current.find(
				(item) => item.type === params.translationType,
			);

			if (!config || typeof config.type !== "string") {
				return {
					success: false,
				};
			}

			if ("translationApiConfig" in config) {
				const apiConfig = config.translationApiConfig;

				if (apiConfig.api_type === TranslationApiType.DeepL) {
					setStartTranslateLoading(true);

					let result: DeepLTranslateResult | undefined;
					try {
						result = await translateTextDeepL(
							apiConfig.api_uri,
							apiConfig.api_key,
							params.sourceContent,
							convertLanguageCodeToDeepLSourceLanguageCode(
								params.sourceLanguage,
							),
							convertLanguageCodeToDeepLTargetLanguageCode(
								params.targetLanguage,
							),
							apiConfig.deepl_prefer_quality_optimized ?? false,
						);
					} catch (error) {
						appError("[customTranslation] translateTextDeepL error", error);
					}

					setStartTranslateLoading(false);

					if (!result) {
						return {
							success: false,
						};
					}

					options?.onComplete?.(
						result.translations.map((item) => ({
							content: item.text,
						})),
						params.requestId,
					);

					return {
						success: true,
						result: result.translations.map((item) => ({
							content: item.text,
						})),
					};
				}

				if (apiConfig.api_type === TranslationApiType.Custom) {
					setStartTranslateLoading(true);

					let result: Awaited<ReturnType<typeof translateTextCustomWithLimits>>;
					try {
						result = await translateTextCustomWithLimits(
							apiConfig,
							params.sourceContent,
							params.sourceLanguage,
							params.targetLanguage,
						);
					} catch (error) {
						appError("[customTranslation] translateTextCustom error", error);
					}

					setStartTranslateLoading(false);

					if (!result) {
						return {
							success: false,
						};
					}

					options?.onComplete?.(
						result.translations.map((item) => ({
							content: item.text,
						})),
						params.requestId,
					);

					return {
						success: true,
						result: result.translations.map((item) => ({
							content: item.text,
						})),
					};
				}
			}

			return {
				success: false,
			};
		},
		[supportedTranslationTypesRef, options],
	);

	const requestTranslate = useCallback(
		async (sourceContent: string[], requestId?: number) => {
			const translationType = translationTypeRef.current;
			const translationDomain = translationDomainRef.current;
			const sourceLanguage = sourceLanguageRef.current;
			const targetLanguage = targetLanguageRef.current;

			if (typeof translationType === "string") {
				const result = await customTranslation({
					sourceContent: sourceContent,
					sourceLanguage: sourceLanguage,
					targetLanguage: targetLanguage,
					translationType: translationType,
					requestId: requestId,
				});
				if (result.success) {
					return;
				}
				return;
			}

			const officialTranslationType = [
				TranslationType.Youdao,
				TranslationType.Google,
				TranslationType.Microsoft,
			].includes(translationType as TranslationType)
				? (translationType as TranslationType)
				: TranslationType.Youdao;

			// 谷歌翻译
			if (officialTranslationType === TranslationType.Google) {
				setStartTranslateLoading(true);
				const result = await translateTextGoogle(
					sourceContent,
					sourceLanguage,
					targetLanguage,
				);
				setStartTranslateLoading(false);

				if (result) {
					const translatedResults = result.translations.map((item) => ({
						content: item.text,
					}));
					options?.onComplete?.(translatedResults, requestId);
					setTranslatedContent(
						translatedResults.map((item) => item.content).join("\n"),
					);
				}
				return;
			}

			// 微软翻译
			if (officialTranslationType === TranslationType.Microsoft) {
				setStartTranslateLoading(true);
				const result = await translateTextMicrosoft(
					sourceContent,
					sourceLanguage,
					targetLanguage,
				);
				setStartTranslateLoading(false);

				if (result) {
					const translatedResults = result.translations.map((item) => ({
						content: item.text,
					}));
					options?.onComplete?.(translatedResults, requestId);
					setTranslatedContent(
						translatedResults.map((item) => item.content).join("\n"),
					);
				}
				return;
			}

			setStartTranslateLoading(true);
			let translateResult:
				| ServiceResponse<TranslateData | undefined>
				| undefined;
			try {
				translateResult = await translate({
					content: sourceContent,
					from: sourceLanguage,
					to: targetLanguage,
					domain: translationDomain,
					type: officialTranslationType,
				});
			} catch (error) {
				appError("[requestTranslate] error", error);
				message.error("-1: Unknown error");
			}

			setStartTranslateLoading(false);

			if (
				!translateResult ||
				!translateResult.success() ||
				!translateResult.data?.results.length
			) {
				return;
			}

			options?.onComplete?.(translateResult.data?.results, requestId);
			setTranslatedContent(
				translateResult.data?.results.map((item) => item.content).join("\n") ??
					"",
			);
		},
		[
			customTranslation,
			options,
			sourceLanguageRef,
			message,
			targetLanguageRef,
			translationDomainRef,
			translationTypeRef,
			setTranslatedContent,
		],
	);

	const updateTranslationDomain = useCallback(
		(translationDomain: TranslationDomain) => {
			if (options?.enableCacheConfig) {
				updateAppSettings(
					AppSettingsGroup.FunctionTranslationCache,
					{ cacheTranslationDomain: translationDomain },
					true,
					true,
					false,
					true,
					false,
				);
			} else {
				updateAppSettings(
					AppSettingsGroup.FunctionTranslation,
					{ translationDomain },
					true,
					true,
					true,
					true,
					false,
				);
			}
		},
		[updateAppSettings, options?.enableCacheConfig],
	);

	const updateTranslationType = useCallback(
		(translationType: TranslationType | string) => {
			if (options?.enableCacheConfig) {
				updateAppSettings(
					AppSettingsGroup.FunctionTranslationCache,
					{ cacheTranslationType: translationType },
					true,
					true,
					false,
					true,
					false,
				);
			} else {
				updateAppSettings(
					AppSettingsGroup.FunctionTranslation,
					{ translationType },
					true,
					true,
					true,
					true,
					false,
				);
			}
		},
		[updateAppSettings, options?.enableCacheConfig],
	);

	const updateSourceLanguage = useCallback(
		(sourceLanguage: string) => {
			if (options?.enableCacheConfig) {
				updateAppSettings(
					AppSettingsGroup.FunctionTranslationCache,
					{ cacheSourceLanguage: sourceLanguage },
					true,
					true,
					false,
					true,
					false,
				);
			} else {
				updateAppSettings(
					AppSettingsGroup.FunctionTranslation,
					{ sourceLanguage },
					true,
					true,
					true,
					true,
					false,
				);
			}
		},
		[updateAppSettings, options?.enableCacheConfig],
	);

	const updateTargetLanguage = useCallback(
		(targetLanguage: string) => {
			if (options?.enableCacheConfig) {
				updateAppSettings(
					AppSettingsGroup.FunctionTranslationCache,
					{ cacheTargetLanguage: targetLanguage },
					true,
					true,
					false,
					true,
					false,
				);
			} else {
				updateAppSettings(
					AppSettingsGroup.FunctionTranslation,
					{ targetLanguage },
					true,
					true,
					true,
					true,
					false,
				);
			}
		},
		[updateAppSettings, options?.enableCacheConfig],
	);

	const getTranslatedContent = useCallback(() => {
		return translatedContentRef.current;
	}, [translatedContentRef]);

	return {
		updateTranslationDomain,
		updateTranslationType,
		updateSourceLanguage,
		updateTargetLanguage,
		requestTranslate,
		startTranslateLoading,
		deltaTranslateLoading,
		translatedContent,
		translationType,
		translationDomain,
		sourceLanguage,
		targetLanguage,
		supportedTranslationTypes,
		supportedTranslationTypesLoading,
		getTranslatedContent,
	};
};
