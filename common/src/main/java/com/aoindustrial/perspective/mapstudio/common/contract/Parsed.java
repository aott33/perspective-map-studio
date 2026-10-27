package com.aoindustrial.perspective.mapstudio.common.contract;

import java.util.List;

/**
 * The result of reading a kind or asset list: the rows kept, one plain reason
 * per row left out, and how many rows the function returned.
 */
public record Parsed<T>(List<T> kept, List<String> reasons, int total) {

    public int left() {
        return reasons.size();
    }

    /** The first {@code n} reasons joined with "; ". */
    public String firstReasons(int n) {
        return Rows.joinFirst(reasons, n);
    }
}
