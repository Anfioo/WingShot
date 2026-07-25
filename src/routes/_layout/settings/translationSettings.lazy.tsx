import { createLazyFileRoute } from "@tanstack/react-router";
import { TranslationSettingsPage } from "@/pages/settings/translationSettings/page";

export const Route = createLazyFileRoute(
	"/_layout/settings/translationSettings",
)({
	component: TranslationSettingsComponent,
});

function TranslationSettingsComponent() {
	return <TranslationSettingsPage />;
}
