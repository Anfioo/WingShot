import { useCallback, useContext, useRef, useState } from "react";
import { AntdContext } from "@/contexts/antdContext";
import { AppSettingsActionContext } from "@/contexts/appSettingsActionContext";
import { useAppSettingsLoad } from "@/hooks/useAppSettingsLoad";
import { useStateRef } from "@/hooks/useStateRef";
import type {
	AppSettingsData,
	TranslationServiceInstance,
} from "@/types/appSettings";
import { AppSettingsGroup } from "@/types/appSettings";
import { TranslationDomain } from "@/types/servies/translation";
import { appError } from "@/utils/log";
import { translateWithServiceQueue } from "./services";

export const useTranslationRequest = (options?: {
	/// 配置从 Cache 中加载
	enableCacheConfig?: boolean;
	onComplete?: (
		result: { content: string }[],
		requestId?: number,
		service?: TranslationServiceInstance,
	) => void;
}) => {
	const { message } = useContext(AntdContext);
	const { updateAppSettings } = useContext(AppSettingsActionContext);

	const [translationDomain, setTranslationDomain, translationDomainRef] =
		useStateRef<TranslationDomain>(TranslationDomain.General);
	const [sourceLanguage, setSourceLanguage, sourceLanguageRef] =
		useStateRef<string>("auto");
	const [targetLanguage, setTargetLanguage, targetLanguageRef] =
		useStateRef<string>("zh-CHS");
	const [translationServices, setTranslationServices, translationServicesRef] =
		useStateRef<TranslationServiceInstance[]>([]);
	const [
		autoTranslationLanguagePair,
		setAutoTranslationLanguagePair,
		autoTranslationLanguagePairRef,
	] = useStateRef<[string, string]>(["zh-CHS", "en"]);

	useAppSettingsLoad(
		useCallback(
			(settings: AppSettingsData) => {
				setAutoTranslationLanguagePair(
					settings[AppSettingsGroup.FunctionTranslation]
						.autoTranslationLanguagePair,
				);

				if (options?.enableCacheConfig) {
					setTranslationDomain(
						settings[AppSettingsGroup.FunctionTranslationCache]
							.cacheTranslationDomain,
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
					setSourceLanguage(
						settings[AppSettingsGroup.FunctionTranslation].sourceLanguage,
					);
					setTargetLanguage(
						settings[AppSettingsGroup.FunctionTranslation].targetLanguage,
					);
				}

				setTranslationServices(
					settings[AppSettingsGroup.FunctionTranslation].translationServices,
				);
			},
			[
				setSourceLanguage,
				setTargetLanguage,
				setTranslationDomain,
				setTranslationServices,
				setAutoTranslationLanguagePair,
				options?.enableCacheConfig,
			],
		),
		true,
	);

	const [startTranslateLoading, setStartTranslateLoading] = useState(false);
	const [deltaTranslateLoading] = useState(false);
	const [translatedContent, setTranslatedContent, translatedContentRef] =
		useStateRef<string>("");
	const [usedTranslationService, setUsedTranslationService] =
		useState<TranslationServiceInstance>();
	const [detectedSourceLanguage, setDetectedSourceLanguage] = useState<
		string | undefined
	>(undefined);
	const requestSequenceRef = useRef(0);

	const requestTranslate = useCallback(
		async (
			sourceContent: string[],
			requestId?: number,
			translationServicesOverride?: TranslationServiceInstance[],
		) => {
			const currentRequestSequence = requestSequenceRef.current + 1;
			requestSequenceRef.current = currentRequestSequence;
			const services =
				translationServicesOverride ?? translationServicesRef.current;
			const translationDomain = translationDomainRef.current;
			const sourceLanguage = sourceLanguageRef.current;
			const targetLanguage = targetLanguageRef.current;
			const autoPair = autoTranslationLanguagePairRef.current;

			setStartTranslateLoading(true);
			setUsedTranslationService(undefined);
			setTranslatedContent("");
			try {
				// 目标语言为 auto 时，按「自动互转语言对」推导目标语言：
				// - 源语言已知且在语言对内 → 目标为另一侧
				// - 源语言也未知 → 先以语言对第一侧为目标探测一次，利用
				//   服务返回的源语言检测结果判断翻译方向
				let effectiveSource = sourceLanguage;
				let effectiveTarget = targetLanguage;
				let probeResult:
					| Awaited<ReturnType<typeof translateWithServiceQueue>>
					| undefined;

				if (targetLanguage === "auto") {
					if (sourceLanguage === "auto") {
						const probe = await translateWithServiceQueue({
							services,
							sourceContent,
							sourceLanguage: "auto",
							targetLanguage: autoPair[0],
							domain: translationDomain,
						});

						if (probe.detectedSourceLanguage === autoPair[0]) {
							// 源语言就是语言对第一侧（如简体中文）→ 目标应为第二侧（如英语）
							effectiveSource = "auto";
							effectiveTarget = autoPair[1];
						} else {
							// 源语言是第二侧或其它语言 → 目标为第一侧已正确，直接复用探测结果
							probeResult = probe;
							effectiveTarget = autoPair[0];
						}
					} else {
						// 源语言已知：目标取语言对的另一侧；源不在语言对内时回退到第二侧
						effectiveTarget =
							sourceLanguage === autoPair[0]
								? autoPair[1]
								: sourceLanguage === autoPair[1]
									? autoPair[0]
									: autoPair[1];
					}
				}

				const translateResult =
					probeResult ??
					(await translateWithServiceQueue({
						services,
						sourceContent,
						sourceLanguage: effectiveSource,
						targetLanguage: effectiveTarget,
						domain: translationDomain,
					}));
				const { result, service } = translateResult;

				if (currentRequestSequence !== requestSequenceRef.current) {
					return;
				}

				setUsedTranslationService(service);
				options?.onComplete?.(result, requestId, service);
				setTranslatedContent(result.map((item) => item.content).join("\n"));
				// 记录检测出的源语言（自动识别/自动互转场景），供 UI 展示翻译源
				if (translateResult.detectedSourceLanguage) {
					setDetectedSourceLanguage(translateResult.detectedSourceLanguage);
				}
			} catch (error) {
				if (currentRequestSequence !== requestSequenceRef.current) {
					return;
				}
				appError("[requestTranslate] translateWithServiceQueue error", error);
				message.error(
					error instanceof Error ? error.message : "Translation failed",
				);
			} finally {
				if (currentRequestSequence === requestSequenceRef.current) {
					setStartTranslateLoading(false);
				}
			}
		},
		[
			translationServicesRef,
			translationDomainRef,
			sourceLanguageRef,
			targetLanguageRef,
			autoTranslationLanguagePairRef,
			setTranslatedContent,
			message,
			options,
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

	const updateTranslationServices = useCallback(
		(translationServices: TranslationServiceInstance[]) => {
			updateAppSettings(
				AppSettingsGroup.FunctionTranslation,
				{ translationServices },
				true,
				true,
				true,
				true,
				false,
			);
		},
		[updateAppSettings],
	);

	const updateAutoTranslationLanguagePair = useCallback(
		(autoTranslationLanguagePair: [string, string]) => {
			updateAppSettings(
				AppSettingsGroup.FunctionTranslation,
				{ autoTranslationLanguagePair },
				true,
				true,
				true,
				true,
				false,
			);
		},
		[updateAppSettings],
	);

	const getTranslatedContent = useCallback(() => {
		return translatedContentRef.current;
	}, [translatedContentRef]);

	return {
		updateTranslationDomain,
		updateSourceLanguage,
		updateTargetLanguage,
		updateTranslationServices,
		updateAutoTranslationLanguagePair,
		requestTranslate,
		startTranslateLoading,
		deltaTranslateLoading,
		translatedContent,
		translationDomain,
		sourceLanguage,
		targetLanguage,
		translationServices,
		autoTranslationLanguagePair,
		usedTranslationService,
		getTranslatedContent,
		detectedSourceLanguage,
	};
};
