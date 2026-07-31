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

	useAppSettingsLoad(
		useCallback(
			(settings: AppSettingsData) => {
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

			setStartTranslateLoading(true);
			setUsedTranslationService(undefined);
			setTranslatedContent("");
			try {
				const { result, service } = await translateWithServiceQueue({
					services,
					sourceContent,
					sourceLanguage,
					targetLanguage,
					domain: translationDomain,
				});

				if (currentRequestSequence !== requestSequenceRef.current) {
					return;
				}

				setUsedTranslationService(service);
				options?.onComplete?.(result, requestId, service);
				setTranslatedContent(result.map((item) => item.content).join("\n"));
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

	const getTranslatedContent = useCallback(() => {
		return translatedContentRef.current;
	}, [translatedContentRef]);

	return {
		updateTranslationDomain,
		updateSourceLanguage,
		updateTargetLanguage,
		updateTranslationServices,
		requestTranslate,
		startTranslateLoading,
		deltaTranslateLoading,
		translatedContent,
		translationDomain,
		sourceLanguage,
		targetLanguage,
		translationServices,
		usedTranslationService,
		getTranslatedContent,
	};
};
