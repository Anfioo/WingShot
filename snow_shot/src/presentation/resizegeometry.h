#ifndef SNOW_SHOT_PRESENTATION_RESIZEGEOMETRY_H
#define SNOW_SHOT_PRESENTATION_RESIZEGEOMETRY_H

#include <QRect>
#include <Qt>
#include <cstdlib>

namespace snow_shot::presentation::resize_geometry {
struct DragGeometry {
    QSize requestedSize;
    Qt::Edges edges;
};

// Use outer boundaries, not QRect's inclusive right/bottom coordinates. Keep
// the press-time anchor even after crossing, including while minimum-sized.
inline DragGeometry dragGeometry(const QRect& origin, Qt::Edges pressed, const QPoint& delta,
                                 Qt::Edges previous) {
    DragGeometry result{origin.size(), pressed};
    const auto axis = [&](Qt::Edge low, Qt::Edge high, int extent, int movement, int* size) {
        if (!pressed.testFlag(low) && !pressed.testFlag(high))
            return;
        const int distance = pressed.testFlag(low) ? movement - extent : movement + extent;
        result.edges &= ~(Qt::Edges(low) | high);
        result.edges |= distance < 0             ? low
                        : distance > 0           ? high
                        : previous.testFlag(low) ? low
                                                 : high;
        *size = std::abs(distance);
    };
    int width = origin.width();
    int height = origin.height();
    axis(Qt::LeftEdge, Qt::RightEdge, width, delta.x(), &width);
    axis(Qt::TopEdge, Qt::BottomEdge, height, delta.y(), &height);
    result.requestedSize = QSize(width, height);
    return result;
}

inline QRect anchoredRect(const QRect& origin, Qt::Edges pressed, Qt::Edges effective,
                          const QSize& size) {
    int x = origin.x();
    int y = origin.y();
    if (pressed.testFlag(Qt::LeftEdge))
        x += origin.width();
    if (pressed.testFlag(Qt::TopEdge))
        y += origin.height();
    if (effective.testFlag(Qt::LeftEdge))
        x -= size.width();
    if (effective.testFlag(Qt::TopEdge))
        y -= size.height();
    return QRect(QPoint(x, y), size);
}
} // namespace snow_shot::presentation::resize_geometry

#endif
