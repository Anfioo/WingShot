import { Button, Flex, Segmented, theme } from "antd";
import { useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";
import type { ChatModelTestResult } from "@/core/chatModels";
import {
	chatModelProviderTabs,
	createChatModelAdapterId,
	createEmptyChatModelAdapter,
	getProviderLabel,
	normalizeChatModelAdapter,
	testChatModelAdapter,
} from "@/core/chatModels";
import type {
	ChatModelAdapterConfig,
	ChatModelProviderType,
} from "@/types/appSettings";
import { ModelAdapterGrid } from "./modelAdapterCard";
import { ModelAdapterModal } from "./modelAdapterModal";

const BATCH_TEST_CONCURRENCY = 5;

export const ModelAdapterList: React.FC<{
	value?: ChatModelAdapterConfig[];
	onChange?: (value: ChatModelAdapterConfig[]) => void;
}> = ({ value = [], onChange }) => {
	const intl = useIntl();
	const { token } = theme.useToken();
	const [activeType, setActiveType] = useState<ChatModelProviderType>("openai");
	const [editingAdapter, setEditingAdapter] =
		useState<ChatModelAdapterConfig>();
	const [modalOpen, setModalOpen] = useState(false);
	const [testResults, setTestResults] = useState<
		Record<string, ChatModelTestResult | undefined>
	>({});
	const [testingIds, setTestingIds] = useState<Set<string>>(new Set());
	const [batchTesting, setBatchTesting] = useState(false);
	const [batchProgress, setBatchProgress] = useState({
		total: 0,
		completed: 0,
	});
	const batchStopRef = useRef(false);

	const filteredAdapters = useMemo(
		() => value.filter((item) => item.type === activeType),
		[value, activeType],
	);

	const updateAdapters = (next: ChatModelAdapterConfig[]) => {
		onChange?.(next.map((item) => normalizeChatModelAdapter(item)));
	};

	const runTest = async (adapter: ChatModelAdapterConfig) => {
		setTestingIds((prev) => new Set(prev).add(adapter.id));
		setTestResults((prev) => ({
			...prev,
			[adapter.id]: { status: "running", summaryText: "测试中..." },
		}));
		try {
			const result = await testChatModelAdapter(adapter);
			setTestResults((prev) => ({ ...prev, [adapter.id]: result }));
		} finally {
			setTestingIds((prev) => {
				const next = new Set(prev);
				next.delete(adapter.id);
				return next;
			});
		}
	};

	const runAllTests = async () => {
		const adapters = filteredAdapters.slice();
		if (adapters.length === 0) return;
		batchStopRef.current = false;
		setBatchTesting(true);
		setBatchProgress({ total: adapters.length, completed: 0 });
		let completed = 0;
		const workers = Array.from(
			{ length: Math.min(BATCH_TEST_CONCURRENCY, adapters.length) },
			async () => {
				while (!batchStopRef.current) {
					const index = completed;
					completed += 1;
					if (index >= adapters.length) break;
					const adapter = adapters[index];
					setTestingIds((prev) => new Set(prev).add(adapter.id));
					try {
						const result = await testChatModelAdapter(adapter);
						setTestResults((prev) => ({ ...prev, [adapter.id]: result }));
					} finally {
						setTestingIds((prev) => {
							const next = new Set(prev);
							next.delete(adapter.id);
							return next;
						});
						setBatchProgress((prev) => ({
							...prev,
							completed: prev.completed + 1,
						}));
					}
				}
			},
		);
		await Promise.allSettled(workers);
		setBatchTesting(false);
		setBatchProgress({ total: 0, completed: 0 });
	};

	const handleStopBatch = () => {
		batchStopRef.current = true;
	};

	const batchButtonDisabled =
		filteredAdapters.length === 0 || (!batchTesting && testingIds.size > 0);
	const batchButtonText = batchTesting
		? `${intl.formatMessage({ id: "settings.modelSettings.modelAdapter.stopTest" })} ${batchProgress.completed}/${batchProgress.total}`
		: intl.formatMessage({ id: "settings.modelSettings.modelAdapter.testAll" });

	return (
		<Flex vertical gap={token.margin}>
			<Flex align="center" justify="space-between" gap={token.margin}>
				<Segmented
					value={activeType}
					options={chatModelProviderTabs.map((item) => ({
						label: item.label,
						value: item.value,
					}))}
					onChange={(type) => setActiveType(type as ChatModelProviderType)}
				/>
				<Flex gap={token.marginXS}>
					<Button
						disabled={batchButtonDisabled}
						onClick={batchTesting ? handleStopBatch : runAllTests}
					>
						{batchButtonText}
					</Button>
					<Button
						type="primary"
						disabled={batchTesting}
						onClick={() => {
							setEditingAdapter(undefined);
							setModalOpen(true);
						}}
					>
						{intl.formatMessage({
							id: "settings.modelSettings.modelAdapter.addButton",
						})}
					</Button>
				</Flex>
			</Flex>

			<ModelAdapterGrid
				adapters={filteredAdapters}
				testResults={testResults}
				testingIds={testingIds}
				disabled={batchTesting}
				providerLabel={getProviderLabel(activeType)}
				onTest={runTest}
				onEdit={(adapter) => {
					setEditingAdapter(adapter);
					setModalOpen(true);
				}}
				onDuplicate={(adapter) => {
					updateAdapters([
						...value,
						normalizeChatModelAdapter({
							...adapter,
							id: createChatModelAdapterId(),
							displayName: `${adapter.displayName || adapter.modelID} Copy`,
						}),
					]);
				}}
				onDelete={(adapter) => {
					updateAdapters(value.filter((item) => item.id !== adapter.id));
				}}
			/>

			<ModelAdapterModal
				open={modalOpen}
				adapter={editingAdapter}
				providerType={activeType}
				onCancel={() => setModalOpen(false)}
				onSave={(adapter) => {
					const target = adapter.id
						? adapter
						: createEmptyChatModelAdapter(adapter.type);
					const nextAdapter = normalizeChatModelAdapter({
						...target,
						...adapter,
					});
					const exists = value.some((item) => item.id === nextAdapter.id);
					updateAdapters(
						exists
							? value.map((item) =>
									item.id === nextAdapter.id ? nextAdapter : item,
								)
							: [...value, nextAdapter],
					);
					setActiveType(nextAdapter.type);
					setModalOpen(false);
				}}
			/>
		</Flex>
	);
};
