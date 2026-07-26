"use client";

import {
	ArrowDownOutlined,
	ArrowUpOutlined,
	CloseOutlined,
	CopyOutlined,
	DragOutlined,
	ScanOutlined,
} from "@ant-design/icons";
import {
	ProForm,
	ProFormRadio,
	ProFormSelect,
	ProFormSlider,
	ProFormSwitch,
} from "@ant-design/pro-components";
import { resourceDir } from "@tauri-apps/api/path";
import {
	Button,
	type CheckboxOptionType,
	Col,
	ColorPicker,
	Divider,
	Form,
	Image,
	Row,
	Select,
	Space,
	Spin,
	Typography,
	theme,
} from "antd";
import type { AggregationColor } from "antd/es/color-picker/color";
import {
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { ContentWrap } from "@/components/contentWrap";
import { GroupTitle } from "@/components/groupTitle";
import { IconLabel } from "@/components/iconLable";
import {
	DarkModeIcon,
	FixedIcon,
	LanguageIcon,
	OcrDetectIcon,
	OcrTranslateIcon,
	SaveIcon,
	ScrollScreenshotIcon,
	TranslationIcon,
} from "@/components/icons";
import { PathInput } from "@/components/pathInput";
import { ResetSettingsButton } from "@/components/resetSettingsButton";
import { getDefaultIconPath } from "@/components/trayIconLoader";
import {
	PLUGIN_ID_FFMPEG,
	PLUGIN_ID_RAPID_OCR,
	PLUGIN_ID_TRANSLATE,
} from "@/constants/pluginService";
import { AppSettingsActionContext } from "@/contexts/appSettingsActionContext";
import { usePluginServiceContext } from "@/contexts/pluginServiceContext";
import { useAppSettingsLoad } from "@/hooks/useAppSettingsLoad";
import { useStateRef } from "@/hooks/useStateRef";
import {
	ACTION_TOOLBAR_STATES,
	AppSettingsControlNode,
	type AppSettingsData,
	AppSettingsGroup,
	AppSettingsLanguage,
	AppSettingsTheme,
	ColorPickerShowMode,
	normalizeToolbarActionOrder,
	TrayIconDefaultIcon,
} from "@/types/appSettings";
import { DrawState } from "@/types/draw";

const { Option } = Select;

export const GeneralSettingsPage = () => {
	const intl = useIntl();
	const { token } = theme.useToken();

	const { updateAppSettings } = useContext(AppSettingsActionContext);
	const [commonForm] = Form.useForm<AppSettingsData[AppSettingsGroup.Common]>();
	const [screenshotForm] =
		Form.useForm<AppSettingsData[AppSettingsGroup.Screenshot]>();
	const [fixedContentForm] =
		Form.useForm<AppSettingsData[AppSettingsGroup.FixedContent]>();
	const [trayIconForm] =
		Form.useForm<AppSettingsData[AppSettingsGroup.CommonTrayIcon]>();

	const [appSettingsLoading, setAppSettingsLoading] = useStateRef(true);
	useAppSettingsLoad(
		useCallback(
			(settings: AppSettingsData, preSettings?: AppSettingsData) => {
				setAppSettingsLoading(false);
				if (
					preSettings === undefined ||
					preSettings[AppSettingsGroup.Common] !==
						settings[AppSettingsGroup.Common]
				) {
					commonForm.setFieldsValue(settings[AppSettingsGroup.Common]);
				}

				if (
					preSettings === undefined ||
					preSettings[AppSettingsGroup.Screenshot] !==
						settings[AppSettingsGroup.Screenshot]
				) {
					screenshotForm.setFieldsValue(settings[AppSettingsGroup.Screenshot]);
				}

				if (
					preSettings === undefined ||
					preSettings[AppSettingsGroup.CommonTrayIcon] !==
						settings[AppSettingsGroup.CommonTrayIcon]
				) {
					trayIconForm.setFieldsValue(
						settings[AppSettingsGroup.CommonTrayIcon],
					);
				}

				if (
					preSettings === undefined ||
					preSettings[AppSettingsGroup.FixedContent] !==
						settings[AppSettingsGroup.FixedContent]
				) {
					fixedContentForm.setFieldsValue(
						settings[AppSettingsGroup.FixedContent],
					);
				}
			},
			[
				commonForm,
				fixedContentForm,
				screenshotForm,
				setAppSettingsLoading,
				trayIconForm,
			],
		),
		true,
	);

	const { isReadyStatus } = usePluginServiceContext();
	const rapidOcrReady = isReadyStatus?.(PLUGIN_ID_RAPID_OCR) ?? false;
	const translateReady = isReadyStatus?.(PLUGIN_ID_TRANSLATE) ?? false;
	const ffmpegReady = isReadyStatus?.(PLUGIN_ID_FFMPEG) ?? false;
	const extraToolLabel = ffmpegReady
		? intl.formatMessage({ id: "draw.extraTool.combo" })
		: intl.formatMessage({ id: "draw.extraTool.scanQrcode" });

	const availableToolbarActionStates = useMemo(() => {
		return ACTION_TOOLBAR_STATES.filter((item) => {
			switch (item) {
				case DrawState.OcrDetect:
					return rapidOcrReady;
				case DrawState.OcrTranslate:
				case DrawState.LaserPointer:
					return rapidOcrReady && translateReady;
				default:
					return true;
			}
		});
	}, [rapidOcrReady, translateReady]);

	const customToolbarToolListOptions = useMemo(() => {
		return [
			{
				label: intl.formatMessage({ id: "draw.selectTool" }),
				value: DrawState.Select,
			},
			{
				label: intl.formatMessage({ id: "draw.ellipseTool" }),
				value: DrawState.Ellipse,
			},
			{
				label: intl.formatMessage({ id: "draw.arrowTool" }),
				value: DrawState.Arrow,
			},
			{
				label: intl.formatMessage({ id: "draw.penTool" }),
				value: DrawState.Pen,
			},
			{
				label: intl.formatMessage({ id: "draw.textTool" }),
				value: DrawState.Text,
			},
			{
				label: intl.formatMessage({ id: "draw.serialNumberTool" }),
				value: DrawState.SerialNumber,
			},
			{
				label: intl.formatMessage({ id: "draw.blurTool" }),
				value: DrawState.Blur,
			},
			{
				label: intl.formatMessage({ id: "draw.eraserTool" }),
				value: DrawState.Eraser,
			},
			{
				label: intl.formatMessage({ id: "draw.watermarkTool" }),
				value: DrawState.Watermark,
			},
			{
				label: intl.formatMessage({ id: "draw.highlightTool" }),
				value: DrawState.Highlight,
			},
			{
				label: intl.formatMessage({ id: "draw.redoUndoTool" }),
				value: DrawState.Redo,
			},
			{
				label: intl.formatMessage({ id: "draw.fixedTool" }),
				value: DrawState.Fixed,
			},
			{
				label: intl.formatMessage({ id: "draw.ocrDetectTool" }),
				value: DrawState.OcrDetect,
			},
			{
				label: intl.formatMessage({ id: "draw.ocrTranslateTool" }),
				value: DrawState.OcrTranslate,
			},
			{
				label: intl.formatMessage({ id: "draw.scrollScreenshotTool" }),
				value: DrawState.ScrollScreenshot,
			},
			{
				label: extraToolLabel,
				value: DrawState.ExtraTools,
			},
		].filter((item) => {
			if (item.value === DrawState.OcrDetect) {
				return rapidOcrReady;
			}

			if (item.value === DrawState.OcrTranslate) {
				return rapidOcrReady && translateReady;
			}

			return true;
		});
	}, [extraToolLabel, intl, rapidOcrReady, translateReady]);

	const actionToolbarStateLabelMap = useMemo(() => {
		const map: Record<number, string> = {};
		const labels: [DrawState, string][] = [
			[DrawState.Fixed, intl.formatMessage({ id: "draw.fixedTool" })],
			[DrawState.OcrDetect, intl.formatMessage({ id: "draw.ocrDetectTool" })],
			[
				DrawState.OcrTranslate,
				intl.formatMessage({ id: "draw.ocrTranslateTool" }),
			],
			[
				DrawState.LaserPointer,
				intl.formatMessage({ id: "draw.openTranslationTool" }),
			],
			[
				DrawState.ScrollScreenshot,
				intl.formatMessage({ id: "draw.scrollScreenshotTool" }),
			],
			[DrawState.ExtraTools, extraToolLabel],
			[DrawState.Save, intl.formatMessage({ id: "draw.saveTool" })],
			[DrawState.Cancel, intl.formatMessage({ id: "draw.close" })],
			[DrawState.Copy, intl.formatMessage({ id: "draw.copyTool" })],
		];
		for (const [state, label] of labels) {
			map[state] = label;
		}
		return map;
	}, [extraToolLabel, intl]);

	const [defaultIconsOptions, setDefaultIconsOptions] = useState<
		CheckboxOptionType<TrayIconDefaultIcon>[]
	>([]);
	const initDefaultIconsOptions = useCallback(async () => {
		const appDataDir = await resourceDir();
		const [
			defaultIconPath,
			lightIconPath,
			darkIconPath,
			snowDefaultIconPath,
			snowLightIconPath,
			snowDarkIconPath,
		] = await Promise.all([
			getDefaultIconPath(TrayIconDefaultIcon.Default, appDataDir),
			getDefaultIconPath(TrayIconDefaultIcon.Light, appDataDir),
			getDefaultIconPath(TrayIconDefaultIcon.Dark, appDataDir),
			getDefaultIconPath(TrayIconDefaultIcon.SnowDefault, appDataDir),
			getDefaultIconPath(TrayIconDefaultIcon.SnowLight, appDataDir),
			getDefaultIconPath(TrayIconDefaultIcon.SnowDark, appDataDir),
		]);

		const iconSize = 24;
		setDefaultIconsOptions([
			{
				label: (
					<Space>
						{intl.formatMessage({
							id: "settings.commonSettings.trayIconSettings.defaultIcons.default",
						})}
						<Image
							src={defaultIconPath.web_path}
							width={iconSize}
							height={iconSize}
							alt="default"
						/>
					</Space>
				),
				title: intl.formatMessage({
					id: "settings.commonSettings.trayIconSettings.defaultIcons.default",
				}),
				value: TrayIconDefaultIcon.Default,
			},
			{
				label: (
					<Space>
						{intl.formatMessage({
							id: "settings.commonSettings.trayIconSettings.defaultIcons.light",
						})}
						<Image
							src={lightIconPath.web_path}
							width={iconSize}
							height={iconSize}
							alt="light"
						/>
					</Space>
				),
				title: intl.formatMessage({
					id: "settings.commonSettings.trayIconSettings.defaultIcons.light",
				}),
				value: TrayIconDefaultIcon.Light,
			},
			{
				label: (
					<Space>
						{intl.formatMessage({
							id: "settings.commonSettings.trayIconSettings.defaultIcons.dark",
						})}
						<Image
							src={darkIconPath.web_path}
							width={iconSize}
							height={iconSize}
							alt="dark"
						/>
					</Space>
				),
				title: intl.formatMessage({
					id: "settings.commonSettings.trayIconSettings.defaultIcons.dark",
				}),
				value: TrayIconDefaultIcon.Dark,
			},
			{
				label: (
					<Space>
						{intl.formatMessage({
							id: "settings.commonSettings.trayIconSettings.defaultIcons.snowDefault",
						})}
						<Image
							src={snowDefaultIconPath.web_path}
							width={iconSize}
							height={iconSize}
							alt="snow-default"
						/>
					</Space>
				),
				title: intl.formatMessage({
					id: "settings.commonSettings.trayIconSettings.defaultIcons.snowDefault",
				}),
				value: TrayIconDefaultIcon.SnowDefault,
			},

			{
				label: (
					<Space>
						{intl.formatMessage({
							id: "settings.commonSettings.trayIconSettings.defaultIcons.snowLight",
						})}
						<Image
							src={snowLightIconPath.web_path}
							width={iconSize}
							height={iconSize}
							alt="snow-light"
						/>
					</Space>
				),
				title: intl.formatMessage({
					id: "settings.commonSettings.trayIconSettings.defaultIcons.snowLight",
				}),
				value: TrayIconDefaultIcon.SnowLight,
			},
			{
				label: (
					<Space>
						{intl.formatMessage({
							id: "settings.commonSettings.trayIconSettings.defaultIcons.snowDark",
						})}
						<Image
							src={snowDarkIconPath.web_path}
							width={iconSize}
							height={iconSize}
							alt="snow-dark"
						/>
					</Space>
				),
				title: intl.formatMessage({
					id: "settings.commonSettings.trayIconSettings.defaultIcons.snowDark",
				}),
				value: TrayIconDefaultIcon.SnowDark,
			},
		]);
	}, [intl]);

	const themeOptions = useMemo(() => {
		return [
			{
				label: intl.formatMessage({ id: "settings.theme.light" }),
				value: AppSettingsTheme.Light,
			},
			{
				label: intl.formatMessage({ id: "settings.theme.dark" }),
				value: AppSettingsTheme.Dark,
			},
			{
				label: intl.formatMessage({ id: "settings.theme.system" }),
				value: AppSettingsTheme.System,
			},
		];
	}, [intl]);

	useEffect(() => {
		initDefaultIconsOptions();
	}, [initDefaultIconsOptions]);

	return (
		<ContentWrap className="settings-wrap">
			<GroupTitle
				id="commonSettings"
				extra={
					<ResetSettingsButton
						title={
							<FormattedMessage
								id="settings.commonSettings"
								key="commonSettings"
							/>
						}
						appSettingsGroup={AppSettingsGroup.Common}
					/>
				}
			>
				<FormattedMessage id="settings.commonSettings" />
			</GroupTitle>

			<Form
				className="settings-form common-settings-form"
				form={commonForm}
				onValuesChange={(_, values) => {
					updateAppSettings(AppSettingsGroup.Common, values, true, true, true);
				}}
				layout="vertical"
			>
				<Spin spinning={appSettingsLoading}>
					<Row gutter={token.marginLG}>
						<Col span={12}>
							<Form.Item
								label={
									<IconLabel
										icon={<DarkModeIcon />}
										label={<FormattedMessage id="settings.theme" />}
									/>
								}
								name="theme"
							>
								<Select options={themeOptions} />
							</Form.Item>
						</Col>
						<Col span={12}>
							<Form.Item
								className="settings-wrap-language"
								name="language"
								label={
									<IconLabel
										icon={<LanguageIcon />}
										label={<FormattedMessage id="settings.language" />}
									/>
								}
								required={false}
								rules={[{ required: true }]}
							>
								<Select>
									<Option value={AppSettingsLanguage.EN}>English</Option>
									<Option value={AppSettingsLanguage.ZHHant}>繁體中文</Option>
									<Option value={AppSettingsLanguage.ZHHans}>简体中文</Option>
								</Select>
							</Form.Item>
						</Col>
					</Row>
				</Spin>
			</Form>

			<Divider />

			<GroupTitle
				id="screenshotSettings"
				extra={
					<ResetSettingsButton
						title={intl.formatMessage({ id: "settings.screenshotSettings" })}
						appSettingsGroup={AppSettingsGroup.Screenshot}
					/>
				}
			>
				<FormattedMessage id="settings.screenshotSettings" />
			</GroupTitle>

			<ProForm<AppSettingsData[AppSettingsGroup.Screenshot]>
				className="settings-form screenshot-settings-form"
				form={screenshotForm}
				submitter={false}
				onValuesChange={(changedValues, values) => {
					if ("toolbarHiddenToolList" in changedValues) {
						values.toolbarActionOrder = normalizeToolbarActionOrder(
							values.toolbarActionOrder ??
								screenshotForm.getFieldValue("toolbarActionOrder"),
							values.toolbarHiddenToolList,
							availableToolbarActionStates,
						);
						screenshotForm.setFieldValue(
							"toolbarActionOrder",
							values.toolbarActionOrder,
						);
					}

					if (typeof values.fullScreenAuxiliaryLineColor === "object") {
						values.fullScreenAuxiliaryLineColor = (
							values.fullScreenAuxiliaryLineColor as AggregationColor
						).toHexString();
					}

					if (typeof values.monitorCenterAuxiliaryLineColor === "object") {
						values.monitorCenterAuxiliaryLineColor = (
							values.monitorCenterAuxiliaryLineColor as AggregationColor
						).toHexString();
					}

					if (typeof values.colorPickerCenterAuxiliaryLineColor === "object") {
						values.colorPickerCenterAuxiliaryLineColor = (
							values.colorPickerCenterAuxiliaryLineColor as AggregationColor
						).toHexString();
					}

					if (typeof values.selectRectMaskColor === "object") {
						values.selectRectMaskColor = (
							values.selectRectMaskColor as AggregationColor
						).toHexString();
					}

					updateAppSettings(
						AppSettingsGroup.Screenshot,
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
				<Spin spinning={appSettingsLoading}>
					<Row gutter={token.marginLG}>
						<Col span={12}>
							<ProFormSlider
								name="uiScale"
								label={
									<FormattedMessage id="settings.commonSettings.screenshotSettings.uiScale" />
								}
								min={25}
								max={100}
								step={1}
								marks={{
									25: "25%",
									100: "100%",
								}}
							/>
						</Col>

						<Col span={12}>
							<ProFormSlider
								name="toolbarUiScale"
								label={
									<FormattedMessage id="settings.commonSettings.screenshotSettings.toolbarUiScale" />
								}
								min={25}
								max={100}
								step={1}
								marks={{
									25: "25%",
									100: "100%",
								}}
							/>
						</Col>

						<Col span={12}>
							<ProForm.Item
								className="settings-wrap-language"
								name="controlNode"
								label={
									<IconLabel
										label={<FormattedMessage id="settings.controlNode" />}
									/>
								}
								required={false}
								rules={[{ required: true }]}
							>
								<Select>
									<Option value={AppSettingsControlNode.Circle}>
										<FormattedMessage id="settings.controlNode.circle" />
									</Option>
								</Select>
							</ProForm.Item>
						</Col>

						<Col span={12}>
							<ProFormSwitch
								name="disableAnimation"
								label={<FormattedMessage id="settings.disableAnimation" />}
							/>
						</Col>

						<Col span={12}>
							<ProFormRadio.Group
								name="colorPickerShowMode"
								layout="horizontal"
								label={
									<FormattedMessage id="settings.functionSettings.screenshotSettings.colorPickerShowMode" />
								}
								options={[
									{
										label: (
											<FormattedMessage id="settings.functionSettings.screenshotSettings.beyondSelectRect" />
										),
										value: ColorPickerShowMode.BeyondSelectRect,
									},
									{
										label: (
											<FormattedMessage id="settings.functionSettings.screenshotSettings.alwaysShowColorPicker" />
										),
										value: ColorPickerShowMode.Always,
									},
									{
										label: (
											<FormattedMessage id="settings.functionSettings.screenshotSettings.neverShowColorPicker" />
										),
										value: ColorPickerShowMode.Never,
									},
								]}
							/>
						</Col>

						<Col span={12}>
							<ProForm.Item
								name="selectRectMaskColor"
								label={
									<IconLabel
										label={
											<FormattedMessage id="settings.selectRectMaskColor" />
										}
									/>
								}
								required={false}
							>
								<ColorPicker showText placement="bottom" />
							</ProForm.Item>
						</Col>

						<Col span={12}>
							<ProFormSlider
								label={
									<IconLabel
										label={
											<FormattedMessage id="settings.functionSettings.screenshotSettings.beyondSelectRectElementOpacity" />
										}
										tooltipTitle={
											<FormattedMessage id="settings.functionSettings.screenshotSettings.beyondSelectRectElementOpacity.tip" />
										}
									/>
								}
								name="beyondSelectRectElementOpacity"
								min={0}
								max={100}
								step={1}
								marks={{
									0: "0%",
									100: "100%",
								}}
							/>
						</Col>

						<Col span={12}>
							<ProFormSlider
								label={
									<IconLabel
										label={
											<FormattedMessage id="settings.functionSettings.screenshotSettings.hotKeyTipOpacity" />
										}
									/>
								}
								name="hotKeyTipOpacity"
								min={0}
								max={100}
								step={1}
								marks={{
									0: "0%",
									100: "100%",
								}}
							/>
						</Col>
					</Row>

					<Row gutter={token.marginLG}>
						<Col span={12}>
							<ProForm.Item
								name="fullScreenAuxiliaryLineColor"
								label={
									<IconLabel
										label={
											<FormattedMessage id="settings.fullScreenAuxiliaryLineColor" />
										}
									/>
								}
								required={false}
							>
								<ColorPicker showText placement="bottom" />
							</ProForm.Item>
						</Col>

						<Col span={12}>
							<ProForm.Item
								name="monitorCenterAuxiliaryLineColor"
								label={
									<IconLabel
										label={
											<FormattedMessage id="settings.monitorCenterAuxiliaryLineColor" />
										}
									/>
								}
								required={false}
							>
								<ColorPicker showText placement="bottom" />
							</ProForm.Item>
						</Col>

						<Col span={12}>
							<ProForm.Item
								name="colorPickerCenterAuxiliaryLineColor"
								label={
									<IconLabel
										label={
											<FormattedMessage id="settings.colorPickerCenterAuxiliaryLineColor" />
										}
									/>
								}
								required={false}
							>
								<ColorPicker showText placement="bottom" />
							</ProForm.Item>
						</Col>
					</Row>

					<Row gutter={token.marginLG}>
						<Col span={24}>
							<ProFormSelect
								name="toolbarHiddenToolList"
								label={<FormattedMessage id="settings.customToolbarToolList" />}
								options={customToolbarToolListOptions}
								fieldProps={{ mode: "multiple" }}
							/>
						</Col>
					</Row>

					<Row gutter={token.marginLG}>
						<Col span={24}>
							<ToolbarActionOrderSetting
								form={screenshotForm}
								labelMap={actionToolbarStateLabelMap}
								availableActionStates={availableToolbarActionStates}
							/>
						</Col>
					</Row>
				</Spin>
			</ProForm>

			<Divider />

			<GroupTitle
				id="fixedContentSettings"
				extra={
					<ResetSettingsButton
						title={intl.formatMessage({ id: "settings.fixedContentSettings" })}
						appSettingsGroup={AppSettingsGroup.FixedContent}
					/>
				}
			>
				<FormattedMessage id="settings.fixedContentSettings" />
			</GroupTitle>

			<ProForm<AppSettingsData[AppSettingsGroup.FixedContent]>
				className="settings-form fixed-content-settings-form"
				form={fixedContentForm}
				submitter={false}
				onValuesChange={(_, values) => {
					if (typeof values.borderColor === "object") {
						values.borderColor = (
							values.borderColor as AggregationColor
						).toHexString();
					}

					updateAppSettings(
						AppSettingsGroup.FixedContent,
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
				<Spin spinning={appSettingsLoading}>
					<Row gutter={token.marginLG}>
						<Col span={12}>
							<ProForm.Item
								name="borderColor"
								label={
									<IconLabel
										label={
											<FormattedMessage id="settings.fixedContentSettings.borderColor" />
										}
									/>
								}
								required={false}
							>
								<ColorPicker showText placement="bottom" />
							</ProForm.Item>
						</Col>
					</Row>
				</Spin>
			</ProForm>

			<Divider />

			<GroupTitle
				id="trayIconSettings"
				extra={
					<ResetSettingsButton
						title={intl.formatMessage({
							id: "settings.commonSettings.trayIconSettings",
						})}
						appSettingsGroup={AppSettingsGroup.CommonTrayIcon}
					/>
				}
			>
				<FormattedMessage id="settings.commonSettings.trayIconSettings" />
			</GroupTitle>

			<ProForm<AppSettingsData[AppSettingsGroup.CommonTrayIcon]>
				form={trayIconForm}
				submitter={false}
				onValuesChange={(_, values) => {
					updateAppSettings(
						AppSettingsGroup.CommonTrayIcon,
						values,
						true,
						true,
						true,
						true,
						false,
					);
				}}
				layout="horizontal"
			>
				<Spin spinning={appSettingsLoading}>
					<Row gutter={token.marginLG}>
						<Col span={12}>
							<ProFormSwitch
								name="enableTrayIcon"
								label={
									<IconLabel
										label={
											<FormattedMessage id="settings.commonSettings.trayIconSettings.enableTrayIcon" />
										}
										tooltipTitle={
											<FormattedMessage id="settings.commonSettings.trayIconSettings.enableTrayIconTip" />
										}
									/>
								}
							/>
						</Col>

						<Col span={24}>
							<ProFormRadio.Group
								name="defaultIcons"
								label={
									<FormattedMessage id="settings.commonSettings.trayIconSettings.defaultIcons" />
								}
								options={defaultIconsOptions}
							/>
						</Col>

						<Col span={24}>
							<ProForm.Item
								name="iconPath"
								label={
									<IconLabel
										label={
											<FormattedMessage id="settings.commonSettings.trayIconSettings.iconPath" />
										}
										tooltipTitle={
											<FormattedMessage id="settings.commonSettings.trayIconSettings.iconPath.tip" />
										}
									/>
								}
								required={false}
							>
								<PathInput
									filters={[
										{ name: "PNG(*.png)", extensions: ["png"] },
										{ name: "ICO(*.ico)", extensions: ["ico"] },
									]}
								/>
							</ProForm.Item>
						</Col>

						<Col span={24}>
							<ProFormRadio.Group
								name="defaultIconsDark"
								label={
									<FormattedMessage id="settings.commonSettings.trayIconSettings.defaultIcons.darkDefault" />
								}
								options={defaultIconsOptions}
							/>
						</Col>

						<Col span={24}>
							<ProForm.Item
								name="iconPathDark"
								label={
									<IconLabel
										label={
											<FormattedMessage id="settings.commonSettings.trayIconSettings.iconPath.darkDefault" />
										}
										tooltipTitle={
											<FormattedMessage id="settings.commonSettings.trayIconSettings.iconPath.tip" />
										}
									/>
								}
								required={false}
							>
								<PathInput
									filters={[
										{ name: "PNG(*.png)", extensions: ["png"] },
										{ name: "ICO(*.ico)", extensions: ["ico"] },
									]}
								/>
							</ProForm.Item>
						</Col>
					</Row>
				</Spin>
			</ProForm>

			<style jsx>{`
                :global(.settings-form)
                    :global(.settings-wrap-language)
                    :global(.ant-form-item-control) {
                    flex-grow: unset !important;
                    min-width: 128px;
                }
            `}</style>
		</ContentWrap>
	);
};

const actionIconMap: Record<number, React.ReactNode> = {
	[DrawState.Fixed]: <FixedIcon />,
	[DrawState.OcrDetect]: <OcrDetectIcon />,
	[DrawState.OcrTranslate]: <OcrTranslateIcon />,
	[DrawState.LaserPointer]: <TranslationIcon />,
	[DrawState.ScrollScreenshot]: <ScrollScreenshotIcon />,
	[DrawState.ExtraTools]: <ScanOutlined />,
	[DrawState.Save]: <SaveIcon />,
	[DrawState.Cancel]: <CloseOutlined />,
	[DrawState.Copy]: <CopyOutlined />,
};

const ToolbarActionOrderSetting: React.FC<{
	form: ReturnType<
		typeof Form.useForm<AppSettingsData[AppSettingsGroup.Screenshot]>
	>[0];
	labelMap: Record<number, string>;
	availableActionStates: readonly DrawState[];
}> = ({ form, labelMap, availableActionStates }) => {
	const { updateAppSettings } = useContext(AppSettingsActionContext);

	const watchedToolbarActionOrder = Form.useWatch("toolbarActionOrder", {
		form,
		preserve: true,
	}) as DrawState[] | undefined;
	const watchedToolbarHiddenToolList = Form.useWatch("toolbarHiddenToolList", {
		form,
		preserve: true,
	}) as DrawState[] | undefined;
	const getInitialItems = useCallback(() => {
		return normalizeToolbarActionOrder(
			form.getFieldValue("toolbarActionOrder"),
			form.getFieldValue("toolbarHiddenToolList"),
			availableActionStates,
		);
	}, [availableActionStates, form]);
	const [items, setItems] = useState<number[]>(getInitialItems);
	const dragIndexRef = useRef<number>(-1);
	const [draggingItem, setDraggingItem] = useState<number>();

	const [dirty, setDirty] = useState(false);

	useEffect(() => {
		if (!dirty) {
			setItems(
				normalizeToolbarActionOrder(
					watchedToolbarActionOrder,
					watchedToolbarHiddenToolList,
					availableActionStates,
				),
			);
		}
	}, [
		availableActionStates,
		dirty,
		watchedToolbarActionOrder,
		watchedToolbarHiddenToolList,
	]);

	const saveOrder = useCallback(() => {
		const order = normalizeToolbarActionOrder(
			items,
			watchedToolbarHiddenToolList,
			availableActionStates,
		);
		form.setFieldValue("toolbarActionOrder", order);
		updateAppSettings(
			AppSettingsGroup.Screenshot,
			{ toolbarActionOrder: order },
			false,
			true,
			true,
			true,
			false,
		);
		setDirty(false);
	}, [
		availableActionStates,
		form,
		updateAppSettings,
		items,
		watchedToolbarHiddenToolList,
	]);

	const moveItem = useCallback((from: number, to: number) => {
		if (from === to || from < 0 || to < 0) return;
		setItems((current) => {
			if (from >= current.length || to >= current.length) return current;
			const next = [...current];
			const [moved] = next.splice(from, 1);
			next.splice(to, 0, moved);
			return next;
		});
		setDirty(true);
	}, []);

	const moveUp = useCallback(
		(index: number) => {
			if (index === 0) return;
			moveItem(index, index - 1);
		},
		[moveItem],
	);

	const moveDown = useCallback(
		(index: number) => {
			if (index >= items.length - 1) return;
			moveItem(index, index + 1);
		},
		[items.length, moveItem],
	);

	const handlePointerDown = useCallback(
		(e: React.PointerEvent, index: number, item: number) => {
			if (e.button !== 0) return;
			e.preventDefault();
			dragIndexRef.current = index;
			setDraggingItem(item);
		},
		[],
	);

	const finishDrag = useCallback(() => {
		dragIndexRef.current = -1;
		setDraggingItem(undefined);
	}, []);

	const handlePointerMove = useCallback(
		(e: PointerEvent) => {
			if (dragIndexRef.current === -1) return;
			const target = document.elementFromPoint(e.clientX, e.clientY);
			const row = target?.closest("[data-toolbar-action-index]");
			const to = Number(row?.getAttribute("data-toolbar-action-index"));
			if (Number.isNaN(to)) return;
			const from = dragIndexRef.current;
			if (from === to) return;
			moveItem(from, to);
			dragIndexRef.current = to;
		},
		[moveItem],
	);

	useEffect(() => {
		if (draggingItem === undefined) return;
		const originalCursor = document.body.style.cursor;
		const originalUserSelect = document.body.style.userSelect;
		document.body.style.cursor = "grabbing";
		document.body.style.userSelect = "none";
		window.addEventListener("pointermove", handlePointerMove);
		window.addEventListener("pointerup", finishDrag);
		window.addEventListener("pointercancel", finishDrag);
		return () => {
			document.body.style.cursor = originalCursor;
			document.body.style.userSelect = originalUserSelect;
			window.removeEventListener("pointermove", handlePointerMove);
			window.removeEventListener("pointerup", finishDrag);
			window.removeEventListener("pointercancel", finishDrag);
		};
	}, [draggingItem, finishDrag, handlePointerMove]);

	return (
		<div>
			<Typography.Text strong style={{ display: "block", marginBottom: 8 }}>
				<FormattedMessage id="settings.toolbarActionOrder" />
			</Typography.Text>
			<div
				style={{
					border: "1px solid rgba(0,0,0,0.06)",
					borderRadius: 6,
					overflow: "hidden",
				}}
			>
				{items.map((item, index) => (
					<div
						key={item}
						data-toolbar-action-index={index}
						style={{
							padding: "4px 8px",
							display: "flex",
							alignItems: "center",
							gap: 4,
							fontSize: 14,
							borderBottom:
								index < items.length - 1
									? "1px solid rgba(0,0,0,0.06)"
									: "none",
							userSelect: "none",
							background:
								draggingItem === item ? "rgba(0,0,0,0.03)" : undefined,
						}}
					>
						<Button
							type="text"
							size="small"
							disabled={index === 0}
							onClick={() => moveUp(index)}
							icon={<ArrowUpOutlined />}
						/>
						<Button
							type="text"
							size="small"
							disabled={index >= items.length - 1}
							onClick={() => moveDown(index)}
							icon={<ArrowDownOutlined />}
						/>
						<span
							style={{
								color: "#999",
								fontSize: 12,
								width: 20,
								textAlign: "right",
							}}
						>
							{index + 1}
						</span>
						<span style={{ display: "inline-flex", alignItems: "center" }}>
							{actionIconMap[item] ?? null}
						</span>
						<span style={{ flex: 1 }}>
							{labelMap[item] ?? `Unknown (${item})`}
						</span>
						<div
							onPointerDown={(e) => handlePointerDown(e, index, item)}
							style={{
								cursor: draggingItem === item ? "grabbing" : "grab",
								padding: "4px 8px",
								color: "#bbb",
								display: "flex",
								alignItems: "center",
							}}
							title="拖动排序"
						>
							<DragOutlined />
						</div>
					</div>
				))}
			</div>
			<Button
				type="primary"
				size="small"
				disabled={!dirty}
				onClick={saveOrder}
				style={{ marginTop: 8 }}
			>
				<FormattedMessage id="settings.toolbarActionOrder.save" />
			</Button>
		</div>
	);
};
