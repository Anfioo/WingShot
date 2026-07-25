import { CheckOutlined, DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { Button, type ButtonProps, Flex, Modal, Space, theme } from "antd";
import { trim } from "es-toolkit";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRecordHotkeys } from "react-hotkeys-hook";
import { FormattedMessage } from "react-intl";
import { listenKeyStart, listenKeyStop } from "@/commands/listenKey";
import { formatKey } from "@/utils/format";
import { appError } from "@/utils/log";
import { getPlatform } from "@/utils/platform";
import { KeyboardGrayIcon } from "../icons";

type KeyConfig = {
	recordKeys: string;
	index: number;
};

const convertKeyConfigToString = (
	keys: Set<string>,
	spicalRecordKeys?: Record<string, number>,
) => {
	const keysArray = Array.from(keys).map((item) => {
		if (item === "") {
			return "";
		}

		return `${item[0].toUpperCase()}${item.slice(1).toLowerCase()}`;
	});

	let text = "";

	// 如果没有特殊按键，直接返回原有逻辑
	if (!spicalRecordKeys || Object.keys(spicalRecordKeys).length === 0) {
		text = keysArray.join("+");
	} else {
		// 创建结果数组，初始为普通按键
		const result = [...keysArray];

		// 将特殊按键按照位置从大到小排序，这样插入时不会影响前面的位置
		const sortedSpecialKeys = Object.entries(spicalRecordKeys).sort(
			([, positionA], [, positionB]) => positionB - positionA,
		);

		// 按位置插入特殊按键
		sortedSpecialKeys.forEach(([key, position]) => {
			result.splice(position, 0, key);
		});

		text = result.join("+");
	}

	const platform = getPlatform();
	if (platform === "windows") {
		return text.replace("Meta", "Super");
	} else {
		return text;
	}
};

export const KeyButton: React.FC<{
	title: React.ReactNode;
	keyValue: string;
	onKeyChange: (value: string) => Promise<void>;
	width?: number;
	maxWidth?: number;
	buttonProps?: ButtonProps;
	maxLength: number;
	onCancel?: () => void;
	speicalKeys?: string[];
}> = ({
	title,
	keyValue,
	onKeyChange,
	width,
	maxWidth,
	buttonProps,
	maxLength,
	onCancel,
	speicalKeys,
}) => {
	const { token } = theme.useToken();

	const [open, setOpen] = useState(false);

	const keyConfigListRef = useRef<KeyConfig[]>([]);
	const [keyConfigList, _setKeyConfigList] = useState<KeyConfig[]>([]);
	const setKeyConfigList = useCallback(
		(value: KeyConfig[] | ((pre: KeyConfig[]) => KeyConfig[])) => {
			keyConfigListRef.current = Array.isArray(value)
				? value
				: value(keyConfigListRef.current);
			_setKeyConfigList(keyConfigListRef.current);
		},
		[],
	);

	const inputAnyKeyConfigIndexRef = useRef<number | undefined>(undefined);
	const [inputAnyKeyConfigIndex, _setInputAnyKeyConfigIndex] = useState<
		number | undefined
	>();
	const setInputAnyKeyConfigIndex = useCallback((index: number | undefined) => {
		inputAnyKeyConfigIndexRef.current = index;
		_setInputAnyKeyConfigIndex(index);
	}, []);

	const [spicalRecordKeys, setSpicalRecordKeys] = useState<
		Record<string, number>
	>({});
	const [recordKeys, { start: startRecord, stop: _stopRecord }] =
		useRecordHotkeys();
	const stopRecord = useCallback(() => {
		_stopRecord();
		setSpicalRecordKeys({});
	}, [_stopRecord]);

	useEffect(() => {
		if (!open) {
			return;
		}

		const keyConfigValueList = keyValue.split(",").map((item) => trim(item));

		const configList = keyConfigValueList
			.slice(0, maxLength)
			.map((value, index) => {
				const recordKeys = value;

				return {
					recordKeys,
					index,
				};
			});
		setKeyConfigList(configList);
		// 如果没有快捷键，自动开始录制第一个
		if (configList.every((item) => item.recordKeys === "")) {
			setTimeout(() => {
				setInputAnyKeyConfigIndex(0);
				startRecord();
			}, 0);
		}
	}, [
		keyValue,
		maxLength,
		setInputAnyKeyConfigIndex,
		setKeyConfigList,
		open,
		startRecord,
	]);

	const updateKeyConfig = useCallback(() => {
		setKeyConfigList((pre) => {
			return [...pre];
		});
	}, [setKeyConfigList]);

	useEffect(() => {
		setInputAnyKeyConfigIndex(undefined);
		if (open) {
			updateKeyConfig();
		}
	}, [open, setInputAnyKeyConfigIndex, updateKeyConfig]);

	const [confirmLoading, setConfirmLoading] = useState(false);

	const stopRecordAndSave = useCallback(() => {
		stopRecord();

		if (inputAnyKeyConfigIndexRef.current === undefined) {
			return;
		}

		if (recordKeys.size === 0 && Object.keys(spicalRecordKeys).length === 0) {
			return;
		}

		const newRecordKeys = convertKeyConfigToString(
			recordKeys,
			spicalRecordKeys,
		);
		const currentIndex = inputAnyKeyConfigIndexRef.current;

		// 同时更新 ref 和 state
		keyConfigListRef.current[currentIndex].recordKeys = newRecordKeys;

		setKeyConfigList((pre) => {
			const newList = [...pre];
			if (newList[currentIndex]) {
				newList[currentIndex] = {
					...newList[currentIndex],
					recordKeys: newRecordKeys,
				};
			}
			return newList;
		});

		setInputAnyKeyConfigIndex(undefined);
	}, [
		recordKeys,
		setInputAnyKeyConfigIndex,
		spicalRecordKeys,
		stopRecord,
		setKeyConfigList,
	]);

	useEffect(() => {
		if (open) {
			listenKeyStart().catch((error) => {
				appError("[KeyButton] listenKeyStart error", error);
			});
		} else {
			listenKeyStop().catch((error) => {
				appError("[KeyButton] listenKeyStop error", error);
			});
		}
	}, [open]);

	const formatKeyText = useMemo(() => {
		return formatKey(keyValue);
	}, [keyValue]);

	return (
		<>
			<Modal
				title={<FormattedMessage id="settings.keyConfig" values={{ title }} />}
				open={open}
				onCancel={() => {
					onCancel?.();
					setOpen(false);
					setSpicalRecordKeys({});
				}}
				confirmLoading={confirmLoading}
				onOk={() => {
					stopRecordAndSave();
					setConfirmLoading(true);
					// 使用 ref 获取最新值，因为 state 更新是异步的
					onKeyChange(
						keyConfigListRef.current
							.map((item) => {
								return item.recordKeys;
							})
							.filter((key) => key.length > 0)
							.join(", "),
					).finally(() => {
						setConfirmLoading(false);
						setOpen(false);
					});
				}}
			>
				{keyConfigList.map((keyConfig) => {
					return (
						<div key={keyConfig.index}>
							<Flex
								align="center"
								justify="space-between"
								wrap
								style={{ marginBottom: token.margin }}
							>
								<Space>
									<Button
										onClick={() => {
											keyConfig.recordKeys = "";
											setInputAnyKeyConfigIndex(keyConfig.index);
											startRecord();
										}}
										loading={inputAnyKeyConfigIndex === keyConfig.index}
										style={{
											opacity:
												inputAnyKeyConfigIndex === keyConfig.index ? 0.42 : 1,
										}}
										icon={
											inputAnyKeyConfigIndex === keyConfig.index ? undefined : (
												<KeyboardGrayIcon />
											)
										}
									>
										{inputAnyKeyConfigIndex === keyConfig.index ? (
											recordKeys.size > 0 ||
											Object.keys(spicalRecordKeys).length > 0 ? (
												formatKey(
													convertKeyConfigToString(
														recordKeys,
														spicalRecordKeys,
													),
												)
											) : (
												<FormattedMessage id="settings.pleasePressTheKey" />
											)
										) : (
											formatKey(keyConfig.recordKeys)
										)}
									</Button>
								</Space>

								{inputAnyKeyConfigIndex !== keyConfig.index ? (
									<Button
										danger
										onClick={() => {
											setKeyConfigList((pre) => {
												return pre.filter(
													(item) => item.index !== keyConfig.index,
												);
											});
										}}
										type="text"
										variant="outlined"
										color="red"
										icon={<DeleteOutlined />}
									></Button>
								) : (
									<Button
										disabled={
											recordKeys.size === 0 &&
											Object.keys(spicalRecordKeys).length === 0
										}
										onClick={() => {
											stopRecordAndSave();
										}}
										type="default"
										variant="outlined"
										color="green"
										icon={<CheckOutlined />}
									></Button>
								)}
							</Flex>
							{inputAnyKeyConfigIndex === keyConfig.index && speicalKeys && (
								<Space style={{ marginBottom: token.margin }}>
									{speicalKeys?.map((item) => {
										return (
											<Button
												key={item}
												type="text"
												variant="outlined"
												color="blue"
												size="small"
												onClick={() => {
													setSpicalRecordKeys((pre) => {
														return {
															...pre,
															[item]: recordKeys.size,
														};
													});
												}}
											>
												{item}
											</Button>
										);
									})}
								</Space>
							)}
						</div>
					);
				})}
				{maxLength > 1 && (
					<Button
						block
						icon={<PlusOutlined />}
						type={"dashed"}
						disabled={
							inputAnyKeyConfigIndex !== undefined ||
							keyConfigList.length >= maxLength
						}
						hidden={keyConfigList.length >= maxLength}
						onClick={() => {
							if (keyConfigList.length >= maxLength) {
								return;
							}

							const index = keyConfigList.length;
							setKeyConfigList((pre) => {
								return [
									...pre,
									{
										recordKeys: "",
										index,
									},
								];
							});
							setInputAnyKeyConfigIndex(index);
							startRecord();
						}}
					>
						<FormattedMessage id="settings.addKeyConfig" />
					</Button>
				)}
			</Modal>
			<Button
				{...buttonProps}
				icon={<KeyboardGrayIcon />}
				danger={keyValue ? undefined : true}
				onClick={(e) => {
					buttonProps?.onClick?.(e);
					setOpen(true);
				}}
				title={formatKeyText}
			>
				<span
					style={{
						width,
						maxWidth,
						textOverflow: "ellipsis",
						overflow: "hidden",
						display: "inline-block",
					}}
				>
					{formatKeyText}
				</span>
				{buttonProps?.children}
			</Button>
		</>
	);
};
