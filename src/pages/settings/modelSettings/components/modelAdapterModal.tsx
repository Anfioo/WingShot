import {
	Button,
	Col,
	Form,
	Input,
	InputNumber,
	Modal,
	message,
	Popconfirm,
	Row,
	Select,
	Space,
	Switch,
	Tabs,
} from "antd";
import { useEffect, useState } from "react";
import { useIntl } from "react-intl";
import {
	chatModelProviderTabs,
	createEmptyChatModelAdapter,
	getProviderChatModelOptions,
	openAIEndpointOptions,
	reasoningEffortOptions,
	validateChatModelAdapter,
} from "@/core/chatModels";
import type {
	ChatModelAdapterConfig,
	ChatModelProviderType,
} from "@/types/appSettings";

type ModelOption = Awaited<
	ReturnType<typeof getProviderChatModelOptions>
>[number];

export const ModelAdapterModal: React.FC<{
	open: boolean;
	adapter?: ChatModelAdapterConfig;
	providerType: ChatModelProviderType;
	onCancel: () => void;
	onSave: (adapter: ChatModelAdapterConfig) => void;
}> = ({ open, adapter, providerType, onCancel, onSave }) => {
	const intl = useIntl();
	const [form] = Form.useForm<ChatModelAdapterConfig>();
	const [modelOptions, setModelOptions] = useState<ModelOption[]>([]);
	const [providerModelsLoading, setProviderModelsLoading] = useState(false);
	const currentType = Form.useWatch("type", form) ?? providerType;
	const supportThinking = Form.useWatch("supportThinking", form) ?? false;
	const customHeadersEnabled =
		Form.useWatch("customHeadersEnabled", form) ?? false;
	const openAIExtraParamsEnabled =
		Form.useWatch("openAIExtraParamsEnabled", form) ?? false;
	const anthropicExtraParamsEnabled =
		Form.useWatch("anthropicExtraParamsEnabled", form) ?? false;
	const getDefaultAdapter = (type: ChatModelProviderType) =>
		createEmptyChatModelAdapter(type);

	const [innerTab, setInnerTab] = useState("connection");

	const fieldTabMap: Record<string, string> = {
		baseURL: "connection",
		apiKey: "connection",
		customHeadersEnabled: "connection",
		customHeadersJSON: "connection",
		displayName: "model",
		modelID: "model",
		contextWindowTokens: "model",
		openAIEndpoint: "model",
		supportThinking: "capabilities",
		supportVision: "capabilities",
		supportImageInput: "capabilities",
		reasoningEffort: "capabilities",
		anthropicThinkingEffort: "capabilities",
		maxCompletionTokens: "advanced",
		anthropicMaxTokens: "advanced",
		openAIExtraParamsEnabled: "advanced",
		openAIExtraParamsJSON: "advanced",
		anthropicExtraParamsEnabled: "advanced",
		anthropicExtraParamsJSON: "advanced",
		tooltipData: "advanced",
	};

	useEffect(() => {
		if (!open) return;
		const initialAdapter = adapter ?? createEmptyChatModelAdapter(providerType);
		form.setFieldsValue(initialAdapter);
		setModelOptions([]);
		setInnerTab("connection");
	}, [adapter, form, open, providerType]);

	return (
		<Modal
			open={open}
			title={
				adapter
					? intl.formatMessage({
							id: "settings.modelSettings.modelAdapter.edit",
						})
					: intl.formatMessage({
							id: "settings.modelSettings.modelAdapter.add",
						})
			}
			width={760}
			onCancel={onCancel}
			onOk={async () => {
				try {
					const values = await form.validateFields();
					const error = validateChatModelAdapter(values);
					if (error) {
						form.setFields([{ name: "displayName", errors: [error] }]);
						message.error(error);
						return;
					}
					onSave(values);
				} catch (err) {
					const errorInfo = err as {
						errorFields?: { name: (string | number)[]; errors: string[] }[];
					};
					const firstErrorField = errorInfo?.errorFields?.[0]?.name?.[0];
					const firstErrorMsg = errorInfo?.errorFields?.[0]?.errors?.[0];
					const tab =
						typeof firstErrorField === "string"
							? fieldTabMap[firstErrorField]
							: undefined;
					if (tab) {
						setInnerTab(tab);
					}
					message.error(
						firstErrorMsg ||
							intl.formatMessage({
								id: "settings.modelSettings.modelAdapter.validationFailed",
							}),
					);
				}
			}}
		>
			<Form form={form} layout="vertical">
				<Form.Item name="id" hidden>
					<Input />
				</Form.Item>
				<Form.Item name="type" hidden>
					<Input />
				</Form.Item>

				<Tabs
					activeKey={currentType}
					items={chatModelProviderTabs.map((item) => ({
						key: item.value,
						label: item.label,
					}))}
					onChange={(type) => {
						const nextType = type as ChatModelProviderType;
						const oldValues = form.getFieldsValue();
						const defaultAdapter = getDefaultAdapter(nextType);
						setModelOptions([]);
						form.setFieldsValue({
							...defaultAdapter,
							...oldValues,
							type: nextType,
							baseURL:
								oldValues.type && oldValues.type !== nextType
									? defaultAdapter.baseURL
									: oldValues.baseURL || defaultAdapter.baseURL,
						});
					}}
				/>

				<Tabs
					activeKey={innerTab}
					onChange={setInnerTab}
					items={[
						{
							key: "connection",
							label: intl.formatMessage({
								id: "settings.modelSettings.modelAdapter.tab.connection",
							}),
							children: (
								<Row gutter={16}>
									<Col span={12}>
										<Form.Item
											name="baseURL"
											label={intl.formatMessage({
												id: "settings.modelSettings.modelAdapter.baseURL",
											})}
											rules={[
												{
													required: true,
													message: intl.formatMessage({
														id: "settings.modelSettings.modelAdapter.baseURL.required",
													}),
												},
											]}
										>
											<Input
												placeholder={
													currentType === "anthropic"
														? "https://api.anthropic.com"
														: currentType === "snowshot"
															? "https://snowshot.top"
															: "https://api.openai.com/v1"
												}
											/>
										</Form.Item>
									</Col>
									<Col span={12}>
										<Form.Item
											name="apiKey"
											label={intl.formatMessage({
												id: "settings.modelSettings.modelAdapter.apiKey",
											})}
										>
											<Input.Password autoComplete="off" />
										</Form.Item>
									</Col>
									<Col span={12}>
										<Form.Item
											name="customHeadersEnabled"
											label={intl.formatMessage({
												id: "settings.modelSettings.modelAdapter.customHeaders.enable",
											})}
											valuePropName="checked"
											help={intl.formatMessage({
												id: "settings.modelSettings.modelAdapter.customHeaders.enable.tip",
											})}
										>
											<Switch />
										</Form.Item>
									</Col>
									<Col span={24}>
										<Form.Item
											name="customHeadersJSON"
											label={intl.formatMessage({
												id: "settings.modelSettings.modelAdapter.customHeaders.label",
											})}
											help={intl.formatMessage({
												id: "settings.modelSettings.modelAdapter.customHeaders.tip",
											})}
										>
											<Input.TextArea
												rows={5}
												disabled={!customHeadersEnabled}
											/>
										</Form.Item>
									</Col>
								</Row>
							),
						},
						{
							key: "model",
							label: intl.formatMessage({
								id: "settings.modelSettings.modelAdapter.tab.model",
							}),
							children: (
								<Row gutter={16}>
									<Col span={12}>
										<Form.Item
											name="displayName"
											label={intl.formatMessage({
												id: "settings.modelSettings.modelAdapter.displayName",
											})}
											rules={[
												{
													required: true,
													message: intl.formatMessage({
														id: "settings.modelSettings.modelAdapter.displayName.required",
													}),
												},
											]}
										>
											<Input
												placeholder={intl.formatMessage({
													id: "settings.modelSettings.modelAdapter.displayName.placeholder",
												})}
											/>
										</Form.Item>
									</Col>
									<Col span={12}>
										<Form.Item
											label={intl.formatMessage({
												id: "settings.modelSettings.modelAdapter.modelList",
											})}
										>
											<Select
												showSearch
												allowClear
												placeholder={intl.formatMessage({
													id: "settings.modelSettings.modelAdapter.modelList.placeholder",
												})}
												options={modelOptions}
												filterOption={(input, option) =>
													`${option?.label ?? ""}${option?.value ?? ""}`
														.toLowerCase()
														.includes(input.toLowerCase())
												}
												onChange={(_, option) => {
													const selected = Array.isArray(option)
														? option[0]
														: option;
													if (!selected) return;
													form.setFieldsValue({
														modelID: selected.model,
														displayName:
															form.getFieldValue("displayName") ||
															selected.name,
														supportThinking: selected.thinking,
														supportVision: selected.supportVision,
													});
												}}
											/>
											<Space style={{ marginTop: 8 }}>
												<Button
													size="small"
													loading={providerModelsLoading}
													onClick={async () => {
														setProviderModelsLoading(true);
														try {
															const models = await getProviderChatModelOptions(
																form.getFieldsValue(),
															);
															setModelOptions(models);
														} catch (error) {
															const message =
																error instanceof Error
																	? error.message
																	: `${error}`;
															form.setFields([
																{
																	name: "baseURL",
																	errors: [message],
																},
															]);
														} finally {
															setProviderModelsLoading(false);
														}
													}}
												>
													{intl.formatMessage({
														id: "settings.modelSettings.modelAdapter.fetchFromAPI",
													})}
												</Button>
											</Space>
										</Form.Item>
									</Col>
									<Col span={12}>
										<Form.Item
											name="modelID"
											label={intl.formatMessage({
												id: "settings.modelSettings.modelAdapter.modelID",
											})}
											rules={[
												{
													required: true,
													message: intl.formatMessage({
														id: "settings.modelSettings.modelAdapter.modelID.required",
													}),
												},
											]}
										>
											<Input
												placeholder={intl.formatMessage({
													id: "settings.modelSettings.modelAdapter.modelID.placeholder",
												})}
											/>
										</Form.Item>
									</Col>
									<Col span={12}>
										<Form.Item
											name="contextWindowTokens"
											label={intl.formatMessage({
												id: "settings.modelSettings.modelAdapter.contextWindow",
											})}
										>
											<InputNumber
												min={0}
												precision={0}
												style={{ width: "100%" }}
											/>
										</Form.Item>
									</Col>
									{currentType === "openai" ? (
										<Col span={12}>
											<Form.Item
												name="openAIEndpoint"
												label={intl.formatMessage({
													id: "settings.modelSettings.modelAdapter.endpoint",
												})}
											>
												<Select options={openAIEndpointOptions} />
											</Form.Item>
										</Col>
									) : null}
								</Row>
							),
						},
						{
							key: "capabilities",
							label: intl.formatMessage({
								id: "settings.modelSettings.modelAdapter.tab.capabilities",
							}),
							children: (
								<Row gutter={16}>
									<Col span={8}>
										<Form.Item
											name="supportThinking"
											label={intl.formatMessage({
												id: "settings.modelSettings.modelAdapter.supportThinking",
											})}
											valuePropName="checked"
											help={intl.formatMessage({
												id: "settings.modelSettings.modelAdapter.supportThinking.tip",
											})}
										>
											<Switch />
										</Form.Item>
									</Col>
									<Col span={8}>
										<Form.Item
											name="supportVision"
											label={intl.formatMessage({
												id: "settings.modelSettings.modelAdapter.supportVision",
											})}
											valuePropName="checked"
											help={intl.formatMessage({
												id: "settings.modelSettings.modelAdapter.supportVision.tip",
											})}
										>
											<Switch />
										</Form.Item>
									</Col>
									<Col span={8}>
										<Form.Item
											name="supportImageInput"
											label={intl.formatMessage({
												id: "settings.modelSettings.modelAdapter.supportImageInput",
											})}
											valuePropName="checked"
											help={intl.formatMessage({
												id: "settings.modelSettings.modelAdapter.supportImageInput.tip",
											})}
										>
											<Switch />
										</Form.Item>
									</Col>
									{currentType === "openai" && supportThinking ? (
										<Col span={12}>
											<Form.Item
												name="reasoningEffort"
												label={intl.formatMessage({
													id: "settings.modelSettings.modelAdapter.reasoningEffort",
												})}
											>
												<Select options={reasoningEffortOptions} />
											</Form.Item>
										</Col>
									) : currentType === "anthropic" && supportThinking ? (
										<Col span={12}>
											<Form.Item
												name="anthropicThinkingEffort"
												label={intl.formatMessage({
													id: "settings.modelSettings.modelAdapter.thinkingEffort",
												})}
											>
												<Select options={reasoningEffortOptions} />
											</Form.Item>
										</Col>
									) : null}
								</Row>
							),
						},
						{
							key: "advanced",
							label: intl.formatMessage({
								id: "settings.modelSettings.modelAdapter.tab.advanced",
							}),
							children: (
								<Row gutter={16}>
									{currentType === "openai" ? (
										<>
											<Col span={12}>
												<Form.Item
													name="maxCompletionTokens"
													label={intl.formatMessage({
														id: "settings.modelSettings.modelAdapter.maxTokens",
													})}
												>
													<InputNumber
														min={0}
														precision={0}
														style={{ width: "100%" }}
													/>
												</Form.Item>
											</Col>
											<Col span={12}>
												<Form.Item
													name="openAIExtraParamsEnabled"
													label={intl.formatMessage({
														id: "settings.modelSettings.modelAdapter.openAIExtraParams.enable",
													})}
													valuePropName="checked"
													help={intl.formatMessage({
														id: "settings.modelSettings.modelAdapter.openAIExtraParams.enable.tip",
													})}
												>
													<Switch />
												</Form.Item>
											</Col>
											<Col span={24}>
												<Form.Item
													name="openAIExtraParamsJSON"
													label={intl.formatMessage({
														id: "settings.modelSettings.modelAdapter.openAIExtraParams.label",
													})}
													help={intl.formatMessage({
														id: "settings.modelSettings.modelAdapter.openAIExtraParams.tip",
													})}
												>
													<Input.TextArea
														rows={5}
														disabled={!openAIExtraParamsEnabled}
													/>
												</Form.Item>
											</Col>
										</>
									) : currentType === "anthropic" ? (
										<>
											<Col span={12}>
												<Form.Item
													name="anthropicMaxTokens"
													label={intl.formatMessage({
														id: "settings.modelSettings.modelAdapter.maxTokens",
													})}
												>
													<InputNumber
														min={0}
														precision={0}
														style={{ width: "100%" }}
													/>
												</Form.Item>
											</Col>
											<Col span={12}>
												<Form.Item
													name="anthropicExtraParamsEnabled"
													label={intl.formatMessage({
														id: "settings.modelSettings.modelAdapter.anthropicExtraParams.enable",
													})}
													valuePropName="checked"
													help={intl.formatMessage({
														id: "settings.modelSettings.modelAdapter.anthropicExtraParams.enable.tip",
													})}
												>
													<Switch />
												</Form.Item>
											</Col>
											<Col span={24}>
												<Form.Item
													name="anthropicExtraParamsJSON"
													label={intl.formatMessage({
														id: "settings.modelSettings.modelAdapter.anthropicExtraParams.label",
													})}
													help={intl.formatMessage({
														id: "settings.modelSettings.modelAdapter.anthropicExtraParams.tip",
													})}
												>
													<Input.TextArea
														rows={5}
														disabled={!anthropicExtraParamsEnabled}
													/>
												</Form.Item>
											</Col>
										</>
									) : (
										<Col span={12}>
											<Form.Item
												name="maxCompletionTokens"
												label={intl.formatMessage({
													id: "settings.modelSettings.modelAdapter.maxTokens",
												})}
											>
												<InputNumber
													min={0}
													precision={0}
													style={{ width: "100%" }}
												/>
											</Form.Item>
										</Col>
									)}
									<Col span={24}>
										<Form.Item
											name="tooltipData"
											label={intl.formatMessage({
												id: "settings.modelSettings.modelAdapter.tooltipData",
											})}
										>
											<Input.TextArea rows={3} />
										</Form.Item>
									</Col>
									<Col span={24}>
										<Popconfirm
											title={intl.formatMessage({
												id: "settings.modelSettings.modelAdapter.resetConfirm.title",
											})}
											description={intl.formatMessage({
												id: "settings.modelSettings.modelAdapter.resetConfirm.description",
											})}
											onConfirm={() => form.resetFields()}
											okText={intl.formatMessage({
												id: "settings.modelSettings.modelAdapter.resetConfirm.okText",
											})}
											cancelText={intl.formatMessage({
												id: "settings.modelSettings.modelAdapter.resetConfirm.cancelText",
											})}
										>
											<Button danger>
												{intl.formatMessage({
													id: "settings.modelSettings.modelAdapter.resetForm",
												})}
											</Button>
										</Popconfirm>
									</Col>
								</Row>
							),
						},
					]}
				/>
			</Form>
		</Modal>
	);
};
