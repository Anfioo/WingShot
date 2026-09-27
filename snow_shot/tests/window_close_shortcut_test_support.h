#pragma once

#include <QApplication>
#include <QShortcut>
#include <QKeyEvent>
#include <QPointer>
#include <QWidget>

inline bool triggerWindowCloseShortcut(QWidget* window, QWidget* focus = nullptr) {
    const auto shortcuts = window->findChildren<QShortcut*>(
        QStringLiteral("snowShotWindowCloseShortcut"), Qt::FindDirectChildrenOnly);
    if (shortcuts.size() != 1)
        return false;
    auto* shortcut = shortcuts.front();
    if (shortcut->keys() != QKeySequence::keyBindings(QKeySequence::Close) ||
        shortcut->context() != Qt::WindowShortcut || shortcut->autoRepeat())
        return false;
    window->activateWindow();
    QApplication::processEvents();
    if (!focus)
        focus = window;
    focus->setFocus();
    const auto key = shortcut->keys().front()[0];
    QPointer<QWidget> target = focus;
    QKeyEvent press(QEvent::KeyPress, key.key(), key.keyboardModifiers());
    QApplication::sendEvent(target, &press);
    if (target) {
        QKeyEvent release(QEvent::KeyRelease, key.key(), key.keyboardModifiers());
        QApplication::sendEvent(target, &release);
    }
    return true;
}
