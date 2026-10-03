#include "snow_shot/presentation/screenshotqrcontroller.h"
#include "qrrecognitionfixture.h"
#include <QApplication>
#include <QElapsedTimer>
#include <QEventLoop>
#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonObject>
#include <QPainter>
#include <iostream>
#ifdef Q_OS_WIN
#include <windows.h>
#include <psapi.h>
#endif

int main(int argc, char** argv) {
    QApplication app(argc, argv);
    ScreenshotQrRecognitionService decoder;
    ScreenshotQrController controller(decoder, {});
    QJsonArray measurements;
    for (const auto size : {QSize(1920, 1080), QSize(3840, 2160), QSize(7680, 4320)}) {
        QImage source(size, QImage::Format_RGB32);
        source.fill(Qt::white);
        {
            QPainter painter(&source);
            const int side = size.height() / 3;
            painter.drawImage(
                QRect((size.width() - side) / 2, (size.height() - side) / 2, side, side),
                snow_shot::tests::qrFixture());
        }
        ScreenshotQrController::Snapshot snapshot;
        snapshot.bounds = QRectF(QPointF(), QSizeF(size));
        snapshot.pixelSize = size;
        snapshot.selection.addRect(snapshot.bounds);
        snapshot.layers.append({source, snapshot.bounds, snapshot.bounds});
        for (int iteration = 0; iteration < 4; ++iteration) {
            QEventLoop loop;
            QTimer timeout;
            timeout.setSingleShot(true);
            QObject::connect(&timeout, &QTimer::timeout, &loop, &QEventLoop::quit);
            bool done = false;
            const auto connection =
                QObject::connect(&controller, &ScreenshotQrController::stateChanged, &loop, [&] {
                    if (!controller.busy() && controller.available()) {
                        done = true;
                        loop.quit();
                    }
                });
            QElapsedTimer elapsed;
            elapsed.start();
            controller.recognize(snapshot);
            const double dispatchMs = double(elapsed.nsecsElapsed()) / 1e6;
            controller.synchronize(snapshot.selection, true, true);
            QTimer heartbeat;
            heartbeat.setTimerType(Qt::PreciseTimer);
            heartbeat.setInterval(5);
            qint64 lastTick = elapsed.nsecsElapsed();
            qint64 maxGap = 0;
            QObject::connect(&heartbeat, &QTimer::timeout, &loop, [&] {
                const qint64 now = elapsed.nsecsElapsed();
                maxGap = std::max(maxGap, now - lastTick);
                lastTick = now;
            });
            heartbeat.start();
            timeout.start(30000);
            loop.exec();
            const double totalMs = double(elapsed.nsecsElapsed()) / 1e6;
            QObject::disconnect(connection);
            if (!done) {
                std::cerr << "QR benchmark failed or timed out\n";
                return 1;
            }
            double peakMiB = 0;
#ifdef Q_OS_WIN
            PROCESS_MEMORY_COUNTERS counters{};
            counters.cb = sizeof(counters);
            if (GetProcessMemoryInfo(GetCurrentProcess(), &counters, sizeof(counters)))
                peakMiB = double(counters.PeakWorkingSetSize) / (1024.0 * 1024.0);
#endif
            measurements.append(
                QJsonObject{{QStringLiteral("width"), size.width()},
                            {QStringLiteral("height"), size.height()},
                            {QStringLiteral("iteration"), iteration},
                            {QStringLiteral("dispatch_ms"), dispatchMs},
                            {QStringLiteral("total_ms"), totalMs},
                            {QStringLiteral("max_event_loop_gap_ms"), double(maxGap) / 1e6},
                            {QStringLiteral("process_peak_mib"), peakMiB}});
        }
    }
    std::cout << QJsonDocument(measurements).toJson().constData();
    return 0;
}
