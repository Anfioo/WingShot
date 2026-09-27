#include "snow_shot/app/updateconfirmationdialog.h"

#include <QAbstractButton>
#include <QCoreApplication>
#include <QMessageBox>

namespace snow_shot::app {
bool confirmRestartAndUpdate(QWidget* owner) {
    const auto translated = [](const char* source) {
        return QCoreApplication::translate("snow_shot::app::ApplicationController", source);
    };
    const QString title = translated(
        QT_TRANSLATE_NOOP("snow_shot::app::ApplicationController", "Restart and update"));

    QMessageBox dialog(QMessageBox::Question, title,
                       translated(QT_TRANSLATE_NOOP(
                           "snow_shot::app::ApplicationController",
                           "Snow Shot will close and restart to install the update. Continue?")),
                       QMessageBox::Yes | QMessageBox::Cancel, owner);
    dialog.setOption(QMessageBox::Option::DontUseNativeDialog);
    dialog.button(QMessageBox::Yes)->setText(title);
    dialog.button(QMessageBox::Cancel)
        ->setText(translated(QT_TRANSLATE_NOOP("snow_shot::app::ApplicationController", "Cancel")));
    dialog.setDefaultButton(QMessageBox::Cancel);
    return dialog.exec() == QMessageBox::Yes;
}
} // namespace snow_shot::app
