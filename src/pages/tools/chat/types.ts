import type { ChatWorkflowConfig, ChatWorkflowFlow } from "@/utils/appStore";

export type ChatImageAttachment = {
	id: string;
	name: string;
	mimeType: string;
	dataURL: string;
};

export type SendQueueMessage = {
	title: string;
	content: string;
	imageAttachments?: ChatImageAttachment[];
	flow_config?: ChatMessageFlowConfig;
};

export type ChatMessage = {
	content:
		| {
				reasoning_content: string;
				content: string;
				response_error: boolean;
		  }
		| string;
	role: "user" | "assistant";
	imageAttachments?: ChatImageAttachment[];
	flow_config?: ChatMessageFlowConfig;
};

export type ChatMessageFlowConfig = Omit<ChatWorkflowConfig, "flow_list"> & {
	flow: ChatWorkflowFlow;
	globalVariable?: Map<string, string>;
};
