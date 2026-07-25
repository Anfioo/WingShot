import { emit } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";

export const FIXED_CONTENT_FOCUS_MODE_SHOW_ALL_WINDOW =
	"fixed-content-focus-mode-show-all-window";
export const FIXED_CONTENT_FOCUS_MODE_HIDE_OTHER_WINDOW =
	"fixed-content-focus-mode-hide-other-window";
export const FIXED_CONTENT_FOCUS_MODE_CLOSE_OTHER_WINDOW =
	"fixed-content-focus-mode-close-other-window";
export const FIXED_CONTENT_FOCUS_MODE_CLOSE_ALL_WINDOW =
	"fixed-content-focus-mode-close-all-window";
export const TOGGLE_FIXED_CONTENT_VISIBILITY =
	"toggle-fixed-content-visibility";

let globalFixedContentVisible = true;

export const fixedContentFocusModeShowAllWindow = async () => {
	await emit(FIXED_CONTENT_FOCUS_MODE_SHOW_ALL_WINDOW, {
		windowLabel: getCurrentWindow().label,
	});
};

export const fixedContentFocusModeHideOtherWindow = async () => {
	await emit(FIXED_CONTENT_FOCUS_MODE_HIDE_OTHER_WINDOW, {
		windowLabel: getCurrentWindow().label,
	});
};

export const fixedContentFocusModeCloseOtherWindow = async () => {
	await emit(FIXED_CONTENT_FOCUS_MODE_CLOSE_OTHER_WINDOW, {
		windowLabel: getCurrentWindow().label,
	});
};

export const fixedContentFocusModeCloseAllWindow = async () => {
	await emit(FIXED_CONTENT_FOCUS_MODE_CLOSE_ALL_WINDOW, {
		windowLabel: getCurrentWindow().label,
	});
};

export const toggleFixedContentVisibility = async () => {
	globalFixedContentVisible = !globalFixedContentVisible;
	await emit(TOGGLE_FIXED_CONTENT_VISIBILITY, {
		visible: globalFixedContentVisible,
	});
};
