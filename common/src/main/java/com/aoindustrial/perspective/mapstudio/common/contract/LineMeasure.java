package com.aoindustrial.perspective.mapstudio.common.contract;

import java.util.List;

/**
 * Distances along a line, geodesic on WGS 84 (AD-19, epic 2 story 14): the same formulas as
 * Turf 7.4.0's {@code distance} (haversine), {@code length} and {@code along} with
 * {@code units: "meters"}, earth radius 6371008.8 m, so the Gateway's check and the
 * browser's geometry module ({@code web/typescript/geometry.ts}) agree. The test vectors are
 * shared ({@code LineMeasureTest} and {@code web/typescript/__tests__/geometry.test.ts}).
 * Pure; positions are {@code [longitude, latitude]} in degrees.
 */
public final class LineMeasure {

    /** Turf's earthRadius, in metres. */
    public static final double EARTH_RADIUS_M = 6371008.8;

    private LineMeasure() {
    }

    /** Haversine distance in metres between two positions (Turf {@code distance}). */
    public static double distanceM(double[] a, double[] b) {
        double dLat = radians(b[1] - a[1]);
        double dLon = radians(b[0] - a[0]);
        double lat1 = radians(a[1]);
        double lat2 = radians(b[1]);
        double h = Math.pow(Math.sin(dLat / 2), 2) + Math.pow(Math.sin(dLon / 2), 2) * Math.cos(lat1) * Math.cos(lat2);
        return 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)) * EARTH_RADIUS_M;
    }

    /** The line's length in metres, the sum of its segments (Turf {@code length}). */
    public static double lengthM(List<double[]> coords) {
        double total = 0;
        for (int i = 0; i + 1 < coords.size(); i++) {
            total += distanceM(coords.get(i), coords.get(i + 1));
        }
        return total;
    }

    /**
     * The position {@code distanceM} metres along the line from its first vertex (Turf
     * {@code along}): the last vertex when the distance is the length or more.
     */
    public static double[] pointAt(List<double[]> coords, double distanceM) {
        double travelled = 0;
        for (int i = 0; i < coords.size(); i++) {
            if (distanceM >= travelled && i == coords.size() - 1) {
                break;
            } else if (travelled >= distanceM) {
                double overshot = distanceM - travelled;
                if (overshot == 0) {
                    return coords.get(i).clone();
                }
                double direction = bearing(coords.get(i), coords.get(i - 1)) - 180;
                return destination(coords.get(i), overshot, direction);
            } else {
                travelled += distanceM(coords.get(i), coords.get(i + 1));
            }
        }
        return coords.get(coords.size() - 1).clone();
    }

    /** Initial bearing in degrees from {@code a} to {@code b} (Turf {@code bearing}). */
    static double bearing(double[] a, double[] b) {
        double lon1 = radians(a[0]);
        double lon2 = radians(b[0]);
        double lat1 = radians(a[1]);
        double lat2 = radians(b[1]);
        double x = Math.sin(lon2 - lon1) * Math.cos(lat2);
        double y = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);
        return degrees(Math.atan2(x, y));
    }

    /** The position {@code distanceM} metres from {@code origin} on {@code bearing} (Turf {@code destination}). */
    static double[] destination(double[] origin, double distanceM, double bearing) {
        double lon1 = radians(origin[0]);
        double lat1 = radians(origin[1]);
        double b = radians(bearing);
        double r = distanceM / EARTH_RADIUS_M;
        double lat2 = Math.asin(Math.sin(lat1) * Math.cos(r) + Math.cos(lat1) * Math.sin(r) * Math.cos(b));
        double lon2 = lon1 + Math.atan2(Math.sin(b) * Math.sin(r) * Math.cos(lat1),
            Math.cos(r) - Math.sin(lat1) * Math.sin(lat2));
        return new double[] {degrees(lon2), degrees(lat2)};
    }

    /** Turf's degreesToRadians: normalised by % 360 first. */
    private static double radians(double degrees) {
        return (degrees % 360) * Math.PI / 180;
    }

    /** Turf's radiansToDegrees: normalised by % 2 pi first. */
    private static double degrees(double radians) {
        return (radians % (2 * Math.PI)) * 180 / Math.PI;
    }
}
