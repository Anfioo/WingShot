#ifndef SNOW_SHOT_TRANSLATION_TRANSLATIONPROVIDER_H
#define SNOW_SHOT_TRANSLATION_TRANSLATIONPROVIDER_H

#include <QObject>
#include <QString>
#include <functional>

namespace snow_shot::translation {

// User-selectable translation source. The built-in "snowshot" value keeps using the
// cloud SnowShotApiClient chain unchanged; every other value routes through an adapter.
struct TranslationProviderConfig {
    QString providerId = QStringLiteral("snowshot");
    QString apiKey;  // DeepL / OpenAI-compatible
    QString baseUrl; // DeepL (optional override) / OpenAI-compatible (required)
    QString model;   // OpenAI-compatible model name
    friend bool operator==(const TranslationProviderConfig&,
                           const TranslationProviderConfig&) = default;
};

struct TranslationProviderRequest {
    QString sourceLanguage;
    QString targetLanguage;
    QString text;
};

struct TranslationProviderResult {
    QString text;    // translated text on success
    QString error;   // human-readable, tr()-wrapped English on failure
    int httpStatus = 0;
    bool cancelled = false;
    [[nodiscard]] bool succeeded() const {
        return error.isEmpty() && !cancelled;
    }
};

// Static description of a source shown in the picker. displayName is already translated.
struct TranslationProviderInfo {
    QString id;
    QString displayName;
    bool requiresApiKey = false;
    bool requiresBaseUrl = false;
};

// One adapter per external translation service. Implementations are non-streaming: they
// emit the finished text through delta() exactly once and then invoke completion().
class TranslationProvider : public QObject {
    Q_OBJECT
  public:
    using Token = quint64;
    using Delta = std::function<void(const QString&)>;
    using Completion = std::function<void(TranslationProviderResult)>;

    explicit TranslationProvider(QObject* parent = nullptr) : QObject(parent) {}
    ~TranslationProvider() override = default;

    // Starts a translation. delta() may be invoked at most once with the full text;
    // completion() is invoked exactly once afterwards. Returns 0 when the request cannot
    // be prepared (e.g. missing base URL). receiver owns the request and cancels it on
    // destruction.
    [[nodiscard]] virtual Token translate(const TranslationProviderRequest& request,
                                          QObject* receiver, Delta delta,
                                          Completion completion) = 0;
    virtual void cancel(Token token) = 0;
};

} // namespace snow_shot::translation
#endif // SNOW_SHOT_TRANSLATION_TRANSLATIONPROVIDER_H
