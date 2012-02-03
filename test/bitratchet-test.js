/*global ArrayBuffer, Uint8Array, bitratchet, module, ok, same, test, raises*/
/*jslint sloppy: true*/

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
    same(bitratchet.number({ length : 8, signed : true }).parse(data), -0x7f);
    same(bitratchet.number({ length : 4, signed : true }).parse(data), -0x7);
    same(bitratchet.number({ length : 3, signed : true }).parse(data), -0x3);
    same(bitratchet.number({ length : 2, signed : true }).parse(data), -0x1);
    same(bitratchet.number({ length : 8 * 4, signed : true }).parse(data), -0x7f0216ff);
    // Test unparsing
    same(a_to_s(bitratchet.number({ length : 8, signed : true }).unparse(-0x7b)), "[0xfb]");
    same(a_to_s(bitratchet.number({ length : 7, signed : true }).unparse(-0x3b)), "[0x7b]");
    same(a_to_s(bitratchet.number({ length : 6, signed : true }).unparse(-0x1b)), "[0x3b]");
    same(a_to_s(bitratchet.number({ length : 5, signed : true }).unparse(-0x0b)), "[0x1b]");
    same(a_to_s(bitratchet.number({ length : 4, signed : true }).unparse(-0x07)), "[0x0f]");
    same(a_to_s(bitratchet.number({ length : 4, signed : true }).unparse(0x07)), "[0x07]");
    same(a_to_s(bitratchet.number({ length : 3, signed : true }).unparse(-0x03)), "[0x07]");
    same(a_to_s(bitratchet.number({ length : 2, signed : true }).unparse(-0x01)), "[0x03]");
    // Test length
    same(bitratchet.number({ length : 8, signed : true }).length, 8);
    same(bitratchet.number({ length : 7 }).length, 7);
});

test("Scaling", function () {
    // Init our data to read
    var data = init_buffer(0xff, 0x02, 0x16, 0xff);
    // Scale range
    same(bitratchet.number({ length : 8 * 4, scale_range : 360 }).parse(data), 358.6052297707647);
    // Precision
    same(bitratchet.number({ length : 8 * 4, precision: 4,
                             scale_range : 360 }).parse(data), 358.6052);
    // Custom scaling
    same(bitratchet.number({ length : 8 * 4, custom_scale : 0.01 }).parse(data), 42783270.39);
});

module("Others");

test("Flags", function () {
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

test("Dynamic", function () {
    var a, field,
        f = function () {
            if (a) {
                return bitratchet.number({ length : 4 });
            } else {
                return bitratchet.hex({ length : 8 * 2});
            }
        },
        data = init_buffer(0x13, 0x37);
    // Test we get a nibble-number when a's truthy
    a = true;
    field = bitratchet.dynamic(f);
    same(field.parse(data), 0x03);
    same(field.length, 4);
    // Test we get an byte of hex otherwise
    a = false;
    field = bitratchet.dynamic(f);
    same(field.parse(data), "1337");
    same(field.length, 16);
});

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
            bitratchet.hex({ length : 4 }).parse(data);
        },
        function (err) {
            return err === "Wrong amount of data given to parse to hex";
        }
    );
    raises(
        function () {
            bitratchet.hex({ length : 4 }).unparse("nonsense");
        },
        function (err) {
            return err === "Invalid hex, can't unparse.";
        }
    );
    // Test that good input gives right result
    same(bitratchet.hex({ length : 8 * 4 }).parse(data), "deadbeef");
    same(bitratchet.hex({ length : 8 * 4 - 4 }).parse(data), "deadbee");
    same(bitratchet.hex({ length : 8 * 4 - 4 }).length, 8 * 4 - 4);
    same(a_to_s(bitratchet.hex({ length : 8 * 4 }).unparse("deadbeef")), a_to_s(data));
    same(a_to_s(bitratchet.hex({ length : 8 * 4 - 4 }).unparse("deadbeef")), a_to_s([0xde, 0xad, 0xbe, 0xe0]));
});

test("Lookup", function () {
    var data = init_buffer(0xde, 0xad, 0xbe, 0xef);
    ok(0);
});


module("Record");

test("Basic", function () {
    var data = init_buffer(0x11, 0x12, 0xFF, 0x1),
        record = bitratchet.record({ a : bitratchet.number({ length : 8 }),
                                     b : bitratchet.hex({ length : 8 * 3 })});
    same(record.length, 0);
    same(record.parse(data), { a : 0x11, b : "12ff01" });
    same(record.length, 8 * 4);
    same(a_to_s(record.unparse({ a : 0x11, b : "12ff01" })), a_to_s(data));
    same(record.length, 8 * 4);
});

test("Dynamic lengths", function () {
    var data = init_buffer(0x11, 0x12, 0xFF, 0x1),
        record = bitratchet.record({ a : bitratchet.dynamic(function () {
            return bitratchet.number({ length : 8 * 2 });
        }),
                                     b : bitratchet.hex({ length : 8 * 2 })});
    same(record.length, 0);
    same(record.parse(data), { a : 0x1112, b : "ff01" });
    same(record.length, 8 * 4);
    same(a_to_s(record.unparse({ a : 0x1112, b : "ff01" })), a_to_s(data));
    same(record.length, 8 * 4);
});

test("Nested records", function () {
    var data = init_buffer(0x11, 0x12, 0xFF, 0x1),
        record = bitratchet.record({ a : bitratchet.record({ a : bitratchet.number({ length : 8 }),
                                                             b : bitratchet.number({ length : 8 }) }),
                                     b : bitratchet.hex({ length : 8 * 2 })});
    same(record.length, 0);
    same(record.parse(data), { a : { a : 0x11, b: 0x12}, b : "ff01" });
    same(record.length, 8 * 4);
    same(a_to_s(record.unparse({ a : { a : 0x11, b: 0x12}, b : "ff01" })), a_to_s(data));
    same(record.length, 8 * 4);
});

test("Bit shifting", function () {
    var data = init_buffer(0xF1, 0xF2, 0xFF, 0x1),
        record = bitratchet.record({ a : bitratchet.number({ length : 3 }),
                                     b : bitratchet.hex({ length : 8 }),
                                     c : bitratchet.number({ length : 21 })});
    same(record.length, 0);
    same(record.parse(data), { a : 0x7, b : "8f", c : 0x12ff01 });
    same(record.length, 8 * 4);
    same(a_to_s(record.unparse({ a : 0x7, b : "8f", c : 0x12ff01 })), a_to_s(data));
    same(record.length, 8 * 4);
});

test("Nested records with shifting and spare bits", function () {
    var data = init_buffer(0xF1, 0xF2, 0xFF, 0x1),
        record = bitratchet.record({ a : bitratchet.record({ a : bitratchet.number({ length : 3 }) }),
                                     b : bitratchet.record({ a : bitratchet.number({ length : 3 }),
                                                             b : bitratchet.number({ length : 3 }) }),
                                     c : bitratchet.hex({ length : 8 })});
    same(record.length, 0);
    same(record.parse(data), { a : { a : 0x7 }, b : { a : 0x1, b : 0x6 }, c : 0xe5 });
    same(record.length, 8 * 4);
    same(a_to_s(record.unparse({ a : { a : 0x7 }, b : { a : 0x1, b : 0x6 }, c : "e5" })), a_to_s(data));
    same(record.length, 8 * 4);
});