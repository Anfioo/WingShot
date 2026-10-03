#pragma once

#include <QImage>
#include <array>
#include <cstring>

namespace snow_shot::tests {
inline constexpr std::array<const char*, 29> kQrModules{
    "11111110001101001111001111111", "10000010110000111111001000001",
    "10111010010011101010101011101", "10111010001111110011101011101",
    "10111010110010100011001011101", "10000010011101000111101000001",
    "11111110101010101010101111111", "00000000010011101111100000000",
    "10101010000000110111100010010", "10101101100100110000101001001",
    "11101110001101000100001100111", "11101100110100010111001000010",
    "10101011001010001100111101011", "01011001111101011110111001001",
    "11110011010100111010100101011", "11000101100001101111010011010",
    "11110010010110111101011001011", "00110100100100110110111001101",
    "10000110101011001110010000011", "01010100001100011101101011010",
    "10100011101000000110111110000", "00000000100011001001100010111",
    "11111110010110100001101011011", "10000010001011100110100011010",
    "10111010100000100100111110001", "10111010011010101111100110111",
    "10111010111000100001010111001", "10000010011101011101100010010",
    "11111110100011101100101011011",
};

inline QImage qrFixture() {
    constexpr int kQuietZoneModules = 4;
    constexpr int kModulePixels = 10;
    constexpr int kModuleCount = static_cast<int>(kQrModules.size());
    constexpr int kImageModules = kModuleCount + kQuietZoneModules * 2;
    QImage image(kImageModules * kModulePixels, kImageModules * kModulePixels,
                 QImage::Format_Grayscale8);
    image.fill(255);
    for (int moduleY = 0; moduleY < kModuleCount; ++moduleY) {
        for (int moduleX = 0; moduleX < kModuleCount; ++moduleX) {
            if (kQrModules.at(static_cast<std::size_t>(moduleY))[moduleX] != '1') {
                continue;
            }
            const int pixelX = (moduleX + kQuietZoneModules) * kModulePixels;
            const int pixelY = (moduleY + kQuietZoneModules) * kModulePixels;
            for (int y = 0; y < kModulePixels; ++y) {
                std::memset(image.scanLine(pixelY + y) + pixelX, 0,
                            static_cast<std::size_t>(kModulePixels));
            }
        }
    }
    return image;
}

} // namespace snow_shot::tests
