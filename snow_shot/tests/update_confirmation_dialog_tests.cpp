#include "snow_shot/app/updateconfirmationdialog.h"

#include <QAbstractButton>
#include <QApplication>
#include <QCoreApplication>
#include <QMessageBox>
#include <QPushButton>
#include <QTimer>
#include <QTranslator>

#include <iostream>
#include <stdexcept>

namespace {
void require(bool condition, const char* message) {
    if (!condition)
        throw std::runtime_error(message);
}

void confirmationFollowsSelectedLanguage() {
    struct Case {
        const char* locale;
        const char* confirm;
        const char* cancel;
    };
    for (const Case& test :
         {Case{"en_US", "Restart and update", "Cancel"}, Case{"zh_CN", "重启并更新", "取消"},
          Case{"zh_TW", "重新啟動並更新", "取消"}}) {
        QTranslator translator;
        require(translator.load(
                    QStringLiteral(":/i18n/snow_shot_%1.qm").arg(QString::fromLatin1(test.locale))),
                "update confirmation catalog did not load");
        QCoreApplication::installTranslator(&translator);
        for (const auto answer : {QMessageBox::Cancel, QMessageBox::Yes}) {
            bool inspected = false;
            bool labelsMatch = false;
            QTimer::singleShot(0, qApp, [&] {
                for (QWidget* widget : QApplication::topLevelWidgets()) {
                    auto* dialog = qobject_cast<QMessageBox*>(widget);
                    if (dialog == nullptr || !dialog->isVisible())
                        continue;
                    inspected = true;
                    labelsMatch = dialog->testOption(QMessageBox::Option::DontUseNativeDialog) &&
                                  dialog->button(QMessageBox::Yes)->text() ==
                                      QString::fromUtf8(test.confirm) &&
                                  dialog->button(QMessageBox::Cancel)->text() ==
                                      QString::fromUtf8(test.cancel) &&
                                  dialog->defaultButton() == dialog->button(QMessageBox::Cancel);
                    dialog->button(answer)->click();
                    return;
                }
            });
            const bool accepted = snow_shot::app::confirmRestartAndUpdate(nullptr);
            require(inspected && labelsMatch, "update buttons must use the selected app language");
            require(accepted == (answer == QMessageBox::Yes),
                    "localized update confirmation must retain its choice semantics");
        }
        QCoreApplication::removeTranslator(&translator);
    }
}
} // namespace

int main(int argc, char** argv) {
    QApplication application(argc, argv);
    try {
        confirmationFollowsSelectedLanguage();
    } catch (const std::exception& error) {
        std::cerr << error.what() << '\n';
        return 1;
    }
    return 0;
}
