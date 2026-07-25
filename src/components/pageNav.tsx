import { Tabs, type TabsProps, theme } from "antd";
import { debounce } from "es-toolkit";
import {
	useCallback,
	useEffect,
	useImperativeHandle,
	useMemo,
	useRef,
	useState,
} from "react";
import type { RouteMapItem } from "@/types/components/menuLayout";

export type PageNavActionType = {
	updateActiveKey: () => void;
};

/** 扫描线距离视口顶部的偏移量（px） */
const DETECTION_LINE_Y = 150;

export const PageNav: React.FC<{
	tabItems: RouteMapItem;
	actionRef: React.RefObject<PageNavActionType | null>;
}> = ({ tabItems, actionRef }) => {
	const { token } = theme.useToken();

	const [activeKey, setActiveKey] = useState<string | undefined>(
		tabItems.items?.[0]?.key,
	);
	// 缓存 tabs 引用，避免闭包过期
	const tabItemsRef = useRef<TabsProps["items"]>(tabItems.items);
	useEffect(() => {
		tabItemsRef.current = tabItems.items;
	}, [tabItems]);

	/**
	 * 检测哪个锚点 section 覆盖了扫描线（距视口顶部 DETECTION_LINE_Y px）
	 *
	 * 算法：
	 *   - 遍历所有 anchor 元素，检查扫描线是否落在该元素的垂直范围内
	 *   - rect.top <= DETECTION_LINE_Y < rect.bottom → 该 section 为 active
	 *   - 边界处理：所有元素都在扫描线上方 → 取最后一个；都未到达 → 取第一个
	 */
	const detectActiveAnchor = useCallback((): string | undefined => {
		const tabs = tabItemsRef.current;
		if (!tabs || tabs.length === 0) return undefined;

		let activeKey: string | undefined;

		for (const item of tabs) {
			const element = document.getElementById(item.key as string);
			if (!element) continue;

			const rect = element.getBoundingClientRect();
			const elTop = rect.top;
			const elBottom = rect.bottom;

			if (elTop <= DETECTION_LINE_Y && elBottom > DETECTION_LINE_Y) {
				// 扫描线正好落在这个 section 内 → 完美匹配
				return item.key as string;
			}

			if (elTop <= DETECTION_LINE_Y) {
				// 这个 section 已经滚过扫描线了，暂时记住它
				// 如果后面没有更合适的，就取最后一个滚过扫描线的
				activeKey = item.key as string;
			}
			// elTop > DETECTION_LINE_Y 的 section 还没滚到，不需要记录
		}

		// 兜底：如果循环结束还没精确匹配，返回最后一个滚过扫描线的 section
		return activeKey ?? (tabs[0]?.key as string);
	}, []);

	// 核心更新逻辑：实时检测 + 防抖
	// 不做 prevActiveKey 缓存对比——React 内部会自动跳过相同值的 setState
	// 手动加这个缓存反而在点击 Tab 后会导致高亮卡住不跟随滚动
	const updateActiveKey = useCallback(() => {
		const currentKey = detectActiveAnchor();
		if (currentKey) {
			setActiveKey(currentKey);
		}
	}, [detectActiveAnchor]);

	const updateActiveKeyDebounce = useMemo(
		() => debounce(updateActiveKey, 80),
		[updateActiveKey],
	);

	// 初始化时设置默认 activeKey，并延迟检测一次当前位置
	useEffect(() => {
		const tabs = tabItems.items;
		if (!tabs || tabs.length === 0) return;

		setActiveKey(tabs[0].key as string);

		// 延迟做一次检测，确保 DOM 渲染完毕后能正确识别当前位置
		const timer = setTimeout(() => {
			const detected = detectActiveAnchor();
			if (detected) {
				setActiveKey(detected);
			}
		}, 150);

		return () => clearTimeout(timer);
	}, [tabItems, detectActiveAnchor]);

	useImperativeHandle(
		actionRef,
		() => ({
			updateActiveKey: updateActiveKeyDebounce,
		}),
		[updateActiveKeyDebounce],
	);

	return (
		<div
			className="page-nav"
			style={{ display: tabItems.hideTabs ? "none" : undefined }}
		>
			<Tabs
				activeKey={activeKey}
				items={tabItems.items}
				size="small"
				onChange={(key) => {
					const target = document.getElementById(key);
					if (!target) {
						return;
					}
					target.scrollIntoView({ behavior: "smooth" });
					setActiveKey(key);
				}}
			/>

			<style jsx>{`
                .page-nav :global(.ant-tabs) {
                    margin-top: -12px !important;
                    padding: 0 ${token.padding}px !important;
                }

                .page-nav :global(.ant-tabs-nav-wrap) {
                    height: 32px !important;
                }
            `}</style>
		</div>
	);
};
