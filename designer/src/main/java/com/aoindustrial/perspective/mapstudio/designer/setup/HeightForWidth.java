package com.aoindustrial.perspective.mapstudio.designer.setup;

/** A component whose height depends on the width it is given (wrapping text, chips, a field pair). */
interface HeightForWidth {
    int heightFor(int width);
}
