#ifndef SNOW_SHOT_APP_UPDATECONFIRMATIONDIALOG_H
#define SNOW_SHOT_APP_UPDATECONFIRMATIONDIALOG_H

class QWidget;

namespace snow_shot::app {
[[nodiscard]] bool confirmRestartAndUpdate(QWidget* owner);
}

#endif // SNOW_SHOT_APP_UPDATECONFIRMATIONDIALOG_H
