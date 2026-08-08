import {
	CloseOutlined,
	ColumnHeightOutlined,
	ColumnWidthOutlined,
	CopyOutlined,
	SwapOutlined,
} from "@ant-design/icons";
import {
	Button,
	Col,
	Flex,
	Form,
	Row,
	Segmented,
	Select,
	type SelectProps,
	Spin,
	theme,
} from "antd";
import TextArea, { type TextAreaRef } from "antd/es/input/TextArea";
import { debounce } from "es-toolkit";
import React, {
	useCallback,
	useEffect,
	useImperativeHandle,
	useMemo,
	useRef,
	useState,
} from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { useTranslationRequest } from "@/core/translations";
import { translationServiceMetaMap } from "@/core/translations/services";
import { useStateRef } from "@/hooks/useStateRef";
import type { TranslationServiceInstance } from "@/types/appSettings";
import { TranslationDomain } from "@/types/servies/translation";
import { writeTextToClipboard } from "@/utils/clipboard";

const SelectLabel: React.FC<{
	label: React.ReactNode;
	code: React.ReactNode;
}> = ({ label, code }) => {
	const { token } = theme.useToken();
	return (
		<div className="language-item">
			<div className="language-item-label">{label}</div>
			<div className="language-item-code">{code}</div>

			<style jsx>{`
                .language-item {
                    position: relative;
                }

                .language-item-label {
                    display: inline;
                }

                .language-item-code {
                    display: inline;
                    color: ${token.colorTextDescription};
                    margin-left: ${token.marginXS}px;
                    font-size: 0.7em;
                    position: relative;
                    bottom: 0.15em;
                }
            `}</style>
		</div>
	);
};

type LanguageItem = {
	code: string;
	label: string;
};

const convertLanguageListToOptions = (
	list: LanguageItem[],
): SelectProps["options"] => {
	// 按首字母分组
	const groupedLanguages = list.reduce(
		(acc, lang) => {
			if (lang.code === "") {
				return acc;
			}

			const firstChar = lang.code.charAt(0).toUpperCase();
			if (!acc[firstChar]) {
				acc[firstChar] = [];
			}
			acc[firstChar].push(lang);
			return acc;
		},
		{} as Record<string, LanguageItem[]>,
	);

	// 转换为 Select 选项格式
	return Object.entries(groupedLanguages).map(([key, languages]) => {
		return {
			label: <span>{key}</span>,
			title: key,
			options: languages.map((lang) => {
				const langCode = typeof lang.code === "string" ? lang.code : "";

				return {
					label: (
						<SelectLabel label={lang.label} code={langCode.toUpperCase()} />
					),
					title: `${lang.label}(${langCode.toLowerCase()})`,
					value: langCode,
				};
			}),
		};
	});
};

const selectFilterOption: SelectProps["filterOption"] = (input, option) => {
	if (!input || !option?.title) return false;
	const pattern = input.toLowerCase().split("").join(".*");
	const regex = new RegExp(pattern, "i");
	return regex.test(option.title.toString().toLowerCase());
};

/** 将单个语言项转换为平铺的 Select 选项（与分组内子项格式一致） */
const toFlatLanguageOption = (
	lang: LanguageItem,
): NonNullable<SelectProps["options"]>[number] => {
	const langCode = typeof lang.code === "string" ? lang.code : "";
	return {
		label: <SelectLabel label={lang.label} code={langCode.toUpperCase()} />,
		title: `${lang.label}(${langCode.toLowerCase()})`,
		value: langCode,
	};
};

export type TranslatorActionType = {
	setSourceContent: (content: string, ignoreDebounce?: boolean) => void;
	getSourceContentRef: () => TextAreaRef | null;
	getTranslatedContent: () => { content: string }[];
};

export const useLanguageOptions = () => {
	const intl = useIntl();

	// 完整语言列表（含「自动」），源语言与目标语言共用同一份列表与排序，
	// 保证两个下拉的选项顺序、分组完全一致
	const languageList = useMemo(() => {
		const list: LanguageItem[] = [
			{
				code: "auto",
				label: intl.formatMessage({
					id: "tools.translation.language.autoTarget",
				}),
			},
			{
				code: "en",
				label: intl.formatMessage({ id: "tools.translation.language.english" }),
			},
			{
				code: "zh-CHS",
				label: intl.formatMessage({
					id: "tools.translation.language.simplifiedChinese",
				}),
			},
			{
				code: "zh-CHT",
				label: intl.formatMessage({
					id: "tools.translation.language.traditionalChinese",
				}),
			},
			{
				code: "es",
				label: intl.formatMessage({ id: "tools.translation.language.spanish" }),
			},
			{
				code: "fr",
				label: intl.formatMessage({ id: "tools.translation.language.french" }),
			},
			{
				code: "ar",
				label: intl.formatMessage({ id: "tools.translation.language.arabic" }),
			},
			{
				code: "de",
				label: intl.formatMessage({ id: "tools.translation.language.german" }),
			},
			{
				code: "it",
				label: intl.formatMessage({ id: "tools.translation.language.italian" }),
			},
			{
				code: "ja",
				label: intl.formatMessage({
					id: "tools.translation.language.japanese",
				}),
			},
			{
				code: "pt",
				label: intl.formatMessage({
					id: "tools.translation.language.portuguese",
				}),
			},
			{
				code: "ru",
				label: intl.formatMessage({ id: "tools.translation.language.russian" }),
			},
			{
				code: "tr",
				label: intl.formatMessage({ id: "tools.translation.language.turkish" }),
			},
		];

		return [...list].sort((a, b) => {
			if (a.code === "auto") {
				return -1;
			}
			if (b.code === "auto") {
				return 1;
			}
			return a.code.localeCompare(b.code);
		});
	}, [intl]);

	const targetLanguageOptions = useMemo(() => {
		// 「自动」作为独立项置顶，其余语言按首字母分组
		const autoItem = languageList.find((item) => item.code === "auto");
		const restOptions = convertLanguageListToOptions(
			languageList.filter((item) => item.code !== "auto"),
		);
		return autoItem
			? [toFlatLanguageOption(autoItem), ...(restOptions ?? [])]
			: (restOptions ?? []);
	}, [languageList]);

	const sourceLanguageOptions = useMemo(() => {
		// 与目标语言一致：「自动」独立置顶，仅文案不同（自动识别语言）
		const sourceList = languageList.map((item) =>
			item.code === "auto"
				? {
						...item,
						label: intl.formatMessage({
							id: "tools.translation.language.auto",
						}),
					}
				: item,
		);
		const autoItem = sourceList.find((item) => item.code === "auto");
		const restOptions = convertLanguageListToOptions(
			sourceList.filter((item) => item.code !== "auto"),
		);
		return autoItem
			? [toFlatLanguageOption(autoItem), ...(restOptions ?? [])]
			: (restOptions ?? []);
	}, [languageList, intl]);

	// 具体语言选项（不含 auto），用于「自动互转语言对」等只允许选具体语言的场景
	const concreteLanguageOptions = useMemo(() => {
		return convertLanguageListToOptions(
			languageList.filter((item) => item.code !== "auto"),
		);
	}, [languageList]);

	// 语言码 → 语言名（用于展示检测出的源语言）
	const getLanguageLabel = useCallback(
		(code?: string): string | undefined => {
			if (!code) {
				return undefined;
			}
			return languageList.find((item) => item.code === code)?.label;
		},
		[languageList],
	);

	return {
		sourceLanguageOptions,
		targetLanguageOptions,
		concreteLanguageOptions,
		getLanguageLabel,
	};
};

export const useTranslationDomainOptions = () => {
	const intl = useIntl();

	return useMemo(
		() => [
			{
				label: intl.formatMessage({
					id: "tools.translation.domain.general",
				}),
				value: TranslationDomain.General,
			},
			{
				label: intl.formatMessage({
					id: "tools.translation.domain.computers",
				}),
				value: TranslationDomain.Computers,
			},
			{
				label: intl.formatMessage({
					id: "tools.translation.domain.medicine",
				}),
				value: TranslationDomain.Medicine,
			},
			{
				label: intl.formatMessage({
					id: "tools.translation.domain.finance",
				}),
				value: TranslationDomain.Finance,
			},
			{
				label: intl.formatMessage({
					id: "tools.translation.domain.game",
				}),
				value: TranslationDomain.Game,
			},
		],
		[intl],
	);
};

const translationSourceModes = ["auto", "manual"] as const;
type TranslationSourceMode = (typeof translationSourceModes)[number];

const TranslatorCore: React.FC<{
	actionRef: React.RefObject<TranslatorActionType | undefined>;
}> = ({ actionRef }) => {
	const intl = useIntl();

	const { token } = theme.useToken();

	const { sourceLanguageOptions, targetLanguageOptions } = useLanguageOptions();
	const translationDomainOptions = useTranslationDomainOptions();

	const translatedResultRef = useRef<{ content: string }[]>([]);
	const {
		sourceLanguage,
		targetLanguage,
		translationDomain,
		translationServices,
		startTranslateLoading,
		deltaTranslateLoading,
		updateSourceLanguage,
		updateTargetLanguage,
		updateTranslationDomain,
		requestTranslate,
		translatedContent,
		usedTranslationService,
		getTranslatedContent,
	} = useTranslationRequest(
		useMemo(() => {
			return {
				onComplete: (result) => {
					translatedResultRef.current = result;
				},
				enableCacheConfig: true,
			};
		}, []),
	);

	const getTranslationServiceName = useCallback(
		(service: TranslationServiceInstance) => {
			const meta = translationServiceMetaMap[service.type];
			return service.name?.trim()
				? service.name
				: intl.formatMessage({ id: meta.messageId });
		},
		[intl],
	);
	const [translationSourceMode, setTranslationSourceMode] =
		useState<TranslationSourceMode>("auto");
	const [selectedTranslationServiceId, setSelectedTranslationServiceId] =
		useState<string>();
	const enabledTranslationServices = useMemo(
		() => translationServices.filter((service) => service.enabled !== false),
		[translationServices],
	);
	const translationServiceOptions = useMemo(
		() =>
			enabledTranslationServices.map((service) => ({
				label: getTranslationServiceName(service),
				value: service.id,
			})),
		[enabledTranslationServices, getTranslationServiceName],
	);

	useEffect(() => {
		const fallbackService = enabledTranslationServices[0];
		if (!fallbackService) {
			setSelectedTranslationServiceId(undefined);
			return;
		}

		if (
			!selectedTranslationServiceId ||
			!enabledTranslationServices.some(
				(service) => service.id === selectedTranslationServiceId,
			)
		) {
			setSelectedTranslationServiceId(fallbackService.id);
		}
	}, [enabledTranslationServices, selectedTranslationServiceId]);

	const selectedTranslationService = useMemo(
		() =>
			enabledTranslationServices.find(
				(service) => service.id === selectedTranslationServiceId,
			),
		[enabledTranslationServices, selectedTranslationServiceId],
	);
	const activeTranslationServices = useMemo(() => {
		if (translationSourceMode === "manual" && selectedTranslationService) {
			return [selectedTranslationService];
		}

		return translationServices;
	}, [selectedTranslationService, translationServices, translationSourceMode]);

	const ignoreDebounceRef = useRef<boolean>(false);
	const [sourceContent, setSourceContent] = useStateRef<string>("");

	const [translationLayout, setTranslationLayout] = useState<
		"horizontal" | "vertical"
	>(() => {
		const saved = localStorage.getItem("translation-layout");
		return saved === "vertical" ? "vertical" : "horizontal";
	});
	useEffect(() => {
		localStorage.setItem("translation-layout", translationLayout);
	}, [translationLayout]);
	const isVerticalLayout = translationLayout === "vertical";

	const requestTranslateDebounce = useMemo(
		() => debounce(requestTranslate, 1500),
		[requestTranslate],
	);

	// biome-ignore lint/correctness/useExhaustiveDependencies: 翻译相关配置变更的时候也要重新翻译
	useEffect(() => {
		if (sourceContent.trim() === "") {
			return;
		}

		if (ignoreDebounceRef.current) {
			ignoreDebounceRef.current = false;
			setTimeout(() => {
				requestTranslate([sourceContent], undefined, activeTranslationServices);
			}, 17);
		} else {
			requestTranslateDebounce(
				[sourceContent],
				undefined,
				activeTranslationServices,
			);
		}
	}, [
		sourceContent,
		requestTranslateDebounce,
		requestTranslate,
		sourceLanguage,
		targetLanguage,
		translationDomain,
		activeTranslationServices,
	]);

	const onCopy = useCallback(() => {
		if (!getTranslatedContent()) {
			return;
		}
		writeTextToClipboard(getTranslatedContent());
	}, [getTranslatedContent]);

	const hasSourceContent = !!sourceContent;
	const hasTranslatedContent = !!translatedContent;
	// 翻译源（翻译服务）：自动模式下展示「自动」，翻译完成后显示实际使用的服务名；
	// 手动模式下由用户自行选择翻译服务
	const usedServiceName = useMemo(() => {
		if (!usedTranslationService) return "";
		return getTranslationServiceName(usedTranslationService);
	}, [getTranslationServiceName, usedTranslationService]);
	const autoSourceLabel =
		hasTranslatedContent && usedServiceName
			? usedServiceName
			: intl.formatMessage({ id: "tools.translation.sourceMode.auto" });
	const translationSourceOptions = useMemo(
		() =>
			translationSourceModes.map((mode) => ({
				label: intl.formatMessage({
					id: `tools.translation.sourceMode.${mode}`,
				}),
				value: mode,
			})),
		[intl],
	);

	const sourceContentRef = useRef<TextAreaRef>(null);
	useImperativeHandle(
		actionRef,
		useCallback(
			() => ({
				setSourceContent: (content: string, ignoreDebounce?: boolean) => {
					setSourceContent(content);
					ignoreDebounceRef.current = ignoreDebounce ?? false;
				},
				getSourceContentRef: () => sourceContentRef.current,
				getTranslatedContent: () => translatedResultRef.current,
			}),
			[setSourceContent],
		),
	);

	return (
		<>
			{/* 用表单处理下样式，但不用表单处理数据验证 */}
			<Form className="tool-translator-container" layout="vertical">
				<Flex gap={0} justify="space-between">
					<Flex gap={0} align="center">
						<Form.Item
							style={{ marginBottom: token.marginXS }}
							label={<FormattedMessage id="tools.translation.sourceLanguage" />}
						>
							<Select
								value={sourceLanguage}
								showSearch
								onChange={(value) => updateSourceLanguage(value)}
								options={sourceLanguageOptions}
								variant="underlined"
								styles={{
									popup: {
										root: {
											minWidth: 200,
										},
									},
								}}
								filterOption={selectFilterOption}
							/>
						</Form.Item>
						<Button
							type="link"
							disabled={
								sourceLanguage === "auto" ||
								targetLanguage === "auto" ||
								sourceLanguage === targetLanguage
							}
							icon={<SwapOutlined />}
							style={{ marginTop: token.margin }}
							onClick={() => {
								updateSourceLanguage(targetLanguage);
								updateTargetLanguage(sourceLanguage);
							}}
						/>
						<Form.Item
							style={{ marginBottom: token.marginXS }}
							label={<FormattedMessage id="tools.translation.targetLanguage" />}
						>
							<Select
								showSearch
								value={targetLanguage}
								onChange={(value) => {
									updateTargetLanguage(value);
								}}
								options={targetLanguageOptions}
								filterOption={selectFilterOption}
								styles={{
									popup: {
										root: {
											minWidth: 200,
										},
									},
								}}
								variant="underlined"
							/>
						</Form.Item>
					</Flex>
					<Flex gap={token.margin} align="flex-start" justify="end">
						<Form.Item
							style={{ marginBottom: token.marginXS }}
							label={<FormattedMessage id="tools.translation.domain" />}
						>
							<Select
								showSearch
								value={translationDomain}
								onChange={(value) => {
									updateTranslationDomain(value);
								}}
								options={translationDomainOptions}
								filterOption={selectFilterOption}
								styles={{
									popup: {
										root: {
											minWidth: 200,
										},
									},
								}}
								variant="underlined"
							/>
						</Form.Item>
						<Form.Item
							style={{ marginBottom: token.marginXS }}
							label={<FormattedMessage id="tools.translation.source" />}
						>
							<Flex gap={token.marginXXS} align="center" justify="end">
								{translationSourceMode === "manual" ? (
									<Select
										value={selectedTranslationServiceId}
										onChange={(value) => {
											ignoreDebounceRef.current = true;
											setSelectedTranslationServiceId(value);
										}}
										options={translationServiceOptions}
										variant="underlined"
										placeholder={intl.formatMessage({
											id: "tools.translation.source.placeholder",
										})}
										disabled={translationServiceOptions.length === 0}
										style={{ minWidth: 160 }}
									/>
								) : (
									// 自动模式：翻译源（翻译服务）只读展示，翻译完成后显示实际使用的服务名
									<Select
										value="auto"
										options={[
											{
												value: "auto",
												label: autoSourceLabel,
											},
										]}
										variant="outlined"
										disabled
										style={{ minWidth: 120 }}
									/>
								)}
								<Segmented
									value={translationSourceMode}
									onChange={(value) => {
										ignoreDebounceRef.current = true;
										setTranslationSourceMode(value as TranslationSourceMode);
									}}
									options={translationSourceOptions}
								/>
							</Flex>
						</Form.Item>
						<Form.Item
							style={{ marginBottom: token.marginXS }}
							label={<FormattedMessage id="tools.translation.layout" />}
						>
							<Segmented
								value={translationLayout}
								onChange={(value) =>
									setTranslationLayout(value as "horizontal" | "vertical")
								}
								options={[
									{
										value: "horizontal",
										icon: <ColumnWidthOutlined />,
										title: intl.formatMessage({
											id: "tools.translation.layout.horizontal",
										}),
									},
									{
										value: "vertical",
										icon: <ColumnHeightOutlined />,
										title: intl.formatMessage({
											id: "tools.translation.layout.vertical",
										}),
									},
								]}
							/>
						</Form.Item>
					</Flex>
				</Flex>
				<Row
					gutter={[token.marginLG, isVerticalLayout ? token.marginLG : 0]}
					style={{ marginTop: token.marginXXS }}
				>
					<Col
						span={isVerticalLayout ? 24 : 12}
						style={{ position: "relative" }}
					>
						<TextArea
							rows={isVerticalLayout ? 6 : 12}
							maxLength={5000}
							showCount
							autoSize={{ minRows: isVerticalLayout ? 6 : 12 }}
							placeholder={intl.formatMessage({
								id: "tools.translation.placeholder",
							})}
							value={sourceContent}
							style={{ flex: 1 }}
							onChange={(e) => setSourceContent(e.target.value)}
							ref={sourceContentRef}
						/>

						<Button
							className="tool-translator-container-clear-button"
							type="text"
							shape="circle"
							icon={<CloseOutlined />}
							onClick={() => {
								setSourceContent("");
							}}
						/>
					</Col>
					<Col span={isVerticalLayout ? 24 : 12}>
						<Spin spinning={startTranslateLoading}>
							<div style={{ position: "relative" }}>
								<Spin
									spinning={deltaTranslateLoading}
									style={{
										position: "absolute",
										bottom: token.margin,
										right: token.marginLG,
									}}
								/>
								<TextArea
									rows={isVerticalLayout ? 6 : 12}
									variant="filled"
									style={{ flex: 1 }}
									autoSize={{ minRows: isVerticalLayout ? 6 : 12 }}
									readOnly
									value={translatedContent}
								/>

								<Flex
									className="tool-translator-container-translate-button-container"
									gap={token.marginXXS}
									align="center"
									justify="end"
								>
									<Button
										type="text"
										shape="circle"
										icon={<CopyOutlined />}
										onClick={onCopy}
									/>
								</Flex>
							</div>
						</Spin>
					</Col>
				</Row>
			</Form>

			<style jsx>{`
                :global(.tool-translator-container .ant-form-item-label) {
                    padding-bottom: ${token.paddingXXS}px !important;
                }

                :global(.tool-translator-container .ant-form-item-label label) {
                    font-size: 12px !important;
                    color: ${token.colorTextDescription} !important;
                }

                :global(.tool-translator-container .ant-input) {
                    padding-right: ${32 + token.marginXXS * 2}px !important;
                }

                :global(.tool-translator-container-clear-button) {
                    position: absolute !important;
                    right: ${token.paddingXS + token.marginXXS}px;
                    top: ${token.marginXXS}px;
                    z-index: 1;
                    pointer-events: ${hasSourceContent ? "auto" : "none"};
                    opacity: ${hasSourceContent ? 1 : 0};
                    transition: opacity ${token.motionDurationMid} ${token.motionEaseInOut};
                }

                :global(.tool-translator-container-translate-button-container) {
                    position: absolute;
                    bottom: ${token.marginXXS}px;
                    right: ${token.marginXXS}px;
                    z-index: 1;
                    pointer-events: ${hasTranslatedContent ? "auto" : "none"};
                    opacity: ${hasTranslatedContent ? 1 : 0};
                    transition: opacity ${token.motionDurationMid} ${token.motionEaseInOut};
                }
            `}</style>
		</>
	);
};

export const Translator = React.memo(TranslatorCore);
