import { SwapOutlined } from "@ant-design/icons";
import { ProForm } from "@ant-design/pro-components";
import { Button, Col, Flex, Row, Segmented, Select, theme } from "antd";
import { useEffect, useMemo, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import {
	useLanguageOptions,
	useTranslationDomainOptions,
} from "@/components/translator";
import { useTranslationRequest } from "@/core/translations";
import { getTranslationServiceName } from "@/core/translations/services";

export const TranslationConfig = () => {
	const { token } = theme.useToken();
	const intl = useIntl();

	const {
		sourceLanguage,
		updateSourceLanguage,
		targetLanguage,
		updateTargetLanguage,
		translationDomain,
		updateTranslationDomain,
		autoTranslationLanguagePair,
		updateAutoTranslationLanguagePair,
		translationServices,
	} = useTranslationRequest();
	const {
		sourceLanguageOptions,
		targetLanguageOptions,
		concreteLanguageOptions,
	} = useLanguageOptions();
	const translationDomainOptions = useTranslationDomainOptions();

	// 翻译源模式（自动/手动）与所选翻译源，与翻译面板共享 localStorage
	const [translationSourceMode, setTranslationSourceMode] = useState<
		"auto" | "manual"
	>(() => {
		const saved = localStorage.getItem("translation-source-mode");
		return saved === "manual" ? "manual" : "auto";
	});
	const [selectedTranslationServiceId, setSelectedTranslationServiceId] =
		useState<string | undefined>(() => {
			const saved = localStorage.getItem("translation-selected-service-id");
			return saved ?? undefined;
		});
	useEffect(() => {
		localStorage.setItem("translation-source-mode", translationSourceMode);
	}, [translationSourceMode]);
	useEffect(() => {
		if (selectedTranslationServiceId) {
			localStorage.setItem(
				"translation-selected-service-id",
				selectedTranslationServiceId,
			);
		}
	}, [selectedTranslationServiceId]);

	const enabledTranslationServices = useMemo(
		() => translationServices.filter((service) => service.enabled !== false),
		[translationServices],
	);
	const translationServiceOptions = useMemo(
		() =>
			enabledTranslationServices.map((service) => ({
				label: getTranslationServiceName(service, (id) =>
					intl.formatMessage({ id }),
				),
				value: service.id,
			})),
		[enabledTranslationServices, intl],
	);

	return (
		<Row gutter={token.marginLG}>
			<Col span={12}>
				<ProForm.Item
					layout="vertical"
					label={<FormattedMessage id="tools.translation.sourceLanguage" />}
				>
					<Select
						value={sourceLanguage}
						onChange={(value) => updateSourceLanguage(value)}
						options={sourceLanguageOptions}
						styles={{
							popup: {
								root: {
									minWidth: 200,
								},
							},
						}}
					/>
				</ProForm.Item>
			</Col>
			<Col span={12}>
				<ProForm.Item
					layout="vertical"
					label={<FormattedMessage id="tools.translation.targetLanguage" />}
				>
					<Select
						value={targetLanguage}
						onChange={(value) => updateTargetLanguage(value)}
						options={targetLanguageOptions}
						styles={{
							popup: {
								root: {
									minWidth: 200,
								},
							},
						}}
					/>
				</ProForm.Item>
			</Col>
			<Col span={12}>
				<ProForm.Item
					layout="vertical"
					label={<FormattedMessage id="tools.translation.domain" />}
				>
					<Select
						value={translationDomain}
						onChange={(value) => updateTranslationDomain(value)}
						options={translationDomainOptions}
					/>
				</ProForm.Item>
			</Col>
			<Col span={12}>
				<ProForm.Item
					layout="vertical"
					label={<FormattedMessage id="tools.translation.source" />}
				>
					<Flex gap={token.margin} align="center">
						<Segmented
							value={translationSourceMode}
							onChange={(value) =>
								setTranslationSourceMode(value as "auto" | "manual")
							}
							options={[
								{
									label: intl.formatMessage({
										id: "tools.translation.sourceMode.auto",
									}),
									value: "auto",
								},
								{
									label: intl.formatMessage({
										id: "tools.translation.sourceMode.manual",
									}),
									value: "manual",
								},
							]}
						/>
						{translationSourceMode === "manual" && (
							<Select
								value={selectedTranslationServiceId}
								onChange={setSelectedTranslationServiceId}
								options={translationServiceOptions}
								placeholder={intl.formatMessage({
									id: "tools.translation.source.placeholder",
								})}
								disabled={translationServiceOptions.length === 0}
								style={{ minWidth: 200 }}
							/>
						)}
					</Flex>
				</ProForm.Item>
			</Col>
			<Col span={24}>
				<ProForm.Item
					layout="vertical"
					label={<FormattedMessage id="tools.translation.autoPair" />}
					tooltip={<FormattedMessage id="tools.translation.autoPair.tooltip" />}
				>
					<div
						style={{
							display: "flex",
							alignItems: "center",
							gap: token.margin,
							maxWidth: 420,
						}}
					>
						<Select
							value={autoTranslationLanguagePair[0]}
							onChange={(value) =>
								updateAutoTranslationLanguagePair([
									value,
									autoTranslationLanguagePair[1],
								])
							}
							options={concreteLanguageOptions}
							style={{ flex: 1 }}
						/>
						<Button
							type="link"
							disabled={
								autoTranslationLanguagePair[0] ===
								autoTranslationLanguagePair[1]
							}
							icon={<SwapOutlined />}
							onClick={() =>
								updateAutoTranslationLanguagePair([
									autoTranslationLanguagePair[1],
									autoTranslationLanguagePair[0],
								])
							}
						/>
						<Select
							value={autoTranslationLanguagePair[1]}
							onChange={(value) =>
								updateAutoTranslationLanguagePair([
									autoTranslationLanguagePair[0],
									value,
								])
							}
							options={concreteLanguageOptions}
							style={{ flex: 1 }}
						/>
					</div>
				</ProForm.Item>
			</Col>
		</Row>
	);
};
