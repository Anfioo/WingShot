#ifndef SNOW_SHOT_TRANSLATION_TRANSLATIONPROVIDERREGISTRY_H
#define SNOW_SHOT_TRANSLATION_TRANSLATIONPROVIDERREGISTRY_H

#include "snow_shot/translation/translationprovider.h"

#include <QVector>

namespace snow_shot::translation {

// Sources offered in the picker, ordered for display. The built-in cloud source is first.
[[nodiscard]] QVector<TranslationProviderInfo> availableTranslationProviders();

// Human-readable display name for a provider id (falls back to the id itself).
[[nodiscard]] QString translationProviderName(const QString& providerId);

// True when the id is the built-in cloud source (which keeps using the ApiClient chain).
[[nodiscard]] bool isBuiltInTranslationProvider(const QString& providerId);

// Builds an adapter for the given config. Returns nullptr for the built-in "snowshot"
// source or when the id is unknown. parent owns the returned adapter.
[[nodiscard]] TranslationProvider*
createTranslationProvider(const TranslationProviderConfig& config, QObject* parent);

} // namespace snow_shot::translation
#endif // SNOW_SHOT_TRANSLATION_TRANSLATIONPROVIDERREGISTRY_H
