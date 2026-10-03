#include "snow_shot/presentation/screenshotqrrecognitionservice.h"
#include "qrrecognitionfixture.h"

#include <QCoreApplication>
#include <QDir>
#include <QEventLoop>
#include <QFile>
#include <QImage>
#include <QPainter>
#include <QLineF>
#include <QTemporaryDir>
#include <QTimer>
#include <QThread>

#include <array>
#include <cstdlib>
#include <cstring>
#include <iostream>
#include <memory>
#include <string>
#include <string_view>
#include <utility>

namespace {
using snow_shot::tests::qrFixture;
constexpr auto kPayload = "https://snowshot.example/qr-test";
constexpr auto kEanPayload = "4006381333931";

void require(bool condition, const char* message) {
    if (!condition) {
        std::cerr << message << '\n';
        std::exit(EXIT_FAILURE);
    }
}

QImage largeQrFixture() {
    constexpr QSize kLargeScreenshotSize(7680, 4320);
    QImage image(kLargeScreenshotSize, QImage::Format_Grayscale8);
    image.fill(255);

    const QImage enlargedQr =
        qrFixture().scaled(1480, 1480, Qt::IgnoreAspectRatio, Qt::FastTransformation);
    const QPoint destination((image.width() - enlargedQr.width()) / 2,
                             (image.height() - enlargedQr.height()) / 2);
    for (int row = 0; row < enlargedQr.height(); ++row) {
        std::memcpy(image.scanLine(destination.y() + row) + destination.x(),
                    enlargedQr.constScanLine(row), static_cast<std::size_t>(enlargedQr.width()));
    }
    return image;
}

QImage eanFixture() {
    // EAN-13 4006381333931 rendered from the standard GS1 tables: guards, an
    // L/G-coded left half whose parity is selected by the leading digit, and
    // a complement-coded right half. 95 modules in total.
    static constexpr std::string_view kLeftCodes[10] = {
        "0001101", "0011001", "0010011", "0111101", "0100011",
        "0110001", "0101111", "0111011", "0110111", "0001011",
    };
    static constexpr std::string_view kRightCodes[10] = {
        "1110010", "1100110", "1101100", "1000010", "1011100",
        "1001110", "1010000", "1000100", "1001000", "1110100",
    };
    static constexpr std::string_view kParityPatterns[10] = {
        "LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG",
        "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL",
    };
    constexpr int kModulePixels = 10;
    constexpr int kQuietZoneModules = 10;
    constexpr int kBarHeightPixels = 300;
    constexpr std::string_view kDigits = "4006381333931";

    std::string modules = "101";
    const std::string_view parity = kParityPatterns[kDigits[0] - '0'];
    for (std::size_t index = 1; index <= 6; ++index) {
        const std::string_view code = kLeftCodes[kDigits[index] - '0'];
        if (parity[index - 1] == 'L') {
            modules.append(code.begin(), code.end());
        } else {
            // The G code for a digit is the reverse of its right-half code.
            const std::string_view mirrored = kRightCodes[kDigits[index] - '0'];
            modules.append(mirrored.rbegin(), mirrored.rend());
        }
    }
    modules += "01010";
    for (std::size_t index = 7; index <= 12; ++index) {
        modules.append(kRightCodes[kDigits[index] - '0'].begin(),
                       kRightCodes[kDigits[index] - '0'].end());
    }
    modules += "101";

    QImage image((kQuietZoneModules * 2 + static_cast<int>(modules.size())) * kModulePixels,
                 kBarHeightPixels, QImage::Format_Grayscale8);
    image.fill(255);
    for (std::size_t module = 0; module < modules.size(); ++module) {
        if (modules[module] != '1') {
            continue;
        }
        const int pixelX = static_cast<int>(module + kQuietZoneModules) * kModulePixels;
        for (int y = 0; y < kBarHeightPixels; ++y) {
            std::memset(image.scanLine(y) + pixelX, 0, static_cast<std::size_t>(kModulePixels));
        }
    }
    return image;
}

ScreenshotQrRecognitionResult
recognize(ScreenshotQrRecognitionService& service, const QImage& image, const char* timeoutMessage,
          ScreenshotQrRecognitionMode mode = ScreenshotQrRecognitionMode::QrAndBarcode) {
    require(service.findChildren<QThread*>().isEmpty(),
            "QR service should not create a worker thread before recognition is requested");
    QEventLoop loop;
    ScreenshotQrRecognitionResult output;
    bool completed = false;
    bool timedOut = false;
    QTimer timeout;
    timeout.setSingleShot(true);
    QObject::connect(&timeout, &QTimer::timeout, &loop, [&]() {
        timedOut = true;
        loop.quit();
    });

    const ScreenshotQrRecognitionPort::RequestToken token = service.recognize(
        image, &loop,
        [&](ScreenshotQrRecognitionResult result) {
            output = std::move(result);
            completed = true;
            require(service.findChildren<QThread*>().isEmpty(),
                    "QR worker thread should be destroyed before completion delivery");
            loop.quit();
        },
        mode);
    require(token != 0, "a valid QR image should schedule recognition");
    require(service.findChildren<QThread*>().size() == 1,
            "QR recognition should create one worker thread on demand");
    timeout.start(10000);
    loop.exec();

    require(!timedOut && completed, timeoutMessage);
    return output;
}

void defaultDetectorDecodesTheSelectedImage() {
    ScreenshotQrRecognitionService service;
    const ScreenshotQrRecognitionResult output =
        recognize(service, qrFixture(), "QR recognition should complete within the test timeout");
    require(output.error.isEmpty(), "the default QR detector should not report an error");
    require(output.detections.size() == 1 && output.detections[0].corners.size() == 4 &&
                output.detections[0].text == QString::fromLatin1(kPayload),
            "QR decoder retains text and quadrilateral");
    require(
        QLineF(output.detections[0].corners.boundingRect().center(), QPointF(185, 185)).length() <
            8,
        "QR geometry uses original image pixel coordinates");
    require(output.contents == QStringList{QString::fromLatin1(kPayload)},
            "the default QR detector should decode the embedded payload");
}

void oversizedScreenshotIsBoundedAndStillDecoded() {
    ScreenshotQrRecognitionService service;
    const ScreenshotQrRecognitionResult output = recognize(
        service, largeQrFixture(), "large QR recognition should complete within the test timeout");
    require(output.error.isEmpty(), "large QR recognition should not report an error");
    require(output.detections.size() == 1 &&
                QLineF(output.detections[0].corners.boundingRect().center(), QPointF(3840, 2160))
                        .length() < 30,
            "downsampled QR geometry maps back to the original screenshot");
    require(output.contents == QStringList{QString::fromLatin1(kPayload)},
            "the QR detector should decode a QR code from an oversized screenshot");
}

void oneDimensionalBarcodeDecodesTheSelectedImage() {
    ScreenshotQrRecognitionService service;
    const ScreenshotQrRecognitionResult output =
        recognize(service, eanFixture(), "EAN recognition should complete within the test timeout");
    require(output.error.isEmpty(), "EAN recognition should not report an error");
    require(output.contents == QStringList{QString::fromLatin1(kEanPayload)},
            "the detector should decode the embedded EAN-13 payload");
}

void qrOnlySkipsBarcodesAndRetainsMultipleLocations() {
    ScreenshotQrRecognitionService service;
    const auto barcode = recognize(service, eanFixture(), "QR-only EAN test timed out",
                                   ScreenshotQrRecognitionMode::QrOnly);
    require(barcode.contents.isEmpty() && barcode.detections.isEmpty() && barcode.error.isEmpty(),
            "automatic mode must not fall back to 1D decoding");
    QImage image(1000, 600, QImage::Format_RGB32);
    image.fill(Qt::white);
    {
        QPainter painter(&image);
        painter.drawImage(QPoint(40, 80), qrFixture());
        painter.drawImage(QPoint(570, 120), qrFixture().transformed(QTransform().rotate(90)));
    }
    const auto output = recognize(service, image, "multiple QR test timed out",
                                  ScreenshotQrRecognitionMode::QrOnly);
    require(output.detections.size() == 2,
            "identical payloads in separate codes retain two geometries");
    require(output.detections[0].text == output.detections[1].text &&
                QLineF(output.detections[0].corners.boundingRect().center(),
                       output.detections[1].corners.boundingRect().center())
                        .length() > 400,
            "separate rotated QR instances must not be deduplicated by payload");
}

void unicodeModelsDirectoryStillLoadsAndDecodes() {
    // Non-ASCII install directories used to break the WeChat model loading
    // because OpenCV resolved the paths through narrow-character APIs; the
    // service now reads the files itself and constructs the detector from
    // memory.
    const QDir stagedModels(
        QDir(QCoreApplication::applicationDirPath()).filePath(QStringLiteral("assets/qrcode")));
    QTemporaryDir unicodeDirectory(QDir::tempPath() + QStringLiteral("/snow 二维码模型-XXXXXX"));
    require(unicodeDirectory.isValid(), "a unicode temporary directory must be available");
    const QStringList modelNames = {QStringLiteral("detect.prototxt"),
                                    QStringLiteral("detect.caffemodel"),
                                    QStringLiteral("sr.prototxt"), QStringLiteral("sr.caffemodel")};
    for (const QString& name : modelNames) {
        const QString stagedPath = stagedModels.filePath(name);
        const QString unicodePath = QDir(unicodeDirectory.path()).filePath(name);
        require(QFile::copy(stagedPath, unicodePath),
                "the WeChat QR models should be staged into the unicode directory");
    }

    ScreenshotQrRecognitionService service(nullptr, unicodeDirectory.path());
    const ScreenshotQrRecognitionResult output =
        recognize(service, qrFixture(),
                  "unicode-directory QR recognition should complete within the test timeout");
    require(output.error.isEmpty(), "the WeChat QR models should load from a unicode directory");
    require(output.contents == QStringList{QString::fromLatin1(kPayload)},
            "the QR detector should decode with models loaded from a unicode directory");
}

void queuedRequestsReuseNoPersistentWorker() {
    ScreenshotQrRecognitionService service;
    QObject receiver;
    QEventLoop loop;
    QTimer timeout;
    timeout.setSingleShot(true);
    int completions = 0;
    bool timedOut = false;
    QObject::connect(&timeout, &QTimer::timeout, &loop, [&]() {
        timedOut = true;
        loop.quit();
    });

    const QImage image = qrFixture();
    const auto completion = [&](ScreenshotQrRecognitionResult result) {
        require(result.error.isEmpty() &&
                    result.contents == QStringList{QString::fromLatin1(kPayload)},
                "queued QR requests should decode successfully");
        ++completions;
        if (completions == 2) {
            require(service.findChildren<QThread*>().isEmpty(),
                    "the final queued QR request should leave no worker thread");
            loop.quit();
        }
    };

    const auto firstToken = service.recognize(image, &receiver, completion);
    const auto secondToken = service.recognize(image, &receiver, completion);
    require(firstToken != 0 && secondToken != 0, "queued QR requests should both be accepted");
    require(service.findChildren<QThread*>().size() == 1,
            "queued QR requests should share one active worker at a time");

    timeout.start(10'000);
    loop.exec();
    require(!timedOut && completions == 2,
            "queued QR requests should both complete within the test timeout");
}

void destroyingReceiverCancelsQueuedCompletion() {
    ScreenshotQrRecognitionService service;
    bool completed = false;
    auto receiver = std::make_unique<QObject>();
    const ScreenshotQrRecognitionPort::RequestToken token = service.recognize(
        qrFixture(), receiver.get(), [&](ScreenshotQrRecognitionResult) { completed = true; });
    require(token != 0, "a cancellable QR request should be accepted");

    receiver.reset();
    QEventLoop loop;
    QTimer::singleShot(250, &loop, &QEventLoop::quit);
    loop.exec();
    require(!completed, "destroying the receiver must cancel QR result delivery");
    require(service.findChildren<QThread*>().isEmpty(),
            "canceled QR recognition should destroy its worker thread");
}
} // namespace

int main(int argc, char** argv) {
    QCoreApplication application(argc, argv);
    defaultDetectorDecodesTheSelectedImage();
    oneDimensionalBarcodeDecodesTheSelectedImage();
    qrOnlySkipsBarcodesAndRetainsMultipleLocations();
    oversizedScreenshotIsBoundedAndStillDecoded();
    unicodeModelsDirectoryStillLoadsAndDecodes();
    queuedRequestsReuseNoPersistentWorker();
    destroyingReceiverCancelsQueuedCompletion();
    return 0;
}
