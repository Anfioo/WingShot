"use client";

import {
	ProForm,
	ProFormDependency,
	ProFormDigit,
	ProFormList,
	ProFormSelect,
	ProFormSwitch,
	ProFormText,
} from "@ant-design/pro-components";
import { Col, Flex, Form, Row, Spin, theme } from "antd";
import { useCallback, useContext, useMemo, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { ContentWrap } from "@/components/contentWrap";
import { GroupTitle } from "@/components/groupTitle";
import { IconLabel } from "@/components/iconLable";
import { ResetSettingsButton } from "@/components/resetSettingsButton";
import { AppSettingsActionContext } from "@/contexts/appSettingsActionContext";
import { useAppSettingsLoad } from "@/hooks/useAppSettingsLoad";
import {
	type AppSettingsData,
	AppSettingsGroup,
	TranslationApiType,
} from "@/types/appSettings";
import { TranslationConfig } from "./translationConfig";

export const TranslationSettingsPage = () => {
	const intl = useIntl();
	const { token } = theme.useToken();
	const { updateAppSettings } = useContext(AppSettingsActionContext);
	const [translationForm] =
		Form.useForm<AppSettingsData[AppSettingsGroup.FunctionTranslation]>();
	const [appSettingsLoading, setAppSettingsLoading] = useState(true);

	useAppSettingsLoad(
		useCallback(
			(settings: AppSettingsData, preSettings?: AppSettingsData) => {
				setAppSettingsLoading(false);

				if (
					preSettings === undefined ||
					preSettings[AppSettingsGroup.FunctionTranslation] !==
						settings[AppSettingsGroup.FunctionTranslation]
				) {
					translationForm.setFieldsValue(
						settings[AppSettingsGroup.FunctionTranslation],
					);
				}
			},
			[translationForm],
		),
	);

	const translationApiTypeOptions = useMemo(() => {
		return [
			{
				label: intl.formatMessage({
					id: "settings.functionSettings.translationSettings.apiConfig.apiType.deepL",
				}),
				value: TranslationApiType.DeepL,
			},
			{
				label: intl.formatMessage({
					id: "settings.functionSettings.translationSettings.apiConfig.apiType.custom",
				}),
				value: TranslationApiType.Custom,
			},
		];
	}, [intl]);

	return (
		<ContentWrap>
			<GroupTitle
				id="translationSettings"
				extra={
					<ResetSettingsButton
						title={
							<FormattedMessage id="settings.functionSettings.translationSettings" />
						}
						appSettingsGroup={AppSettingsGroup.FunctionTranslation}
					/>
				}
			>
				<FormattedMessage id="settings.functionSettings.translationSettings" />
			</GroupTitle>

			<Spin spinning={appSettingsLoading}>
				<TranslationConfig />

				<ProForm
					form={translationForm}
					onValuesChange={(_, values) => {
						updateAppSettings(
							AppSettingsGroup.FunctionTranslation,
							values,
							true,
							true,
							true,
							true,
							false,
						);
					}}
					submitter={false}
				>
					<Row gutter={token.marginLG}>
						<Col span={24}>
							<ProFormList
								name="translationApiConfigList"
								label={
									<IconLabel
										label={
											<FormattedMessage id="settings.functionSettings.translationSettings.apiConfig" />
										}
									/>
								}
								creatorButtonProps={{
									creatorButtonText: intl.formatMessage({
										id: "settings.functionSettings.translationSettings.apiConfig.add",
									}),
								}}
								className="api-config-list"
								min={0}
								itemRender={({ listDom, action }) => (
									<Flex align="end" justify="space-between">
										{listDom}
										<div>{action}</div>
									</Flex>
								)}
								creatorRecord={() => ({
									api_uri: "",
									api_key: "",
									api_type: TranslationApiType.DeepL,
								})}
							>
								<Row gutter={token.marginLG} style={{ width: "100%" }}>
									<Col span={12}>
										<ProFormSelect
											name="api_type"
											label={
												<IconLabel
													label={
														<FormattedMessage id="settings.functionSettings.translationSettings.apiConfig.apiType" />
													}
												/>
											}
											allowClear={false}
											options={translationApiTypeOptions}
										/>
									</Col>
									<Col span={12}>
										<ProFormText
											name="api_uri"
											label={
												<IconLabel
													label={
														<FormattedMessage id="settings.functionSettings.translationSettings.apiConfig.apiUri" />
													}
													tooltipTitle={
														<FormattedMessage id="settings.functionSettings.translationSettings.apiConfig.apiUri.tip" />
													}
												/>
											}
											rules={[
												{
													required: true,
													message: intl.formatMessage({
														id: "settings.functionSettings.translationSettings.apiConfig.apiUri.required",
													}),
												},
											]}
										/>
									</Col>
									<ProFormDependency<{ api_type: TranslationApiType }>
										name={["api_type"]}
									>
										{({ api_type }) => {
											if (api_type === TranslationApiType.DeepL) {
												return (
													<Col span={12}>
														<ProFormText.Password
															name="api_key"
															label={
																<IconLabel
																	label={
																		<FormattedMessage id="settings.functionSettings.translationSettings.apiConfig.apiKey" />
																	}
																	tooltipTitle={
																		<FormattedMessage id="settings.functionSettings.translationSettings.apiConfig.apiKey.tip" />
																	}
																/>
															}
															rules={[
																{
																	required: true,
																	message: intl.formatMessage({
																		id: "settings.functionSettings.translationSettings.apiConfig.apiKey.required",
																	}),
																},
															]}
														/>
													</Col>
												);
											}
											return null;
										}}
									</ProFormDependency>

									<ProFormDependency<{ api_type: TranslationApiType }>
										name={["api_type"]}
									>
										{({ api_type }) => {
											if (api_type === TranslationApiType.DeepL) {
												return (
													<Col span={12}>
														<ProFormSwitch
															name="deepl_prefer_quality_optimized"
															label={
																<IconLabel
																	label={
																		<FormattedMessage id="settings.functionSettings.translationSettings.apiConfig.deeplPreferQualityOptimized" />
																	}
																	tooltipTitle={
																		<FormattedMessage id="settings.functionSettings.translationSettings.apiConfig.deeplPreferQualityOptimized.tip" />
																	}
																/>
															}
														/>
													</Col>
												);
											}

											if (api_type === TranslationApiType.Custom) {
												return (
													<>
														<Col span={12}>
															<ProFormDigit
																name="max_requests_per_second"
																label={
																	<IconLabel
																		label={
																			<FormattedMessage id="settings.functionSettings.translationSettings.apiConfig.maxRequestsPerSecond" />
																		}
																		tooltipTitle={
																			<FormattedMessage id="settings.functionSettings.translationSettings.apiConfig.maxRequestsPerSecond.tip" />
																		}
																	/>
																}
																min={1}
																max={100}
																fieldProps={{
																	precision: 0,
																}}
															/>
														</Col>
														<Col span={12}>
															<ProFormDigit
																name="max_paragraph_count"
																label={
																	<IconLabel
																		label={
																			<FormattedMessage id="settings.functionSettings.translationSettings.apiConfig.maxParagraphCount" />
																		}
																		tooltipTitle={
																			<FormattedMessage id="settings.functionSettings.translationSettings.apiConfig.maxParagraphCount.tip" />
																		}
																	/>
																}
																min={1}
																max={100}
																fieldProps={{
																	precision: 0,
																}}
															/>
														</Col>
													</>
												);
											}

											return null;
										}}
									</ProFormDependency>
								</Row>
							</ProFormList>
						</Col>
					</Row>
				</ProForm>
			</Spin>

			<style jsx>{`
                :global(.api-config-list .ant-pro-form-list-container) {
                    width: 100%;
                }
            `}</style>
		</ContentWrap>
	);
};
