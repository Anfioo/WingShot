"use client";

import { Form, Spin } from "antd";
import { useCallback, useContext, useState } from "react";
import { FormattedMessage } from "react-intl";
import { ContentWrap } from "@/components/contentWrap";
import { GroupTitle } from "@/components/groupTitle";
import { ResetSettingsButton } from "@/components/resetSettingsButton";
import { AppSettingsActionContext } from "@/contexts/appSettingsActionContext";
import { useAppSettingsLoad } from "@/hooks/useAppSettingsLoad";
import { type AppSettingsData, AppSettingsGroup } from "@/types/appSettings";
import { ModelAdapterList } from "./components/modelAdapterList";

export const ModelSettingsPage = () => {
	const { updateAppSettings } = useContext(AppSettingsActionContext);
	const [modelForm] =
		Form.useForm<AppSettingsData[AppSettingsGroup.FunctionChat]>();
	const [appSettingsLoading, setAppSettingsLoading] = useState(true);

	useAppSettingsLoad(
		useCallback(
			(settings: AppSettingsData, preSettings?: AppSettingsData) => {
				setAppSettingsLoading(false);
				if (
					preSettings === undefined ||
					preSettings[AppSettingsGroup.FunctionChat] !==
						settings[AppSettingsGroup.FunctionChat]
				) {
					modelForm.setFieldsValue(settings[AppSettingsGroup.FunctionChat]);
				}
			},
			[modelForm],
		),
	);

	return (
		<ContentWrap>
			<GroupTitle
				id="modelSettings"
				extra={
					<ResetSettingsButton
						title={<FormattedMessage id="settings.modelSettings" />}
						appSettingsGroup={AppSettingsGroup.FunctionChat}
					/>
				}
			>
				<FormattedMessage id="settings.modelSettings" />
			</GroupTitle>

			<Spin spinning={appSettingsLoading}>
				<Form
					form={modelForm}
					onValuesChange={(_, values) => {
						updateAppSettings(
							AppSettingsGroup.FunctionChat,
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
					<Form.Item name="modelAdapters" noStyle>
						<ModelAdapterList />
					</Form.Item>
				</Form>
			</Spin>
		</ContentWrap>
	);
};
