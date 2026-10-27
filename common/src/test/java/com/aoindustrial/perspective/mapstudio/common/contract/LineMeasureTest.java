package com.aoindustrial.perspective.mapstudio.common.contract;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.Test;

import com.inductiveautomation.ignition.common.gson.JsonArray;
import com.inductiveautomation.ignition.common.gson.JsonElement;
import com.inductiveautomation.ignition.common.gson.JsonObject;
import com.inductiveautomation.ignition.common.gson.JsonParser;

/**
 * Distances along a line agree with Turf 7.4.0 (epic 2 story 14): the vectors in
 * line-measure-vectors.json were made by Turf itself and are read by
 * web/typescript/__tests__/geometry.test.ts as well.
 */
class LineMeasureTest {

    /** Well below the 0.1 m stored precision and the 1 m tolerance: the same formulas, at most a few ulps apart. */
    static final double METRES = 1e-6;
    static final double DEGREES = 1e-11;

    static JsonObject vectors() throws IOException {
        try (InputStream in = LineMeasureTest.class.getResourceAsStream("line-measure-vectors.json")) {
            return JsonParser.parseString(new String(in.readAllBytes(), StandardCharsets.UTF_8)).getAsJsonObject();
        }
    }

    static List<double[]> coords(JsonArray a) {
        List<double[]> out = new ArrayList<>();
        for (JsonElement p : a) {
            out.add(new double[] {p.getAsJsonArray().get(0).getAsDouble(), p.getAsJsonArray().get(1).getAsDouble()});
        }
        return out;
    }

    @Test
    void lengthsSegmentsAndPointsAlongMatchTurf() throws IOException {
        JsonArray lines = vectors().getAsJsonArray("lines");
        assertEquals(7, lines.size());
        int points = 0;
        for (JsonElement l : lines) {
            JsonObject line = l.getAsJsonObject();
            String name = line.get("name").getAsString();
            List<double[]> c = coords(line.getAsJsonArray("coordinates"));
            assertEquals(line.get("lengthM").getAsDouble(), LineMeasure.lengthM(c), METRES, name);
            JsonArray segments = line.getAsJsonArray("segmentsM");
            for (int i = 0; i < segments.size(); i++) {
                assertEquals(segments.get(i).getAsDouble(), LineMeasure.distanceM(c.get(i), c.get(i + 1)), METRES, name);
            }
            for (JsonElement a : line.getAsJsonArray("along")) {
                JsonObject v = a.getAsJsonObject();
                double d = v.get("distanceM").getAsDouble();
                JsonArray expected = v.getAsJsonArray("point");
                double[] got = LineMeasure.pointAt(c, d);
                assertEquals(expected.get(0).getAsDouble(), got[0], DEGREES, name + " at " + d);
                assertEquals(expected.get(1).getAsDouble(), got[1], DEGREES, name + " at " + d);
                points++;
            }
        }
        assertTrue(points >= 50, "every vector ran: " + points);
    }

    static List<double[]> line(String name) throws IOException {
        for (JsonElement l : vectors().getAsJsonArray("lines")) {
            if (l.getAsJsonObject().get("name").getAsString().equals(name)) {
                return coords(l.getAsJsonObject().getAsJsonArray("coordinates"));
            }
        }
        throw new AssertionError("no vector line " + name);
    }

    /** The degenerate lines of the vectors, by name (review finding of lens quick, epic 2 story 14). */
    @Test
    void aRingARepeatedVertexAndAZeroLengthLineMeasureAsTurfDoes() throws IOException {
        List<double[]> ring = line("closed-ring");
        double[] start = LineMeasure.pointAt(ring, 0);
        double[] end = LineMeasure.pointAt(ring, LineMeasure.lengthM(ring));
        assertEquals(0, LineMeasure.distanceM(start, ring.get(0)), METRES, "a ring starts at its first vertex");
        assertEquals(0, LineMeasure.distanceM(end, ring.get(0)), METRES, "and ends there");
        List<double[]> repeated = line("repeated-vertex");
        assertEquals(LineMeasure.lengthM(line("L-SWD")), LineMeasure.lengthM(repeated), METRES,
            "a repeated vertex adds nothing");
        double first = LineMeasure.distanceM(repeated.get(0), repeated.get(1));
        assertEquals(0, LineMeasure.distanceM(LineMeasure.pointAt(repeated, first), repeated.get(1)), METRES);
        List<double[]> zero = line("zero-length");
        assertEquals(0, LineMeasure.lengthM(zero));
        for (double d : new double[] {0, 1, 10}) {
            double[] p = LineMeasure.pointAt(zero, d);
            assertEquals(zero.get(0)[0], p[0], DEGREES);
            assertEquals(zero.get(0)[1], p[1], DEGREES);
        }
    }

    @Test
    void theLineOfTheIoMatrixIs2922MetresLong() throws IOException {
        JsonObject swd = vectors().getAsJsonArray("lines").get(0).getAsJsonObject();
        assertEquals("L-SWD", swd.get("name").getAsString());
        double length = LineMeasure.lengthM(coords(swd.getAsJsonArray("coordinates")));
        assertEquals(2922.35, length, 0.01);
        assertEquals(6371008.8, LineMeasure.EARTH_RADIUS_M);
    }
}
