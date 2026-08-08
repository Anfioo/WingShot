import { SwapOutlined } from "@ant-design/icons";
import { ProForm } from "@ant-design/pro-components";
import { Button, Col, Row, Select, theme } from "antd";
import { FormattedMessage } from "react-intl";
import {
	useLanguageOptions,
	useTranslationDomainOptions,
} from "@/components/translator";
import { useTranslationRequest } from "@/core/translations";

export const TranslationConfig = () => {
	const { token } = theme.useToken();

	const {
		sourceLanguage,
		updateSourceLanguage,
		targetLanguage,
		updateTargetLanguage,
		translationDomain,
		updateTranslationDomain,
		autoTranslationLanguagePair,
		updateAutoTranslationLanguagePair,
	} = useTranslationRequest();
	const {
		sourceLanguageOptions,
		targetLanguageOptions,
		concreteLanguageOptions,
	} = useLanguageOptions();
	const translationDomainOptions = useTranslationDomainOptions();

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
