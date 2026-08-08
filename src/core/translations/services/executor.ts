import type { TranslationServiceInstance } from "@/types/appSettings";
import type { TranslationDomain } from "@/types/servies/translation";
import { appError } from "@/utils/log";
import { type TranslationAdapterResult, translationAdapters } from "./adapters";

export type TranslateWithServiceQueueParams = {
	services: TranslationServiceInstance[];
	sourceContent: string[];
	sourceLanguage: string;
	targetLanguage: string;
	domain: TranslationDomain;
};

export type TranslateWithServiceQueueResult = {
	service: TranslationServiceInstance;
	result: TranslationAdapterResult;
	/** 源语言检测结果（内部语言码，服务支持时提供） */
	detectedSourceLanguage?: string;
};

const hasUsefulResult = (result: TranslationAdapterResult) =>
	result.length > 0 && result.some((item) => item.content.trim() !== "");

export const translateWithServiceQueue = async ({
	services,
	sourceContent,
	sourceLanguage,
	targetLanguage,
	domain,
}: TranslateWithServiceQueueParams): Promise<TranslateWithServiceQueueResult> => {
	const enabledServices = services.filter((item) => item.enabled !== false);
	const errors: string[] = [];

	if (enabledServices.length === 0) {
		throw new Error("No enabled translation service");
	}

	for (const service of enabledServices) {
		const adapter = translationAdapters[service.type];
		if (!adapter) {
			errors.push(`${service.type}: adapter not found`);
			continue;
		}

		try {
			const result = await adapter({
				service,
				sourceContent,
				sourceLanguage,
				targetLanguage,
				domain,
			});

			if (hasUsefulResult(result)) {
				const detectedSourceLanguage = result.find(
					(item) => item.detectedSourceLanguage,
				)?.detectedSourceLanguage;
				return { service, result, detectedSourceLanguage };
			}

			errors.push(`${service.type}: empty result`);
		} catch (error) {
			const message = error instanceof Error ? error.message : `${error}`;
			errors.push(`${service.type}: ${message}`);
			appError(`[translateWithServiceQueue] ${service.type} failed`, error);
		}
	}

	throw new Error(errors.length > 0 ? errors.join("\n") : "Translation failed");
};
