/*global QUnit, ArrayBuffer, Uint8Array, bitratchet, module:true, ok, same, test, raises*/
/*jslint sloppy: true*/

// Work around module clash if we're using node.js
if (QUnit.module) {
    module = QUnit.module;
}

// Convert array / ArrayBuffer view to string for comparison in tests
function a_to_s(a) {
    var i, result = '';
    // If it's an array buffer put a view on it
    if (!a.length) {
        a = new Uint8Array(a);
    }
    // Iterate through converting to hex
    for (i = 0; i < a.length; i += 1) {
        result += '0x';
        if (a[i] < 0x10) {
            result += '0';
        }
        result += a[i].toString(16) + ', ';
    }
    return '[' + result.substr(0, result.length - 2) + ']';
}

function init_buffer() {
    var data = arguments,
        buffer = new ArrayBuffer(data.length),
        view = new Uint8Array(buffer),
        i;
    for (i = 0; i < data.length; i += 1) {
        view[i] = data[i];
    }
    return buffer;
}

module("Misc");

test("Version", function () {
    ok(bitratchet.version);
    same(bitratchet.version.toString(), bitratchet.version.major + "." + bitratchet.version.minor + "." + bitratchet.version.patch);
});

module("Number");

test("Unsigned", function () {
    // Init our data to read
    var data = init_buffer(0xff, 0x02, 0x16, 0xff);
    // Test parsing
    same(bitratchet.number({ length : 8 }).parse(data), 0xff);
    same(bitratchet.number({ length : 4 }).parse(data), 0xf);
    same(bitratchet.number({ length : 3 }).parse(data), 0x7);
    same(bitratchet.number({ length : 2 }).parse(data), 0x3);
    same(bitratchet.number({ length : 1 }).parse(data), 0x1);
    same(bitratchet.number({ length : 8 * 4 }).parse(data), 0xff0216ff);

    // Test unparsing
    same(a_to_s(bitratchet.number({ length : 8}).unparse(0xdb)), "[0xdb]");
    same(a_to_s(bitratchet.number({ length : 7}).unparse(0xdb)), "[0x5b]");
    same(a_to_s(bitratchet.number({ length : 6}).unparse(0xdb)), "[0x1b]");
    same(a_to_s(bitratchet.number({ length : 5}).unparse(0xdb)), "[0x1b]");
    same(a_to_s(bitratchet.number({ length : 4}).unparse(0xdb)), "[0x0b]");
    same(a_to_s(bitratchet.number({ length : 3}).unparse(0xdb)), "[0x03]");
    same(a_to_s(bitratchet.number({ length : 2}).unparse(0xdb)), "[0x03]");
    same(a_to_s(bitratchet.number({ length : 1}).unparse(0xdb)), "[0x01]");
    same(a_to_s(bitratchet.number({ length : 8 * 4 }).unparse(0xff0216ff)), "[0xff, 0x02, 0x16, 0xff]");
});

test("Signed", function () {
    // Init our data to read
    var data = init_buffer(0xff, 0x02, 0x16, 0xff);
    // Test parsing
    same(bitratchet.number({ length : 8, signed : true }).parse(data), -0x01);
    same(bitratchet.number({ length : 4, signed : true }).parse(data), -0x01);
    same(bitratchet.number({ length : 3, signed : true }).parse(data), -0x01);
    same(bitratchet.number({ length : 2, signed : true }).parse(data), -0x01);
    same(bitratchet.number({ length : 8 * 4, signed : true }).parse(data), -16640257);
    // Test unparsing
    same(a_to_s(bitratchet.number({ length : 8, signed : true }).unparse(-0x01)), "[0xff]");
    same(a_to_s(bitratchet.number({ length : 7, signed : true }).unparse(-0x01)), "[0x7f]");
    same(a_to_s(bitratchet.number({ length : 6, signed : true }).unparse(-0x01)), "[0x3f]");
    same(a_to_s(bitratchet.number({ length : 5, signed : true }).unparse(-0x01)), "[0x1f]");
    same(a_to_s(bitratchet.number({ length : 4, signed : true }).unparse(-0x01)), "[0x0f]");
    same(a_to_s(bitratchet.number({ length : 3, signed : true }).unparse(-0x01)), "[0x07]");
    same(a_to_s(bitratchet.number({ length : 2, signed : true }).unparse(-0x01)), "[0x03]");
    same(a_to_s(bitratchet.number({ length : 8 * 4, signed : true }).unparse(-16640257)), a_to_s(data));
    // Test length
    same(bitratchet.number({ length : 8, signed : true }).length, 8);
    same(bitratchet.number({ length : 7 }).length, 7);
});

test("Scaling", function () {
    // Init our data to read
    var scaled_signed, data = init_buffer(0xff, 0x02, 0x16, 0xff);
    // Scale range
    same(bitratchet.number({ length : 8 * 4, scale_range : 360 }).parse(data), 358.6052297707647);
    // Precision
    same(bitratchet.number({ length : 8 * 4, precision: 4,
                             scale_range : 360 }).parse(data), 358.6052);
    // Custom scaling
    same(bitratchet.number({ length : 8 * 4, custom_scale : 0.01 }).parse(data), 42783270.39);
    // Scaled signed
    scaled_signed = bitratchet.number({ length : 8 * 4, scale_range : 360, signed : true, precision : 8});
    same(scaled_signed.parse(init_buffer(0xfe, 0x28, 0xa6, 0xb9)), -2.58919596);
    same(a_to_s(scaled_signed.unparse(-2.58919596)), a_to_s([0xfe, 0x28, 0xa6, 0xb9]));
});

test("Large numbers", function () {
    var data = init_buffer(0xff, 0xff, 0xff, 0xff, 0xff, 0xff);
    same(bitratchet.number({ length : 8 * 6 }).parse(data), 281474976710655);
    same(bitratchet.number({ length : 8 * 6, signed : true }).parse(data), -1);
    same(a_to_s(bitratchet.number({ length : 8 * 6 }).unparse(281474976710655)), a_to_s(data));
    same(a_to_s(bitratchet.number({ length : 8 * 6, signed : true }).unparse(-1)), a_to_s(data));
});

module("String");

test("Validation", function () {
    var string;
    // Length must be divisible by 8 if present
    raises(
        function () {
            bitratchet.string({ length : 5 });
        },
        function (err) {
            return err === "Invalid length, must be divisible by 8.";
        }
    );
    // Terminator option or length option must be present
    raises(
        function () {
            bitratchet.string({ });
        },
        function (err) {
            return err === "String needs either a length, terminating character or to be a pascal string.";
        }
    );
    // If read_full_length is true terminator and length must be present
    raises(
        function () {
            bitratchet.string({ length : 8, read_full_length : true });
        },
        function (err) {
            return err === "read_full_length option required both length and terminator options.";
        }
    );
    // If length isn't provided terminator must be found
    raises(
        function () {
            string = bitratchet.string({ terminator : "\u0000" });
            string.parse(init_buffer(0x61, 0x62));
        },
        function (err) {
            return err === "Unterminated string, provide a length.";
        }
    );
    // Pascal strings aren't compatible with other types
    raises(
        function () {
            bitratchet.string({ pascal : true, length : 8 });
            bitratchet.string({ pascal : true, terminator : 0x00 });
            bitratchet.string({ pascal : true, read_full_length : true, length : 8, terminator : 0x00 });
        },
        function (err) {
            return err === "Pascal strings don't support the other options.";
        }
    );
});

test("Basic", function () {
    var string,
        data = init_buffer(0x61, 0x62, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6a, 0x00, 0x6b, 0x6c);

    // Test strings with a fixed length
    string = bitratchet.string({ length : 8 * 5 });
    same(string.parse(data), "abcde");
    same(string.length, 8 * 5);
    same(a_to_s(string.unparse("abcde")), a_to_s([0x61, 0x62, 0x63, 0x64, 0x65]));
    same(string.length, 8 * 5);
    // Test strings with terminating character and dynamic length
    string = bitratchet.string({ terminator : 0x00 });
    same(string.parse(data), { data : "abcdefghij", length : 8 * "abcdefghij\u0000".length });
    same(a_to_s(string.unparse("abcdefghij").data), a_to_s([0x61, 0x62, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6a, 0x00]));
    same(string.unparse("abcdefghij").length, 8 * "abcdefghij\u0000".length);
});

test("Advanced", function () {
    var string,
        data = init_buffer(0x61, 0x62, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6a, 0x00, 0x6b, 0x6c);

    // Test strings with terminating character and max length
    string = bitratchet.string({ terminator : 0x00, length : 8 * 3 });
    same(string.parse(data), { data : "abc", length : 8 * "abc".length });
    same(a_to_s(string.unparse("abc").data), a_to_s([0x61, 0x62, 0x63]));
    same(string.unparse("abc").length, 8 * "abc".length);
    string = bitratchet.string({ terminator : 0x00, length : 8 * 20 });
    same(string.parse(data), { data : "abcdefghij", length : 8 * "abcdefghij\u0000".length });
    same(a_to_s(string.unparse("abcdefghij").data), a_to_s([0x61, 0x62, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6a, 0x00]));
    same(string.unparse("abcdefghij").length, 8 * "abcdefghij\u0000".length);
    // Test string with terminating character and min length
    string = bitratchet.string({ terminator : 0x00, length : 8 * 12, read_full_length : true });
    same(string.parse(data), "abcdefghij");
    same(string.length, 8 * 12);
    same(a_to_s(string.unparse("abcdefghij")), a_to_s([0x61, 0x62, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6a, 0x00, 0x00]));
    same(string.length, 8 * 12);
    same(a_to_s(string.unparse("abcdefghij\u0000")), a_to_s([0x61, 0x62, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6a, 0x00, 0x00]));
    same(string.length, 8 * 12);
});

test("Pascal", function () {
    var string,
        data = init_buffer(0x61, 0x62, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6a, 0x00, 0x6b, 0x6c);

    // Test pascal strings
    data = init_buffer(0x03, 0x61, 0x62, 0x63, 0x64);
    string = bitratchet.string({ pascal : true });
    same(string.parse(data), { data : "abc", length : 8 * 4 });
    same(a_to_s(string.unparse("abc").data), a_to_s([0x03, 0x61, 0x62, 0x63]));
    same(string.unparse("abc").length, 8 * 4);
});

module("Flags");

test("Simple", function () {
    // Init everything
    var data = init_buffer(0xff, 0x21),
        flags = [0, "blue", "yellow", 0, "green", "red", "purple", "black",
                 0, 0, "white", "cyan", "olive", 0, "mauve", "beige"],
        values = ["low", "high"],
        colours = bitratchet.flags({ length : 8 * 2, flags : flags, values : values });
    // Run the tests
    same(colours.length, 8 * 2);
    same(colours.parse(data), { blue : "high", yellow : "high", green : "high",
                                red : "high", purple : "high", black : "high",
                                white : "high", cyan : "low", olive : "low",
                                mauve : "low", beige : "high" });
    // 0x6f not 0xff because skipped bits default to low when unparsing
    same(a_to_s(colours.unparse({ blue : "high", yellow : "high", green : "high",
                                  red : "high", purple : "high", black : "high",
                                  white : "high", cyan : "low", olive : "low",
                                  mauve : "low", beige : "high" })), a_to_s([0x6f, 0x21]));
});

test("Advanced", function () {
    // Test two dimensional value arrays
    var flags = [0, "blue", "yellow", 0, "green", "red", "purple", "black"],
        values = [0, ["low", "high"], ["small", "big"], 0, ["off", "on"], ["false", "true"],
                  ["disabled", "enabled"], ["off", "on"]],
        colours = bitratchet.flags({ length : 8, flags : flags, values : values });
    same(colours.parse(init_buffer(0x0f)), { blue : "low", yellow : "small", green : "on", red : "true",
                                purple : "enabled", black : "on" });
    same(a_to_s(colours.unparse({ blue : "low", yellow : "small", green : "on", red : "true",
                                  purple : "enabled", black : "on" })), a_to_s([0x0f]));
    // Another two dimensional test
    colours = bitratchet.flags({ length : 4, flags : ["blue", "yellow", "green", "red"],
                                 values : [["low", "high"], ["off", "on"],
                                           ["false", "true"], ["no", "yes"]] });
    same(colours.parse(init_buffer(0x04)), { blue : "low", yellow : "on", green : "false", red : "no" });
    same(a_to_s(colours.unparse({ blue : "low", yellow : "on", green : "false", red : "no" })), a_to_s([0x04]));
});

module("Hex");

test("Hex", function () {
    var data = init_buffer(0xde, 0xad, 0xbe, 0xef);
    // Test that invalid options throw exception
    raises(
        function () {
            bitratchet.hex({ length : 5 });
        },
        function (err) {
            return err === "Invalid length, must be divisible by 4.";
        }
    );
    raises(
        function () {
            bitratchet.hex({ length : 8 * 5 }).parse(data);
        },
        function (err) {
            return err === "Too little data given to parse to hex.";
        }
    );
    raises(
        function () {
            bitratchet.hex({ length : 4 }).unparse("nonsense");
        },
        function (err) {
            return err === "Invalid hex 'nonsense', can't unparse.";
        }
    );
    // Test that good input gives right result
    same(bitratchet.hex({ length : 8 * 4 }).parse(data), "deadbeef");
    same(a_to_s(bitratchet.hex({ length : 8 * 4 }).unparse("deadbeef")), a_to_s(data));
    // Test we can handle nibbles too
    same(bitratchet.hex({ length : 8 * 4 - 4 }).parse(data), "eadbeef");
    same(bitratchet.hex({ length : 8 * 4 - 4 }).length, 8 * 4 - 4);
    same(a_to_s(bitratchet.hex({ length : 8 * 4 - 4 }).unparse("deadbeef")), a_to_s([0x0e, 0xad, 0xbe, 0xef]));
    same(a_to_s(bitratchet.hex({ length : 8 * 4 - 4 }).unparse("eadbeef")), a_to_s([0x0e, 0xad, 0xbe, 0xef]));
    same(bitratchet.hex({ length : 4 }).parse(data), "f");
    same(a_to_s(bitratchet.hex({ length : 4 }).unparse("f")), a_to_s([0xf]));
});

module("Lookup");

test("Lookup", function () {
    var data = init_buffer(0xff);
    raises(
        function () {
            bitratchet.lookup({ type : bitratchet.number({ length: 8}),
                                table : [] }).unparse(1);
        },
        function (err) {
            return err === "Value '1' not in lookup-table.";
        }
    );
    raises(
        function () {
            // Having a missing parameter is no excuse for wrong data
            bitratchet.lookup({ type : bitratchet.number({ length : 2 }),
                                table : ["off", "mistake"],
                                missing : "off" }).parse(init_buffer(0x02));
        },
        function (err) {
            return err === "Value not in lookup-table.";
        }
    );
    // Usually table is an array
    same(bitratchet.lookup({ type : bitratchet.number({ length : 1}),
                             table : ["off", "on"] }).parse(data), "on");
    same(bitratchet.lookup({ type : bitratchet.number({ length : 2}),
                             table : ["one", "two", "three", "four"] }).parse(data), "four");
    same(a_to_s(bitratchet.lookup({ type : bitratchet.number({ length : 1}),
                                    table : ["off", "on"] }).unparse("on")), "[0x01]");
    same(a_to_s(bitratchet.lookup({ type : bitratchet.number({ length : 2}),
                                    table : ["off", "half", "on"] }).unparse("on")), "[0x02]");
    // Sometimes table might an object
    same(bitratchet.lookup({ type : bitratchet.number({ length : 1}),
                             table : { 0 : "off", 1 : "on"} }).parse(data), "on");
    same(a_to_s(bitratchet.lookup({ type : bitratchet.number({ length : 1}),
                                    table : { 0 : "off", 1 : "on"} }).unparse("on")), "[0x01]");
});

module("Array");

test("Basic", function () {
    same(bitratchet.array({ type : bitratchet.number({ length : 8 }),
                            size : 3}).parse(init_buffer(0x01, 0x02, 0x3)), [1, 2, 3]);
    same(bitratchet.array({ type : bitratchet.number({ length : 8 }),
                            size : 3}).unparse([1, 2, 3]), init_buffer(0x01, 0x02, 0x3));
    same(bitratchet.array({ type : bitratchet.number({ length : 8 }),
                            size : 3}).length, 8 * 3);
});

test("Array of a dynamic type", function () {
    var data = init_buffer(0x05, 0x61, 0x62, 0x63, 0x64, 0x65, 0x03, 0x78, 0x79, 0x7a),
        array = bitratchet.array({ type : bitratchet.string({ pascal : true }),
                                   size : 2});
    same(array.parse(data), { length : 10 * 8, data : ["abcde", "xyz"]});
    same(array.unparse(["abcde", "xyz"]), { length : 10 * 8, data : data });
});

test("Dynamic size", function () {
    var array = bitratchet.array({ type : bitratchet.number({ length : 8 }),
                                   size : function (state, record) {
                return state.size;
            } });
    same(array.parse(init_buffer(0x01, 0x02, 0x3), { size : 3 }), { length : 8 * 3, data : [1, 2, 3] });
    same(array.parse(init_buffer(0x01, 0x02, 0x3), { size : 2 }), { length : 8 * 2, data : [1, 2] });
    same(array.parse(init_buffer(0x01, 0x02, 0x3), { size : 1 }), { length : 8, data : [1] });
    same(array.parse(init_buffer(0x01, 0x02, 0x3), { size : 0 }), { length : 0, data : [] });
    same(array.unparse([1, 2, 3], { size : 3 }), { length : 8 * 3, data : init_buffer(0x01, 0x02, 0x3) });
    same(array.unparse([1, 2], { size : 2 }), { length : 8 * 2, data : init_buffer(0x01, 0x02) });
    same(array.unparse([1], { size : 1 }), { length : 8, data : init_buffer(0x01) });
    same(array.unparse([], { size : 0 }), { length : 0, data : new ArrayBuffer() });
});

test("Array of dynamic type with dynamic size", function () {
    var data = init_buffer(0x05, 0x61, 0x62, 0x63, 0x64, 0x65, 0x03, 0x78, 0x79, 0x7a),
        array = bitratchet.array({ type : bitratchet.string({ pascal : true }),
                                   size : function (state, record) {
                return state.size;
            } });
    same(array.parse(data, { size : 2 }), { length : 10 * 8, data : ["abcde", "xyz"]});
    same(array.parse(data, { size : 1 }), { length : 6 * 8, data : ["abcde"]});
    same(array.unparse(["abcde", "xyz"], { size : 2 }), { length : 10 * 8, data : data });
    same(array.unparse(["abcde"], { size : 1 }), { length : 6 * 8, data : init_buffer(0x05, 0x61, 0x62, 0x63, 0x64, 0x65) });
});

test("Dynamic type - static", function () {
    var array = bitratchet.array({ type : function (state, record) {
            return state.type;
        },
            size : 3 });
    same(array.parse(init_buffer(0x01, 0x02, 0x3), { type : bitratchet.hex({ length : 8 }) }), { length : 8 * 3, data : ["01", "02", "03"] });
    same(array.parse(init_buffer(0x01, 0x02, 0x3), { type : bitratchet.number({ length : 8 }) }), { length : 8 * 3, data : [1, 2, 3] });
    same(array.unparse(["01", "02", "03"], { type : bitratchet.hex({ length : 8 }) }), { length : 8 * 3, data : init_buffer(0x01, 0x02, 0x3) });
    same(array.unparse([1, 2, 3], { type : bitratchet.number({ length : 8 }) }), { length : 8 * 3, data : init_buffer(0x01, 0x02, 0x3) });
});

test("Dynamic type - dynamic", function () {
    var array = bitratchet.array({ type : function (state, record) {
            return state.type;
        },
            size : 2 }),
        data = init_buffer(0x05, 0x61, 0x62, 0x63, 0x64, 0x65, 0x03, 0x78, 0x79, 0x7a);
    same(array.parse(data, { type : bitratchet.string({ pascal : true }) }), { length : 8 * 10, data : ["abcde", "xyz"] });
    same(array.unparse(["abcde", "xyz"], { type : bitratchet.string({ pascal : true }) }), { length : 8 * 10, data : data });
});

test("Dynamic type - dynamic + static with dynamic size", function () {
    var array = bitratchet.array({ type : function (state, record) {
            return state.type;
        },
            size : function (state, record) {
                return state.size;
            } }),
        data = init_buffer(0x05, 0x61, 0x62, 0x63, 0x64, 0x65, 0x03, 0x78, 0x79, 0x7a);
    same(array.parse(data, { size : 2, type : bitratchet.string({ pascal : true }) }), { length : 8 * 10, data : ["abcde", "xyz"] });
    same(array.parse(data, { size : 1, type : bitratchet.string({ pascal : true }) }), { length : 8 * 6, data : ["abcde"] });
    same(array.parse(data, { size : 0, type : bitratchet.string({ pascal : true }) }), { length : 0, data : [] });
    same(array.unparse(["abcde", "xyz"], { size : 2, type : bitratchet.string({ pascal : true }) }), { length : 8 * 10, data : data });
    same(array.unparse(["abcde"], { size : 1, type : bitratchet.string({ pascal : true }) }), { length : 8 * 6, data : init_buffer(0x05, 0x61, 0x62, 0x63, 0x64, 0x65) });
});

test("Dynamic type based on index", function () {
    var array = bitratchet.array({
            type : function (state, record, index) {
                return bitratchet.hex({ length : 8 * (index + 1) });
            },
            size : 3
        }),
        data = init_buffer(0xab, 0xcd, 0xef, 0x01, 0x02, 0x03);
    same(array.parse(data), { data : ["ab", "cdef", "010203"], length : 8 * 6 });
    same(array.unparse(["ab", "cdef", "010203"]), { data : data, length : 8 * 6 });
});


module("Record");

test("Basic", function () {
    var result, data = init_buffer(0x11, 0x12, 0xFF, 0x1),
        record = bitratchet.record({ a : bitratchet.number({ length : 8 }),
                                     b : bitratchet.hex({ length : 8 * 3 })});
    same(record.length, undefined);
    same(record.parse(data), { data : { a : 0x11, b : "12ff01" }, length : 8 * 4 });
    result = record.unparse({ a : 0x11, b : "12ff01" });
    same(a_to_s(result.data), a_to_s(data));
    same(result.length, 8 * 4);
});

test("Dynamic lengths", function () {
    var data = init_buffer(0x11, 0x12, 0xFF, 0x1),
        record = bitratchet.record({ a : function () {
            return bitratchet.number({ length : 8 * 2 });
        },
                                     b : bitratchet.hex({ length : 8 * 2 })});
    same(record.length, undefined);
    same(record.parse(data), { data : { a : 0x1112, b : "ff01" }, length : 8 * 4 });
    same(a_to_s(record.unparse({ a : 0x1112, b : "ff01" }).data), a_to_s(data));
    same(record.unparse({ a : 0x1112, b : "ff01" }).length, 8 * 4);
});

test("Nested records", function () {
    var data = init_buffer(0x11, 0x12, 0xff, 0x1),
        record = bitratchet.record({ a : bitratchet.record({ a : bitratchet.number({ length : 8 }),
                                                             b : bitratchet.number({ length : 8 }) }),
                                     b : bitratchet.hex({ length : 8 * 2 })});
    same(record.length, undefined);
    same(record.parse(data), { data : { a : { a : 0x11, b: 0x12}, b : "ff01" },
                               length :  8 * 4 });
    same(a_to_s(record.unparse({ a : { a : 0x11, b: 0x12}, b : "ff01" }).data), a_to_s(data));
    same(record.unparse({ a : { a : 0x11, b: 0x12}, b : "ff01" }).length, 8 * 4);
});

test("Bit shifting", function () {
    var data = init_buffer(0x01, 0xf2, 0xff, 0x1f),
        record = bitratchet.record({ a : bitratchet.number({ length : 3 }),
                                     b : bitratchet.hex({ length : 8 }),
                                     c : bitratchet.number({ length : 21 })});
    same(record.length, undefined);
    same(record.parse(data), { data : { a : 0x0, b : "0f", c : 0x12ff1f }, length : 8 * 4 });
    same(a_to_s(record.unparse({ a : 0x0, b : "0f", c : 0x12ff1f }).data), a_to_s(data));
    same(record.unparse({ a : 0x0, b : "0f", c : 0x12ff1f }).length, 8 * 4);
});

test("Nested records with shifting and spare bits", function () {
    var data = init_buffer(0xf1, 0xf2, 0xff, 0x01),
        record = bitratchet.record({ a : bitratchet.record({ a : bitratchet.number({ length : 3 }) }),
                                     b : bitratchet.record({ a : bitratchet.number({ length : 3 }),
                                                             b : bitratchet.number({ length : 3 }) }),
                                     c : bitratchet.hex({ length : 8 })}),
        result;
    same(record.length, undefined);
    same(record.parse(data), { data : { a : { a : 0x7 }, b : { a : 0x4, b : 0x3 }, c : "e5" },
                               length : 17 });
    result = record.unparse({ a : { a : 0x7 }, b : { a : 0x4, b : 0x3 }, c : "e5" });
    same(a_to_s(result.data), a_to_s([0x01, 0xe3, 0xe5]));
    same(result.length, 17);
});

test("Record containing dynamic primitive that uses record context.", function () {
    var record = bitratchet.record({ read_message : bitratchet.number({ length : 8 }),
                                     message : function (state, record) {
                if (record.read_message) {
                    return bitratchet.hex({ length : 8 * 3 });
                }
                return bitratchet.skip({ length : 8 * 3 });
            }});
    same(record.parse(init_buffer(0x01, 0xab, 0xcd, 0xef)), { data : { read_message : 1, message : "abcdef" },
                                                              length : 8 * 4 });
    same(record.parse(init_buffer(0x00, 0xab, 0xcd, 0xef)), { data : { read_message : 0 },
                                                              length : 8 * 4 });
    same(a_to_s(record.unparse({ read_message : 1, message : "abcdef" }).data), a_to_s([0x01, 0xab, 0xcd, 0xef]));
    same(a_to_s(record.unparse({ read_message : 0 }).data), a_to_s([0x00, 0x00, 0x00, 0x00]));
});

test("Nested record with dynamic primitive that uses parent's context.", function () {
    var data, record = bitratchet.record({ header : bitratchet.record({ length : bitratchet.number({ length : 8 }) }),
                                           payload : bitratchet.record({ data : function (state, record) {
            return bitratchet.string({ length : record.header.length * 8 });
        }})}),
        result;
    data = init_buffer(0x03, 0x61, 0x62, 0x63, 0x64);
    same(record.parse(data), { data : { header : { length : 3 }, payload : { data : "abc" } },
                               length : 8 * 4 });
    result = record.unparse({ header : { length : 3 }, payload : { data : "abc" } });
    same(a_to_s(result.data), a_to_s([0x03, 0x61, 0x62, 0x63]));
    same(result.length, 8 * 4);
});

test("Record that skips some data.", function () {
    var record, data = init_buffer(0xff, 0x12, 0x34);
    // Test skip primitive works properly
    record = bitratchet.record({ skipped : bitratchet.skip({ length : 8 }),
                                 data : bitratchet.hex({ length : 8 * 2 }) });
    same(record.parse(data), { data : { data : "1234" }, length : 8 * 3 });
    same(a_to_s(record.unparse({ data : "1234" }).data), a_to_s([0x00, 0x12, 0x34]));
    // Test dynamic skip doesn't move position on
    record = bitratchet.record({ skipped : function () { },
                                 data : bitratchet.hex({ length : 8 * 2 }) });
    same(record.parse(data), { data : { data : "ff12" }, length : 8 * 2 });
    same(a_to_s(record.unparse({ data : "FF12" }).data), a_to_s([0xff, 0x12]));
    same(a_to_s(record.unparse({ data : "FF12", skipped : "test" }).data), a_to_s([0xff, 0x12]));
    // Test dynamic skip with value doesn't move position on
    record = bitratchet.record({ skipped :  function () { return "WAT"; },
                                 data : bitratchet.hex({ length : 8 * 2 }) });
    same(record.parse(data), { data : { skipped : "WAT", data : "ff12" }, length : 8 * 2 });
    same(a_to_s(record.unparse({ data : "FF12" }).data), a_to_s([0xff, 0x12]));
    same(a_to_s(record.unparse({ data : "FF12", skipped : "WAT" }).data), a_to_s([0xff, 0x12]));
});

test("Nested record with defaults", function () {
    var data = {
        a : 1,
        b : {
            // c : "false"
        }
    }, record = bitratchet.record({
        a : bitratchet.number({ length : 8 }),
        b : bitratchet.record({
            c : bitratchet.lookup({ type : bitratchet.number({ length : 8 }),
                                    table : ["false", "true"],
                                    missing : function (state, record) {
                    return record.a === 2 ? "true" : "false";
                } })
        })
    });
    // Test we notice if no value or default is given
    raises(
        function () {
            bitratchet.record({
                a : bitratchet.number({ length : 8 })
            }).unparse({});
        },
        function (err) {
            return err === "Data missing for field \"a\" and no default value given.";
        }
    );
    // Test defaults work properly
    same(a_to_s(record.unparse(data).data), "[0x01, 0x00]");
    data.a = 2;
    same(a_to_s(record.unparse(data).data), "[0x02, 0x01]");
    // Test defaults aren't used if we have data
    data.b.c = "false";
    same(a_to_s(record.unparse(data).data), "[0x02, 0x00]");
});

test("Record using passed in state", function () {
    var record = bitratchet.record({
            a : function (state, record_context) {
                if (state.example === 1) {
                    return bitratchet.hex({ length : 8 });
                }
                return bitratchet.number({ length : 8 });
            },
            b : bitratchet.record({
                c : bitratchet.number({ length : 8, missing : function (state, record_context) {
                    if (record_context.a === "ff") {
                        return state.example;
                    }
                } })
            })
        }),
        data = init_buffer(0xff, 0x03);
    // Test
    same(record.parse(data), { data : { a : 255, b : { c : 3 } }, length : 8 * 2 });
    same(a_to_s(record.unparse({ a : 255, b : { c : 3 } }).data), a_to_s([0xff, 0x03]));
    same(record.parse(data, { example : 1 }), { data : { a : "ff", b : { c : 3 } }, length : 8 * 2 });
    same(a_to_s(record.unparse({ a : "ff", b : { c : 3 } }, { example : 1 }).data), a_to_s([0xff, 0x03]));
    same(a_to_s(record.unparse({ a : "ff", b : { } }, { example : 1 }).data), a_to_s([0xff, 0x01]));
    same(a_to_s(record.unparse({ a : 255, b : { } }, { example : 0xab }).data), a_to_s([0xff, 0x00]));
});