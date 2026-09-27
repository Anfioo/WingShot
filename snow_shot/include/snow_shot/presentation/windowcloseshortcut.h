#pragma once

#include <QShortcut>
#include <QWidget>
#include <utility>

namespace snow_shot::presentation {
// Install once per surface: detached dialogs can reuse their window across presentations.
// Route through the owner's user-close action, which may differ from QWidget::close().
template <typename Close> void installWindowCloseShortcut(QWidget* window, Close close) {
#ifdef Q_OS_MACOS
    const auto name = QStringLiteral("snowShotWindowCloseShortcut");
    if (window->findChild<QShortcut*>(name, Qt::FindDirectChildrenOnly))
        return;
    auto* shortcut = new QShortcut(QKeySequence::Close, window);
    shortcut->setObjectName(name);
    shortcut->setContext(Qt::WindowShortcut);
    shortcut->setAutoRepeat(false);
    QObject::connect(shortcut, &QShortcut::activated, window, std::move(close));
#else
    Q_UNUSED(window);
    Q_UNUSED(close);
#endif
}
} // namespace snow_shot::presentation
