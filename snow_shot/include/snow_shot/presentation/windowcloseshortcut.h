#pragma once

#include "snow_shot/presentation/windowshortcutmanager.h"
#include <QWidget>
#include <utility>

namespace snow_shot::presentation {
// Install once per surface: detached dialogs can reuse their window across presentations.
// Route through the owner's user-close action, which may differ from QWidget::close().
template <typename Close> void installWindowCloseShortcut(QWidget* window, Close close) {
#ifdef Q_OS_MACOS
    const auto name = QStringLiteral("snowShotWindowCloseShortcut");
    if (window->findChild<QObject*>(name, Qt::FindDirectChildrenOnly))
        return;
    auto* manager = new WindowShortcutManager(window);
    manager->setObjectName(name);
    manager->addScopeWindow(window);
    WindowShortcutManager::Binding binding;
    binding.id = name;
    for (const auto& sequence : QKeySequence::keyBindings(QKeySequence::Close)) {
        if (sequence.count() == 1)
            binding.keyCombinations.append(sequence[0]);
    }
    binding.priority = WindowShortcutManager::StandardPriority::WindowCommand;
    binding.canActivate = [window](const auto& context) {
        // Session shortcuts also reach owned dialogs/tool windows. Closing is
        // local to this surface, just like Qt::WindowShortcut.
        const auto* receiver = qobject_cast<QWidget*>(context.receiver);
        return receiver != nullptr && receiver->window() == window->window();
    };
    binding.activate = [close = std::move(close)](const auto&) mutable {
        close();
        return true;
    };
    static_cast<void>(manager->addBinding(window, std::move(binding)));
#else
    Q_UNUSED(window);
    Q_UNUSED(close);
#endif
}
} // namespace snow_shot::presentation
