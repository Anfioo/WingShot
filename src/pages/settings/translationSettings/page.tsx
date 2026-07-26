"use client";

import { Col, Form, Row, Spin, theme } from "antd";
import { useCallback, useContext, useState } from "react";
import { FormattedMessage } from "react-intl";
import { ContentWrap } from "@/components/contentWrap";
import { GroupTitle } from "@/components/groupTitle";
import { ResetSettingsButton } from "@/components/resetSettingsButton";
import { AppSettingsActionContext } from "@/contexts/appSettingsActionContext";
import { useAppSettingsLoad } from "@/hooks/useAppSettingsLoad";
import { type AppSettingsData, AppSettingsGroup } from "@/types/appSettings";
import { TranslationServiceList } from "./components/translationServiceList";
import { TranslationConfig } from "./translationConfig";

export const TranslationSettingsPage = () => {
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

				<Form
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
					layout="vertical"
				>
					<Row gutter={token.marginLG}>
						<Col span={24}>
							<Form.Item name="translationServices" noStyle>
								<TranslationServiceList />
							</Form.Item>
						</Col>
					</Row>
				</Form>
			</Spin>
		</ContentWrap>
	);
};
