package com.aoindustrial.perspective.mapstudio.gateway.script;

import org.python.core.Py;
import org.python.core.PyList;
import org.python.core.PyObject;

/**
 * What {@code system.mapstudio.getMap} returns: the list of map item records
 * (story 1's contract, unchanged: iterate it, index it, {@code len()} it), which
 * also answers the attribute {@code readOnly}: None when the map can be saved on
 * this Gateway, else the reason in plain words (a newer schema, or this Gateway a
 * standby; epic 2 story 5), and the attribute {@code kindSetups}: the project's live kind
 * setup records {@code {kindId, setup, version, deleted}} (epic 2 story 9). Its Python
 * type is {@code list}.
 */
public final class MapList extends PyList {

    /** The attribute name scripts read. */
    public static final String READ_ONLY = "readOnly";
    /** The attribute that holds the kind setups (epic 2 story 9). */
    public static final String KIND_SETUPS = "kindSetups";

    private final String readOnly;
    private final PyObject kindSetups;

    /** {@code items} is an iterable Python object (the records); {@code readOnly} null when saving works. */
    public MapList(PyObject items, String readOnly) {
        this(items, readOnly, new PyList());
    }

    /** As above, with {@code kindSetups} the list of kind setup records. */
    public MapList(PyObject items, String readOnly, PyObject kindSetups) {
        super(items);
        this.readOnly = readOnly;
        this.kindSetups = kindSetups;
    }

    /** The read-only reason, or null. */
    public String readOnly() {
        return readOnly;
    }

    @Override
    public PyObject __findattr_ex__(String name) {
        if (READ_ONLY.equals(name)) {
            return readOnly == null ? Py.None : Py.newUnicode(readOnly);
        }
        if (KIND_SETUPS.equals(name)) {
            return kindSetups;
        }
        return super.__findattr_ex__(name);
    }
}
