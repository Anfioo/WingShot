import {
	Button,
	Col,
	Form,
	Input,
	InputNumber,
	Modal,
	Row,
	Select,
	Space,
	Switch,
	Tabs,
} from "antd";
import { useEffect, useState } from "react";
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
	const [form] = Form.useForm<ChatModelAdapterConfig>();
	const [modelOptions, setModelOptions] = useState<ModelOption[]>([]);
	const [providerModelsLoading, setProviderModelsLoading] = useState(false);
	const currentType = Form.useWatch("type", form) ?? providerType;
	const getDefaultAdapter = (type: ChatModelProviderType) =>
		createEmptyChatModelAdapter(type);

	useEffect(() => {
		if (!open) return;
		const initialAdapter = adapter ?? createEmptyChatModelAdapter(providerType);
		form.setFieldsValue(initialAdapter);
		setModelOptions([]);
	}, [adapter, form, open, providerType]);

	return (
		<Modal
			open={open}
			title={adapter ? "编辑模型配置" : "新增模型配置"}
			width={760}
			onCancel={onCancel}
			onOk={async () => {
				const values = await form.validateFields();
				const error = validateChatModelAdapter(values);
				if (error) {
					form.setFields([{ name: "displayName", errors: [error] }]);
					return;
				}
				onSave(values);
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
					defaultActiveKey="connection"
					items={[
						{
							key: "connection",
							label: "连接",
							children: (
								<Row gutter={16}>
									<Col span={12}>
										<Form.Item
											name="baseURL"
											label="接口地址"
											rules={[{ required: true, message: "请输入接口地址" }]}
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
										<Form.Item name="apiKey" label="访问密钥">
											<Input.Password autoComplete="off" />
										</Form.Item>
									</Col>
									<Col span={12}>
										<Form.Item
											name="customHeadersEnabled"
											label="启用自定义请求头"
											valuePropName="checked"
										>
											<Switch />
										</Form.Item>
									</Col>
									<Col span={24}>
										<Form.Item
											name="customHeadersJSON"
											label="自定义请求头 JSON"
										>
											<Input.TextArea rows={5} />
										</Form.Item>
									</Col>
								</Row>
							),
						},
						{
							key: "model",
							label: "模型",
							children: (
								<Row gutter={16}>
									<Col span={12}>
										<Form.Item
											name="displayName"
											label="显示名称"
											rules={[{ required: true, message: "请输入显示名称" }]}
										>
											<Input placeholder="例如：OpenAI - GPT-4.1" />
										</Form.Item>
									</Col>
									<Col span={12}>
										<Form.Item label="模型列表">
											<Select
												showSearch
												allowClear
												placeholder="选择后自动填充模型标识"
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
													从当前 API 获取
												</Button>
											</Space>
										</Form.Item>
									</Col>
									<Col span={12}>
										<Form.Item
											name="modelID"
											label="模型标识"
											rules={[{ required: true, message: "请输入模型标识" }]}
										>
											<Input placeholder="例如：qwen-flash / gpt-4.1 / claude-sonnet-4" />
										</Form.Item>
									</Col>
									<Col span={12}>
										<Form.Item name="contextWindowTokens" label="上下文窗口">
											<InputNumber
												min={0}
												precision={0}
												style={{ width: "100%" }}
											/>
										</Form.Item>
									</Col>
									{currentType === "openai" ? (
										<Col span={12}>
											<Form.Item name="openAIEndpoint" label="接口端点">
												<Select options={openAIEndpointOptions} />
											</Form.Item>
										</Col>
									) : null}
								</Row>
							),
						},
						{
							key: "capabilities",
							label: "能力",
							children: (
								<Row gutter={16}>
									<Col span={8}>
										<Form.Item
											name="supportThinking"
											label="支持思考"
											valuePropName="checked"
										>
											<Switch />
										</Form.Item>
									</Col>
									<Col span={8}>
										<Form.Item
											name="supportVision"
											label="支持 OCR 视觉"
											valuePropName="checked"
										>
											<Switch />
										</Form.Item>
									</Col>
									<Col span={8}>
										<Form.Item
											name="supportImageInput"
											label="对话图片输入"
											valuePropName="checked"
										>
											<Switch />
										</Form.Item>
									</Col>
									{currentType === "openai" ? (
										<Col span={12}>
											<Form.Item name="reasoningEffort" label="推理强度">
												<Select options={reasoningEffortOptions} />
											</Form.Item>
										</Col>
									) : currentType === "anthropic" ? (
										<Col span={12}>
											<Form.Item
												name="anthropicThinkingEffort"
												label="思考强度"
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
							label: "高级",
							children: (
								<Row gutter={16}>
									{currentType === "openai" ? (
										<>
											<Col span={12}>
												<Form.Item
													name="maxCompletionTokens"
													label="最大输出 Token"
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
													label="启用 OpenAI 额外参数"
													valuePropName="checked"
												>
													<Switch />
												</Form.Item>
											</Col>
											<Col span={24}>
												<Form.Item
													name="openAIExtraParamsJSON"
													label="OpenAI 额外参数 JSON"
												>
													<Input.TextArea rows={5} />
												</Form.Item>
											</Col>
										</>
									) : currentType === "anthropic" ? (
										<>
											<Col span={12}>
												<Form.Item
													name="anthropicMaxTokens"
													label="最大输出 Token"
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
													label="启用 Anthropic 额外参数"
													valuePropName="checked"
												>
													<Switch />
												</Form.Item>
											</Col>
											<Col span={24}>
												<Form.Item
													name="anthropicExtraParamsJSON"
													label="Anthropic 额外参数 JSON"
												>
													<Input.TextArea rows={5} />
												</Form.Item>
											</Col>
										</>
									) : (
										<Col span={12}>
											<Form.Item
												name="maxCompletionTokens"
												label="最大输出 Token"
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
										<Form.Item name="tooltipData" label="备注">
											<Input.TextArea rows={3} />
										</Form.Item>
									</Col>
									<Col span={24}>
										<Button onClick={() => form.resetFields()}>
											重置当前表单
										</Button>
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
