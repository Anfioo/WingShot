#pragma once

#include "snow_shot/shortcuts/shortcutbinding.h"
#include <QKeyEvent>

// Simulate hardware input explicitly. Production dispatch does not infer a
// physical position from a synthetic event's logical character.
class PhysicalKeyEvent : public QKeyEvent {
  public:
    using QKeyEvent::QKeyEvent;
  PhysicalKeyEvent(QEvent::Type type, int key, Qt::KeyboardModifiers modifiers,
                   const QString& text = {}, bool repeat = false, ushort count = 1)
#ifdef Q_OS_MACOS
      : QKeyEvent(type, key, modifiers, 1, nativeKey(key, modifiers), 0, text, repeat, count){}
#else
        : QKeyEvent(type, key, modifiers, text, repeat, count) {
    }
#endif

        private : static quint32 nativeKey(int key, Qt::KeyboardModifiers modifiers) {
        switch (key) {
        case Qt::Key_Shift:
            return 56;
        case Qt::Key_Control:
            return 55;
        case Qt::Key_Meta:
            return 59;
        case Qt::Key_Alt:
            return 58;
        default:
            break;
        }
        const auto binding = snow_shot::shortcuts::bindingFromPortableText(
            QKeySequence(QKeyCombination(modifiers, static_cast<Qt::Key>(key)))
                .toString(QKeySequence::PortableText));
        return snow_shot::shortcuts::macVirtualKeyForBinding(binding).value_or(128);
    }
};
