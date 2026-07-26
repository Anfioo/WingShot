import { createLazyFileRoute } from "@tanstack/react-router";
import { ModelSettingsPage } from "@/pages/settings/modelSettings/page";

export const Route = createLazyFileRoute("/_layout/settings/modelSettings")({
	component: ModelSettingsComponent,
});

function ModelSettingsComponent() {
	return <ModelSettingsPage />;
}
