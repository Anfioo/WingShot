import {
	ArrowDownOutlined,
	ArrowUpOutlined,
	DeleteOutlined,
	EditOutlined,
	PlusOutlined,
} from "@ant-design/icons";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
	Button,
	Card,
	Col,
	Empty,
	Flex,
	Form,
	Input,
	InputNumber,
	Modal,
	Row,
	Select,
	Space,
	Switch,
	Typography,
	theme,
} from "antd";
import { useCallback, useMemo, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import {
	createTranslationServiceInstanceId,
	translationServiceMetaMap,
	translationServiceMetas,
} from "@/core/translations/services";
import type {
	TranslationServiceConfig,
	TranslationServiceInstance,
} from "@/types/appSettings";
import { TranslationServiceType } from "@/types/appSettings";

const { Text } = Typography;

type ServiceFormValues = {
	name?: string;
	config?: TranslationServiceConfig;
};

const moveItem = <T,>(list: T[], from: number, to: number) => {
	const result = [...list];
	const [item] = result.splice(from, 1);
	result.splice(to, 0, item);
	return result;
};

export const TranslationServiceList: React.FC<{
	value?: TranslationServiceInstance[];
	onChange?: (value: TranslationServiceInstance[]) => void;
}> = ({ value = [], onChange }) => {
	const intl = useIntl();
	const { token } = theme.useToken();
	const [builtinModalOpen, setBuiltinModalOpen] = useState(false);
	const [configModalOpen, setConfigModalOpen] = useState(false);
	const [currentServiceId, setCurrentServiceId] = useState<string>();
	const [form] = Form.useForm<ServiceFormValues>();
	const watchedConfig = Form.useWatch("config", form);
	const currentConfig = watchedConfig ?? form.getFieldValue("config");

	const currentService = useMemo(
		() => value.find((item) => item.id === currentServiceId),
		[value, currentServiceId],
	);
	const currentMeta = currentService
		? translationServiceMetaMap[currentService.type]
		: undefined;
	const currentGuideUrl = useMemo(() => {
		if (!currentMeta?.guideUrl) return undefined;
		return typeof currentMeta.guideUrl === "function"
			? currentMeta.guideUrl(currentConfig)
			: currentMeta.guideUrl;
	}, [currentConfig, currentMeta]);

	const updateServices = useCallback(
		(services: TranslationServiceInstance[]) => {
			onChange?.(services);
		},
		[onChange],
	);

	const getServiceTitle = useCallback(
		(service: TranslationServiceInstance) => {
			const meta = translationServiceMetaMap[service.type];
			return service.name?.trim()
				? service.name
				: intl.formatMessage({ id: meta.messageId });
		},
		[intl],
	);

	const openConfig = useCallback(
		(service: TranslationServiceInstance) => {
			setCurrentServiceId(service.id);
			form.resetFields();
			form.setFieldsValue({
				name: service.name,
				config: service.config ?? {},
			});
			setConfigModalOpen(true);
		},
		[form],
	);

	const addBuiltinService = useCallback(
		(type: TranslationServiceType) => {
			const service: TranslationServiceInstance = {
				id: createTranslationServiceInstanceId(type),
				type,
				enabled: true,
				config:
					type === TranslationServiceType.DeepL ? { deeplType: "free" } : {},
			};
			updateServices([...value, service]);
			setBuiltinModalOpen(false);
			openConfig(service);
		},
		[openConfig, updateServices, value],
	);

	return (
		<>
			<Card
				title={<FormattedMessage id="settings.translationSettings.services" />}
				extra={
					<Button
						icon={<PlusOutlined />}
						type="primary"
						onClick={() => setBuiltinModalOpen(true)}
					>
						<FormattedMessage id="settings.translationSettings.addBuiltinService" />
					</Button>
				}
			>
				<Flex vertical gap={token.marginSM}>
					{value.length === 0 ? (
						<Empty />
					) : (
						value.map((service, index) => {
							const meta = translationServiceMetaMap[service.type];
							return (
								<Card size="small" key={service.id}>
									<Flex
										align="center"
										justify="space-between"
										gap={token.margin}
									>
										<Flex vertical>
											<Text strong>{getServiceTitle(service)}</Text>
											<Text type="secondary">
												{intl.formatMessage({ id: meta.messageId })}
											</Text>
										</Flex>
										<Space>
											<Switch
												checked={service.enabled !== false}
												onChange={(checked) => {
													updateServices(
														value.map((item) =>
															item.id === service.id
																? { ...item, enabled: checked }
																: item,
														),
													);
												}}
											/>
											<Button
												icon={<ArrowUpOutlined />}
												disabled={index === 0}
												onClick={() =>
													updateServices(moveItem(value, index, index - 1))
												}
											/>
											<Button
												icon={<ArrowDownOutlined />}
												disabled={index === value.length - 1}
												onClick={() =>
													updateServices(moveItem(value, index, index + 1))
												}
											/>
											<Button
												icon={<EditOutlined />}
												onClick={() => openConfig(service)}
											/>
											<Button
												danger
												icon={<DeleteOutlined />}
												onClick={() =>
													updateServices(
														value.filter((item) => item.id !== service.id),
													)
												}
											/>
										</Space>
									</Flex>
								</Card>
							);
						})
					)}
				</Flex>
			</Card>

			<Modal
				open={builtinModalOpen}
				title={
					<FormattedMessage id="settings.translationSettings.addBuiltinService" />
				}
				footer={null}
				onCancel={() => setBuiltinModalOpen(false)}
			>
				<Row gutter={[token.marginSM, token.marginSM]}>
					{translationServiceMetas.map((meta) => (
						<Col span={12} key={meta.type}>
							<Button block onClick={() => addBuiltinService(meta.type)}>
								{intl.formatMessage({ id: meta.messageId })}
							</Button>
						</Col>
					))}
				</Row>
			</Modal>

			<Modal
				open={configModalOpen}
				title={
					currentMeta
						? intl.formatMessage({ id: currentMeta.messageId })
						: undefined
				}
				onCancel={() => setConfigModalOpen(false)}
				onOk={async () => {
					const values = await form.validateFields();
					if (!currentService) return;
					updateServices(
						value.map((item) =>
							item.id === currentService.id
								? {
										...item,
										name: values.name,
										config: values.config ?? {},
									}
								: item,
						),
					);
					setConfigModalOpen(false);
				}}
			>
				<Form form={form} layout="vertical">
					{currentGuideUrl ? (
						<Form.Item
							label={
								<FormattedMessage id="settings.translationSettings.serviceConfig.guide" />
							}
						>
							<Button onClick={() => openUrl(currentGuideUrl)}>
								<FormattedMessage id="settings.translationSettings.serviceConfig.openGuide" />
							</Button>
						</Form.Item>
					) : null}
					<Form.Item
						name="name"
						label={
							<FormattedMessage id="settings.translationSettings.serviceConfig.name" />
						}
					>
						<Input allowClear />
					</Form.Item>
					{currentMeta?.configFields.map((field) => {
						if (field.visibleWhen && !field.visibleWhen(currentConfig)) {
							return null;
						}

						const label = intl.formatMessage({ id: field.messageId });
						const required =
							typeof field.required === "function"
								? field.required(currentConfig)
								: field.required;
						const rules = required
							? [
									{
										required: true,
										message: intl.formatMessage({
											id: "settings.translationSettings.serviceConfig.required",
										}),
									},
								]
							: undefined;

						if (field.type === "switch") {
							return (
								<Form.Item
									key={field.key}
									name={["config", field.key]}
									label={label}
									valuePropName="checked"
								>
									<Switch />
								</Form.Item>
							);
						}

						if (field.type === "number") {
							return (
								<Form.Item
									key={field.key}
									name={["config", field.key]}
									label={label}
									rules={rules}
								>
									<InputNumber
										min={1}
										precision={0}
										style={{ width: "100%" }}
									/>
								</Form.Item>
							);
						}

						if (field.type === "select") {
							return (
								<Form.Item
									key={field.key}
									name={["config", field.key]}
									label={label}
									rules={rules}
								>
									<Select
										options={field.options?.map((option) => ({
											label: intl.formatMessage({ id: option.labelMessageId }),
											value: option.value,
										}))}
									/>
								</Form.Item>
							);
						}

						const InputComponent =
							field.type === "password" ? Input.Password : Input;
						return (
							<Form.Item
								key={field.key}
								name={["config", field.key]}
								label={label}
								rules={rules}
								help={
									field.tipMessageId
										? intl.formatMessage({ id: field.tipMessageId })
										: undefined
								}
							>
								<InputComponent allowClear />
							</Form.Item>
						);
					})}
				</Form>
			</Modal>
		</>
	);
};
