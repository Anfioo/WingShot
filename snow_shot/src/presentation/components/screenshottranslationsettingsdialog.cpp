#include "snow_shot/presentation/components/screenshottranslationsettingsdialog.h"

#include "snow_shot/translation/translationservice.h"
#include "snow_shot/translation/translationlanguages.h"
#include "snow_shot/translation/translationproviderregistry.h"
#include "snow_shot/presentation/languagemanager.h"
#include "snow_shot/storage/settingsadapters.h"
#include "widgets/alert.h"
#include "widgets/button.h"
#include "widgets/form.h"
#include "widgets/input.h"
#include "widgets/modal.h"
#include "widgets/select.h"
#include "widgets/switch.h"

#include <QCoreApplication>
#include <QEvent>
#include <QLineEdit>
#include <QScopedValueRollback>
#include <memory>
#include <QVBoxLayout>

namespace snow_shot::presentation {
namespace {
class TranslationSettingsBody final : public QWidget {
  public:
    std::function<void()> retranslate;

  protected:
    void changeEvent(QEvent* event) override {
        QWidget::changeEvent(event);
        if (event->type() == QEvent::LanguageChange && retranslate)
            retranslate();
    }
};
struct TranslationSettingsDraft {
    bool applying = false;
    bool sourceEdited = false;
    bool targetEdited = false;
    bool modelEdited = false;
    bool providerEdited = false;
    bool baseUrlEdited = false;
    bool apiKeyEdited = false;
};
QString text(const char* source) {
    return QCoreApplication::translate("ScreenshotTranslationSettingsDialog", source);
}
} // namespace

adqt::widgets::AdModal*
createScreenshotTranslationSettingsDialog(translation::TranslationService& service, QWidget* owner,
                                          QObject* parent,
                                          std::function<void(bool)> displayModeChanged) {
    using namespace adqt::widgets;
    const QPointer<translation::TranslationService> liveService(&service);
    auto* modal = new AdModal(parent);
    modal->setObjectName(QStringLiteral("screenshotTranslationSettingsModal"));
    modal->setOwnerWindow(owner);
    modal->setMode(AdModal::Mode::Window);
    modal->setWindowModality(Qt::ApplicationModal);
    modal->setCentered(true);
    modal->setPreferredWidth(440);
    modal->setMaskVisible(false);
    modal->setCloseOnMaskClick(false);
    modal->setClosePolicy(AdModal::ClosePolicy::Manual);
    modal->setStandardButtons(AdModal::StandardButton::Ok | AdModal::StandardButton::Cancel);
    auto* body = new TranslationSettingsBody;
    auto draft = std::make_shared<TranslationSettingsDraft>();
    auto* layout = new QVBoxLayout(body);
    layout->setContentsMargins(0, 0, 0, 0);
    layout->setSpacing(12);
    auto* error = new AdAlert(body);
    error->setObjectName(QStringLiteral("screenshotTranslationSettingsError"));
    error->setSeverity(AdAlert::Severity::Error);
    auto* retry = new AdButton(error);
    retry->setObjectName(QStringLiteral("screenshotTranslationSettingsRetry"));
    retry->setButtonStyle(AdButton::ButtonStyle::Text);
    retry->setAccentRole(AdButton::AccentRole::Primary);
    retry->setSizeClass(AdButton::SizeClass::Small);
    error->setActionsWidget(retry);
    layout->addWidget(error);
    auto* form = new AdForm(body);
    form->setFormLayout(AdForm::FormLayout::Vertical);
    auto* source = new AdSelect(form);
    auto* target = new AdSelect(form);
    auto* models = new AdSelect(form);
    auto* providers = new AdSelect(form);
    source->setObjectName(QStringLiteral("screenshotTranslationSourceLanguage"));
    target->setObjectName(QStringLiteral("screenshotTranslationTargetLanguage"));
    models->setObjectName(QStringLiteral("screenshotTranslationService"));
    providers->setObjectName(QStringLiteral("screenshotTranslationProvider"));
    for (auto* select : {source, target, models, providers})
        select->setPopupLayerMode(AdSelect::PopupLayerMode::QtTool);
    auto* baseUrl = new AdLineEdit(form);
    auto* apiKey = new AdLineEdit(form);
    baseUrl->setObjectName(QStringLiteral("screenshotTranslationProviderBaseUrl"));
    apiKey->setObjectName(QStringLiteral("screenshotTranslationProviderApiKey"));
    apiKey->setEchoMode(QLineEdit::Password);
    auto* imageRow = new QWidget(form);
    auto* imageLayout = new QHBoxLayout(imageRow);
    imageLayout->setContentsMargins(0, 0, 0, 0);
    auto* image = new AdSwitch(imageRow);
    image->setObjectName(QStringLiteral("screenshotTranslationOriginalImage"));
    image->setControlSize(AdSwitch::ControlSize::Medium);
    image->setChecked(storage::ScreenshotTranslationSettings().originalImageTranslationEnabled());
    imageLayout->addWidget(image);
    imageLayout->addStretch();
    auto* manualRow = new QWidget(form);
    auto* manualLayout = new QHBoxLayout(manualRow);
    manualLayout->setContentsMargins(0, 0, 0, 0);
    auto* manual = new AdSwitch(manualRow);
    manual->setObjectName(QStringLiteral("screenshotTranslationManualTrigger"));
    manual->setControlSize(AdSwitch::ControlSize::Medium);
    manual->setChecked(
        storage::ScreenshotTranslationSettings().configuration().manualTrigger);
    manualLayout->addWidget(manual);
    manualLayout->addStretch();
    form->addField({}, source, QStringLiteral("source"));
    form->addField({}, target, QStringLiteral("target"));
    form->addField({}, providers, QStringLiteral("provider"));
    form->addField({}, models, QStringLiteral("service"));
    form->addField({}, baseUrl, QStringLiteral("providerBaseUrl"));
    form->addField({}, apiKey, QStringLiteral("providerApiKey"));
    form->addField({}, imageRow, QStringLiteral("originalImage"));
    form->addField({}, manualRow, QStringLiteral("manualTrigger"));
    layout->addWidget(form);
    modal->setContentWidget(body);
    modal->setInitialFocusWidget(source);

    const auto retranslate = [=, &service] {
        const QScopedValueRollback guard(draft->applying, true);
        modal->setWindowTitle(
            text(QT_TRANSLATE_NOOP("ScreenshotTranslationSettingsDialog", "Translation settings")));
        modal->setAcceptText(text(QT_TRANSLATE_NOOP("ScreenshotTranslationSettingsDialog", "OK")));
        modal->setRejectText(
            text(QT_TRANSLATE_NOOP("ScreenshotTranslationSettingsDialog", "Cancel")));
        retry->setText(text(QT_TRANSLATE_NOOP("ScreenshotTranslationSettingsDialog", "Retry")));
        const char* labels[] = {
            QT_TRANSLATE_NOOP("ScreenshotTranslationSettingsDialog", "Source language"),
            QT_TRANSLATE_NOOP("ScreenshotTranslationSettingsDialog", "Target language"),
            QT_TRANSLATE_NOOP("ScreenshotTranslationSettingsDialog", "Translation source"),
            QT_TRANSLATE_NOOP("ScreenshotTranslationSettingsDialog", "Translation service"),
            QT_TRANSLATE_NOOP("ScreenshotTranslationSettingsDialog", "Base URL"),
            QT_TRANSLATE_NOOP("ScreenshotTranslationSettingsDialog", "API key"),
            QT_TRANSLATE_NOOP("ScreenshotTranslationSettingsDialog", "Original Image Translation"),
            QT_TRANSLATE_NOOP("ScreenshotTranslationSettingsDialog", "Manual translation")};
        const QString keys[] = {QStringLiteral("source"),
                                QStringLiteral("target"),
                                QStringLiteral("provider"),
                                QStringLiteral("service"),
                                QStringLiteral("providerBaseUrl"),
                                QStringLiteral("providerApiKey"),
                                QStringLiteral("originalImage"),
                                QStringLiteral("manualTrigger")};
        for (int i = 0; i < 8; ++i)
            form->field(keys[i])->setLabel(text(labels[i]));
        source->setAccessibleName(text(labels[0]));
        target->setAccessibleName(text(labels[1]));
        providers->setAccessibleName(text(labels[2]));
        models->setAccessibleName(text(labels[3]));
        baseUrl->setAccessibleName(text(labels[4]));
        apiKey->setAccessibleName(text(labels[5]));
        image->setAccessibleName(text(labels[6]));
        manual->setAccessibleName(text(labels[7]));
        baseUrl->setPlaceholderText(QStringLiteral("https://api.example.com/v1"));
        const auto selectedSource = source->currentValue();
        const auto selectedTarget = target->currentValue();
        QVector<AdSelect::Option> sources{
            {QStringLiteral("auto"), translation::translationLanguageName(QStringLiteral("auto"))}};
        QVector<AdSelect::Option> targets;
        for (const auto& language : translation::translationLanguages()) {
            const QString code = QString::fromLatin1(language.code);
            AdSelect::Option option{code, translation::translationLanguageName(code), false,
                                    code.left(1).toUpper()};
            sources.append(option);
            targets.append(option);
        }
        source->setOptions(sources);
        target->setOptions(targets);
        source->setCurrentValue(selectedSource.isValid()
                                    ? selectedSource
                                    : QVariant(service.preferences().sourceLanguage));
        target->setCurrentValue(selectedTarget.isValid()
                                    ? selectedTarget
                                    : QVariant(service.preferences().targetLanguage));
    };
    const auto sync = [=, &service] {
        const QScopedValueRollback guard(draft->applying, true);
        const QString providerId = draft->providerEdited
                                       ? providers->currentValue().toString()
                                       : service.preferences().providerId;
        const bool external = !translation::isBuiltInTranslationProvider(providerId);
        QVector<AdSelect::Option> options;
        for (const auto& model : service.models())
            options.append(
                {model.id, model.name, false, translation::translationModelGroup(model)});
        QString selected =
            draft->modelEdited ? models->currentValue().toString() : service.preferences().modelId;
        if (selected.isEmpty())
            selected = service.preferences().modelId;
        const int index = translation::translationModelIndex(service.models(), selected);
        models->setOptions(options);
        models->setCurrentValue(index >= 0 ? QVariant(service.models().at(index).id) : QVariant());
        models->setLoading(!external && options.isEmpty() && service.loadingModels());
        // External providers translate directly through an adapter; the cloud model picker
        // and its availability gate do not apply.
        models->setEnabled(!external && !options.isEmpty());
        form->field(QStringLiteral("service"))->setVisible(!external);
        if (modal->acceptButton() != nullptr)
            modal->acceptButton()->setEnabled(external || !options.isEmpty());
        error->setText(service.errorText());
        error->setVisible(!service.errorText().isEmpty());
        retry->setBusy(!external && service.loadingModels());
    };
    const auto syncProviders = [=, &service] {
        const QScopedValueRollback guard(draft->applying, true);
        QVector<AdSelect::Option> options;
        for (const auto& info : translation::availableTranslationProviders())
            options.append({info.id, info.displayName});
        providers->setOptions(options);
        const QString selected = draft->providerEdited ? providers->currentValue().toString()
                                                      : service.preferences().providerId;
        providers->setCurrentValue(selected.isEmpty() ? QVariant(QStringLiteral("snowshot"))
                                                     : QVariant(selected));
        bool needsBaseUrl = false;
        bool needsApiKey = false;
        for (const auto& info : translation::availableTranslationProviders()) {
            if (info.id == selected) {
                needsBaseUrl = info.requiresBaseUrl;
                needsApiKey = info.requiresApiKey;
            }
        }
        form->field(QStringLiteral("providerBaseUrl"))->setVisible(needsBaseUrl);
        form->field(QStringLiteral("providerApiKey"))->setVisible(needsApiKey);
        if (!draft->baseUrlEdited)
            baseUrl->setText(service.providerConfig().baseUrl);
        if (!draft->apiKeyEdited)
            apiKey->setText(service.providerConfig().apiKey);
    };
    QObject::connect(&service, &translation::TranslationService::catalogChanged, modal,
                     [sync, syncProviders] {
                         sync();
                         syncProviders();
                     });
    QObject::connect(&service, &translation::TranslationService::preferencesChanged, modal,
                     [=, &service] {
                         const QScopedValueRollback guard(draft->applying, true);
                         if (!draft->sourceEdited)
                             source->setCurrentValue(service.preferences().sourceLanguage);
                         if (!draft->targetEdited)
                             target->setCurrentValue(service.preferences().targetLanguage);
                         sync();
                         syncProviders();
                     });
    QObject::connect(source, &AdSelect::currentValueChanged, modal, [draft] {
        if (!draft->applying)
            draft->sourceEdited = true;
    });
    QObject::connect(target, &AdSelect::currentValueChanged, modal, [draft] {
        if (!draft->applying)
            draft->targetEdited = true;
    });
    QObject::connect(models, &AdSelect::currentValueChanged, modal, [draft] {
        if (!draft->applying)
            draft->modelEdited = true;
    });
    QObject::connect(providers, &AdSelect::currentValueChanged, modal, [draft, sync, syncProviders] {
        if (!draft->applying)
            draft->providerEdited = true;
        sync();
        syncProviders();
    });
    QObject::connect(baseUrl, &AdLineEdit::textChanged, modal, [draft] {
        if (!draft->applying)
            draft->baseUrlEdited = true;
    });
    QObject::connect(apiKey, &AdLineEdit::textChanged, modal, [draft] {
        if (!draft->applying)
            draft->apiKeyEdited = true;
    });
    body->retranslate = [retranslate, sync, syncProviders] {
        retranslate();
        sync();
        syncProviders();
    };
    QObject::connect(&service, &QObject::destroyed, modal, [modal, body] {
        body->retranslate = {};
        modal->reject();
    });
    QObject::connect(&LanguageManager::instance(), &LanguageManager::languageChanged, modal,
                     [retranslate, sync, syncProviders, liveService](const QString&,
                                                                    const QLocale& locale) {
                         if (liveService == nullptr)
                             return;
                         liveService->setLocale(locale);
                         retranslate();
                         sync();
                         syncProviders();
                     });
    QObject::connect(retry, &AdButton::clicked, modal, [liveService] {
        if (liveService != nullptr)
            liveService->refreshModels(true);
    });
    QObject::connect(modal, &AdModal::closeRequested, modal, [=](AdModal::CloseReason reason) {
        if (reason != AdModal::CloseReason::OkAction || liveService == nullptr) {
            modal->reject();
            return;
        }
        if (!models->isEnabled() &&
            translation::isBuiltInTranslationProvider(providers->currentValue().toString()))
            return;
        translation::TranslationPreferences preferences{
            source->currentValue().toString(), target->currentValue().toString(),
            models->currentValue().toString(), providers->currentValue().toString()};
        if (!liveService->savePreferences(preferences))
            return;
        translation::TranslationProviderConfig config;
        config.providerId = preferences.providerId;
        config.baseUrl = baseUrl->text().trimmed();
        config.apiKey = apiKey->text().trimmed();
        config.model = liveService->providerConfig().model;
        liveService->saveProviderConfig(config);
        const storage::ScreenshotTranslationSettings settings;
        const bool changed = settings.originalImageTranslationEnabled() != image->isChecked();
        if (changed && !settings.setOriginalImageTranslationEnabled(image->isChecked())) {
            error->setText(
                QCoreApplication::translate("snow_shot::translation::TranslationService",
                                            "Unable to save translation preferences. Your "
                                            "previous selections were restored."));
            error->show();
            return;
        }
        auto translationConfig = settings.configuration();
        if (translationConfig.manualTrigger != manual->isChecked()) {
            translationConfig.manualTrigger = manual->isChecked();
            settings.setConfiguration(translationConfig);
        }
        if (changed && displayModeChanged) {
            displayModeChanged(true);
            displayModeChanged(false);
        }
        modal->accept();
    });
    QObject::connect(modal, &AdModal::finished, modal, &QObject::deleteLater);
    retranslate();
    sync();
    syncProviders();
    service.refreshModels();
    // Resolve the initial visibility and nested form hints before sizing the centered window.
    body->ensurePolished();
    const auto children = body->findChildren<QWidget*>();
    for (auto it = children.crbegin(); it != children.crend(); ++it) {
        (*it)->ensurePolished();
        if ((*it)->layout() != nullptr)
            (*it)->layout()->activate();
    }
    layout->activate();
    modal->open();
    if (modal->acceptButton() != nullptr) {
        const bool external =
            !translation::isBuiltInTranslationProvider(service.preferences().providerId);
        modal->acceptButton()->setEnabled(external || !service.models().isEmpty());
    }
    return modal;
}
} // namespace snow_shot::presentation
