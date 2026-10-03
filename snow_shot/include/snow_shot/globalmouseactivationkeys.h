#ifndef SNOW_SHOT_GLOBALMOUSEACTIVATIONKEYS_H
#define SNOW_SHOT_GLOBALMOUSEACTIVATIONKEYS_H

#include <QStringList>

namespace snow_shot {
inline QStringList globalMouseActivationKeys() {
#ifdef Q_OS_MACOS
    return {QStringLiteral("command"), QStringLiteral("control"), QStringLiteral("option"),
            QStringLiteral("shift")};
#else
    return {QStringLiteral("windows"), QStringLiteral("ctrl"), QStringLiteral("alt"),
            QStringLiteral("shift")};
#endif
}
} // namespace snow_shot

#endif
