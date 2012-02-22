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
    var string, store = {},
        data = init_buffer(0x61, 0x62, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6a, 0x00, 0x6b, 0x6c);

    // Test strings with a fixed length
    string = bitratchet.string({ length : 8 * 5 });
    same(string.parse(data), "abcde");
    same(string.length, 8 * 5);
    same(a_to_s(string.unparse("abcde")), a_to_s([0x61, 0x62, 0x63, 0x64, 0x65]));
    same(string.length, 8 * 5);
    // Test strings with terminating character and dynamic length
    string = bitratchet.string({ terminator : 0x00 });
    same(string.parse(data, store), "abcdefghij");
    same(store.length, 8 * "abcdefghij\u0000".length);
    same(a_to_s(string.unparse("abcdefghij", store)), a_to_s([0x61, 0x62, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6a, 0x00]));
    same(store.length, 8 * "abcdefghij\u0000".length);
});

test("Advanced", function () {
    var string, store = {},
        data = init_buffer(0x61, 0x62, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6a, 0x00, 0x6b, 0x6c);

    // Test strings with terminating character and max length
    string = bitratchet.string({ terminator : 0x00, length : 8 * 3 });
    same(string.parse(data, store), "abc");
    same(store.length, 8 * "abc".length);
    same(a_to_s(string.unparse("abc", store)), a_to_s([0x61, 0x62, 0x63]));
    same(store.length, 8 * "abc".length);
    string = bitratchet.string({ terminator : 0x00, length : 8 * 20 });
    same(string.parse(data, store), "abcdefghij");
    same(store.length, 8 * "abcdefghij\u0000".length);
    same(a_to_s(string.unparse("abcdefghij", store)), a_to_s([0x61, 0x62, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6a, 0x00]));
    same(store.length, 8 * "abcdefghij\u0000".length);
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
    var string, store = {},
        data = init_buffer(0x61, 0x62, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6a, 0x00, 0x6b, 0x6c);

    // Test pascal strings
    data = init_buffer(0x03, 0x61, 0x62, 0x63, 0x64);
    string = bitratchet.string({ pascal : true });
    same(string.parse(data, store), "abc");
    same(store.length, 8 * 4);
    same(a_to_s(string.unparse("abc", store)), a_to_s([0x03, 0x61, 0x62, 0x63]));
    same(store.length, 8 * 4);
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
    // Test two dimensional value arrays
    values = [0, ["low", "high"], ["small", "big"], 0, ["off", "on"], ["false", "true"],
              ["disabled", "enabled"], ["off", "on"]];
    colours = bitratchet.flags({ length : 8, flags : flags.slice(0, 8), values : values });
    same(colours.parse(init_buffer(0x0f)), { blue : "low", yellow : "small", green : "on", red : "true",
                                purple : "enabled", black : "on" });
    same(a_to_s(colours.unparse({ blue : "low", yellow : "small", green : "on", red : "true",
                                  purple : "enabled", black : "on" })), a_to_s([0x0f]));
    // Another two dimensional test
    console.log("MARK");
    colours = bitratchet.flags({ length : 4, flags : ["blue", "yellow", "green", "red"],
                                 values : [["low", "high"], ["off", "on"],
                                           ["false", "true"], ["no", "yes"]] });
    same(colours.parse(init_buffer(0x04)), { blue : "low", yellow : "on", green : "false", red : "no" })
    same(a_to_s(colours.unparse({ blue : "low", yellow : "on", green : "false", red : "no" })), a_to_s([0x04]));
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
            return err === "Invalid hex, can't unparse.";
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

test("Lookup", function () {
    var data = init_buffer(0xff);
    raises(
        function () {
            bitratchet.lookup({ type : bitratchet.number({ length: 8}),
                                table : [] }).unparse(data);
        },
        function (err) {
            return err === "Value given not in lookup-table.";
        }
    );
    // Usually table is an array
    same(bitratchet.lookup({ type : bitratchet.number({ length : 1}),
                             table : ["off", "on"] }).parse(data), "on");
    same(bitratchet.lookup({ type : bitratchet.number({ length : 2}),
                             table : ["one", "two", "three", "four"] }).parse(data), "four");
    same(bitratchet.lookup({ type : bitratchet.number({ length : 2}),
                             table : ["off", "mistake"],
                             missing : "off" }).parse(data), "off");
    same(a_to_s(bitratchet.lookup({ type : bitratchet.number({ length : 1}),
                                    table : ["off", "on"] }).unparse("on")), "[0x01]");
    same(a_to_s(bitratchet.lookup({ type : bitratchet.number({ length : 2}),
                                    table : ["off", "half", "on"] }).unparse("on")), "[0x02]");
    same(a_to_s(bitratchet.lookup({ type : bitratchet.number({ length : 2}),
                                    table : ["off", "half"],
                                    missing : "off" }).unparse("on")), "[0x00]");
    // Sometimes table might an object
    same(bitratchet.lookup({ type : bitratchet.number({ length : 1}),
                             table : { 0 : "off", 1 : "on"} }).parse(data), "on");
    same(a_to_s(bitratchet.lookup({ type : bitratchet.number({ length : 1}),
                                    table : { 0 : "off", 1 : "on"} }).unparse("on")), "[0x01]");
});


module("Record");

test("Basic", function () {
    var data = init_buffer(0x11, 0x12, 0xFF, 0x1),
        record = bitratchet.record({ a : bitratchet.number({ length : 8 }),
                                     b : bitratchet.hex({ length : 8 * 3 })}),
        store = {};
    same(record.length, undefined);
    same(record.parse(data, store), { a : 0x11, b : "12ff01" });
    same(store.length, 8 * 4);
    same(a_to_s(record.unparse({ a : 0x11, b : "12ff01" }, store)), a_to_s(data));
    same(store.length, 8 * 4);
});

test("Dynamic lengths", function () {
    var data = init_buffer(0x11, 0x12, 0xFF, 0x1),
        record = bitratchet.record({ a : function () {
            return bitratchet.number({ length : 8 * 2 });
        },
                                     b : bitratchet.hex({ length : 8 * 2 })}),
        store = {};
    same(record.length, undefined);
    same(record.parse(data, store), { a : 0x1112, b : "ff01" });
    same(store.length, 8 * 4);
    same(a_to_s(record.unparse({ a : 0x1112, b : "ff01" }, store)), a_to_s(data));
    same(store.length, 8 * 4);
});

test("Nested records", function () {
    var data = init_buffer(0x11, 0x12, 0xff, 0x1),
        record = bitratchet.record({ a : bitratchet.record({ a : bitratchet.number({ length : 8 }),
                                                             b : bitratchet.number({ length : 8 }) }),
                                     b : bitratchet.hex({ length : 8 * 2 })}),
        store = {};
    same(record.length, undefined);
    same(record.parse(data, store), { a : { a : 0x11, b: 0x12}, b : "ff01" });
    same(store.length, 8 * 4);
    same(a_to_s(record.unparse({ a : { a : 0x11, b: 0x12}, b : "ff01" }, store)), a_to_s(data));
    same(store.length, 8 * 4);
});

test("Bit shifting", function () {
    var data = init_buffer(0x01, 0xf2, 0xff, 0x1f),
        record = bitratchet.record({ a : bitratchet.number({ length : 3 }),
                                     b : bitratchet.hex({ length : 8 }),
                                     c : bitratchet.number({ length : 21 })}),
        store = {};
    same(record.length, undefined);
    same(record.parse(data, store), { a : 0x0, b : "0f", c : 0x12ff1f });
    same(store.length, 8 * 4);
    same(a_to_s(record.unparse({ a : 0x0, b : "0f", c : 0x12ff1f }, store)), a_to_s(data));
    same(store.length, 8 * 4);
});

test("Nested records with shifting and spare bits", function () {
    var data = init_buffer(0xf1, 0xf2, 0xff, 0x01),
        record = bitratchet.record({ a : bitratchet.record({ a : bitratchet.number({ length : 3 }) }),
                                     b : bitratchet.record({ a : bitratchet.number({ length : 3 }),
                                                             b : bitratchet.number({ length : 3 }) }),
                                     c : bitratchet.hex({ length : 8 })}),
        store = {};
    same(record.length, undefined);
    same(record.parse(data, store), { a : { a : 0x7 }, b : { a : 0x4, b : 0x3 }, c : "e5" });
    same(store.length, 17);
    same(a_to_s(record.unparse({ a : { a : 0x7 }, b : { a : 0x4, b : 0x3 }, c : "e5" }, store)), a_to_s([0x01, 0xe3, 0xe5]));
    same(store.length, 17);
});

test("Record containing dynamic primitive that uses record context.", function () {
    var record = bitratchet.record({ read_message : bitratchet.number({ length : 8 }),
                                     message : function (record) {
                if (record.read_message) {
                    return bitratchet.hex({ length : 8 * 3 });
                } else {
                    return bitratchet.skip({ length : 8 * 3 });
                }
            }});
    same(record.parse(init_buffer(0x01, 0xab, 0xcd, 0xef)), { read_message : 1, message : "abcdef" });
    same(record.parse(init_buffer(0x00, 0xab, 0xcd, 0xef)), { read_message : 0 });
    same(a_to_s(record.unparse({ read_message : 1, message : "abcdef" })), a_to_s([0x01, 0xab, 0xcd, 0xef]));
    same(a_to_s(record.unparse({ read_message : 0 })), a_to_s([0x00, 0x00, 0x00, 0x00]));
});

test("Nested record with dynamic primitive that uses parent's context.", function () {
    var data, record = bitratchet.record({ header : bitratchet.record({ length : bitratchet.number({ length : 8 }) }),
                                           payload : bitratchet.record({ data : function (record) {
            return bitratchet.string({ length : record.header.length * 8 });
        }})}),
        store = { };
    data = init_buffer(0x03, 0x61, 0x62, 0x63, 0x64);
    same(record.parse(data, store), { header : { length : 3 }, payload : { data : "abc" } });
    same(store.length, 8 * 4);
    same(a_to_s(record.unparse({ header : { length : 3 }, payload : { data : "abc" } }, store)), a_to_s([0x03, 0x61, 0x62, 0x63]));
    same(store.length, 8 * 4);
});

test("Record that skips some data.", function () {
    var record, data = init_buffer(0xff, 0x12, 0x34);
    // Test skip primitive works properly
    record = bitratchet.record({ skipped : bitratchet.skip({ length : 8 }),
                                 data : bitratchet.hex({ length : 8 * 2 }) });
    same(record.parse(data), { data : "1234" });
    same(a_to_s(record.unparse({ data : "1234" })), a_to_s([0x00, 0x12, 0x34]));
    // Test dynamic skip doesn't move position on
    record = bitratchet.record({ skipped : function () { },
                                 data : bitratchet.hex({ length : 8 * 2 }) });
    same(record.parse(data), { data : "ff12" });
    same(a_to_s(record.unparse({ data : "FF12" })), a_to_s([0xff, 0x12]));
    same(a_to_s(record.unparse({ data : "FF12", skipped : "test" })), a_to_s([0xff, 0x12]));
    // Test dynamic skip with value doesn't move position on
    record = bitratchet.record({ skipped :  function () { return "WAT"; },
                                 data : bitratchet.hex({ length : 8 * 2 }) });
    same(record.parse(data), { skipped : "WAT", data : "ff12" });
    same(a_to_s(record.unparse({ data : "FF12" })), a_to_s([0xff, 0x12]));
    same(a_to_s(record.unparse({ data : "FF12", skipped : "WAT" })), a_to_s([0xff, 0x12]));
});

/*test("Record that takes a parameter for state.", function () {
    var record, data = init_buffer(0x07);
    // Set up our primtive takes a multiplier
    function 
    // Simple test
    record = bitratchet.record({
        value : function (record, state) {
            if (state && state.multiplier) {
                return 
        
    // Nested test
    var record, data 
});*/