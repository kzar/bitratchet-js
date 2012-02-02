var bitratchet;
if (!bitratchet) {
    bitratchet = {};
}

(function () {
    "use strict";

    if (typeof bitratchet.record !== 'function') {
        bitratchet.record = function record(structure) {
            function map_fields(f) {
                for (var field in structure) {
                    if (structure.hasOwnProperty(field)) {
                        f(field, structure[field]);
                    }
                }
            }
            return {
                parse : function (data) {
                    var result = {}, position = 0;
                    map_fields(function (k, v) {
                        var byte_offset, bit_offset, spare_bits, shifted_data;
                        if (position % 8 === 0) {
                            // If our position falls on a byte just parse the field
                            if (v.length) {
                                // If field has set length just pass it required data
                                result[k] = v.parse(data.subarray(position / 8, position / 8 + Math.ceil(v.length / 8)))
                            } else {
                                // Otherwise pass it all remaining data
                                result[k] = v.parse(data.subarray(position / 8));
                            }
                        } else {
                            // Our position falls over bytes so shift data along first
                            byte_offset = Math.floor(position / 8);
                            bit_offset = position % 8;
                            if (v.length) {
                                // Field has set length so just shift required data
                                shifted_data = new Uint8Array(new ArrayBuffer(Math.ceil(v.length / 8)));
                            } else {
                                // Field has dynamic length so shift all remaining data
                                shifted_data = new Uint8Array(new ArrayBuffer(data.length - byte_offset));
                            }
                            spare_bits = 0;
                            for (i = 0; i < shifted_data.length; i += 1) {
                                shifted_data[i] = (data[i + byte_offset] >> bit_offset) | spare_bits;
                                spare_bits = data[i + byte_offset] & bit_offset;
                            }
                            // Now we can parse it
                            result[k] = v.parse(shifted_data);
                        }
                        position += v.length;
                    });
                    this.length = position;
                    return result;
                },
                unparse : function (data) {
                    var results = [], assembled_data, byte_position, bit_offset;
                    // First parse each part collecting the result and it's length
                    this.length = 0;
                    map_fields(function(k, v) {
                        results.concat({ value : v.unparse(data[k]), length : v.length });
                        this.length += v.length;
                    });
                    // Now put all those results into an ArrayBuffer and return
                    assembled_data = new Uint8Array(new ArrayBuffer(Math.ceil(this.length / 8)));
                    bit_offset = 0;
                    byte_position = 0;
                    for (i = 0; i <  results.length; i += 1) {
                        for (j = 0; j < results[i].value.length; j += 1) {
                            if (bit_offest === 0) {
                                // No bit offset so copy byte over straight
                                assembled_data[byte_position] = results[i].value[j];
                            } else {
                                // Take account of bit offset when copying byte over
                                assembled_data[byte_position] = assembled_data[byte_position] | results[i].value[j] >> bit_offset;
                                if (byte_position + 1 < assembled_data.length) {
                                    assembled_data[byte_position + 1] = results[i].value[j] & bit_offset;
                                }
                            }
                            byte_position += 1;
                        }
                        bit_offset = (bit_offest + results[i].length) % 8;
                    }
                    return assembled_data;
                },
                length: 0
            };
        }
    }

    if (typeof bitratchet.number !== 'function') {
        (function () {
            // Helper functions for working with numbers
            function binary_to_number(bytes, signed, bit_count) {
                var i, byte_count, number;
                byte_count = Math.ceil(bit_count / 8);
                for (i = 0; i < byte_count; i += 1) {
                    if (i === 0) {
                        // For last byte mask any spare bits
                        number = bytes[byte_count - 1] & Math.pow(2, 8 - bit_count % 8);
                    } else {
                        // For other bytes add 'em on
                        number += bytes[byte_count - i - 1] * Math.pow(2, i * 8);
                    }
                }
                return signed ? number >> 0 : number >>> 0;
            }
            function number_to_binary(number, bit_count) {
                var i = 0, bytes = new Uint8Array(new ArrayBuffer(Math.ceil(bit_count / 8)));
                while (i < bytes.length) {
                    if (i === 0) {
                        // For last byte mask any spare bits
                        bytes[bytes.length - 1] = number & Math.pow(2, 8 - bit_count % 8);
                    } else {
                        // For others add 'em in
                        bytes[bytes.length - i - 1] = number / Math.pow(2, i * 8) & 0xff;
                    }
                    i += 1;
                }
                return bytes;
            }
            function round_number(number, precision) {
                if (precision === undefined) {
                    return number;
                } else {
                    return Math.round(number * Math.pow(10, precision)) / Math.pow(10, precision);
                }
            }
            function scale(options) {
                return (options.custom_scale ||
                        (options.scale_range && options.scale_range /
                         Math.pow(2, options.length)) || 1);
            }
            // Actual number function
            bitratchet.number = function number(options) {
                return {
                    parse : function (data) {
                        return round_number(binary_to_number(data, options.length, options.signed) * scale(options), options.precision);
                    },
                    unparse : function (data) {
                        return number_to_binary(Math.round(data / scale(options)) >>> 0, options.length);
                    },
                    length: options.length
                };
            }
        })();
    }

    if (typeof bitratchet.lookup !== 'function') {
        bitratchet.lookup = function lookup(options) {
            return {
                parse : function (data) {
                    var index = options.type.parse(data);
                    this.length = options.type.length;
                    return index < options.table.length ? options.table[index] : options.missing;
                },
                unparse : function (data) {
                    var i, result;
                    for (var i = 0; i < options.table.length; i += 1) {
                        if (lookup[i] === data) {
                            result = options.type.unparse(i);
                            this.length = options.type.length;
                            return result;
                        }
                    }
                    return options.missing;
                },
                // FIXME - length can't be guarneteed when unparsing if lookup key is missing
                // and options.type has variable length. (Unlikely in fairness)
                length : options.type.length
            };
        }
    }

    if (typeof bitratchet.flags !== 'function') {
        bitratchet.flags = function flags(options) {
            return {
                parse : function (data) {
                    var i, results = {};
                    // Next assemble the result
                    for (i = 0; i < options.length; i += 1) {
                        if (options.flags[i]) {
                            // Select correct byte, then bit and use it to add result value
                            results[options.flags[i]] = options.values[(data[Math.floor(i / 8)] >> (i % 8)) & 0xf];
                        }
                    }
                    return results
                },
                unparse : function (data) {
                    var i, current_byte, bytes = new Uint8Array(new ArrayBuffer(Math.ceil(options.length / 8)));
                    // Work through flags ORing their values onto relevant byte
                    for (i = 0; i < options.flags.length; i += 1) {
                        current_byte = Math.floor(i / 8);
                        bytes[current_byte] = bytes[current_byte] | (options.values[data[options.flags[i]]] << (i % 8));
                    }
                    return bytes;
                },
                length : options.length
            }
        }
    }

    if (typeof bitratchet.dynamic !== 'function') {
        bitratchet.dynamic = function dynamic(f) {
            return {
                parse : function (data) {
                    var field = f(),
                        result = field.parse(data);
                    this.length = field.length;
                    return result;
                },
                unparse : function (data) {
                    var field = f(),
                        result = field.unparse(data);
                    this.length = field.length;
                    return result;
                },
                length: 0
            };
        }
    }

    if (typeof bitratchet.hex !== 'function') {
        bitratchet.hex = function hex(options) {
            // Make sure we've been given a valid length
            if (options.length % 4 !== 0) {
                throw "Invalid length, must be divisible by 4.";
            }
            // If so return the hex object
            return {
                parse : function (data) {
                    var i, hex = '';
                    // Make sure we've been given an acceptable amount of data
                    if (data.length * 8 > options.length + 4 ||
                        data.length * 8 < options.length) {
                        throw "Wrong amount of data given to parse to hex";
                    }
                    // Parse to hex
                    for (i = 0; i < data.length; i += 1) {
                        // Pad to byte unless we're on last nibble
                        if (data[i] < 0x10 && i * 8 < options.length - 8) {
                            hex += "0";
                        }
                        // Either way add the nibble / byte
                        hex += data[i].toString(16);
                    }
                    return hex;
                },
                unparse : function (data) {
                    if (!/^[0-9a-fA-F]+$/.test(data)) {
                        throw "Invalid hex, can't unparse."
                    }
                    var i, bytes = new Uint8Array(new ArrayBuffer(Math.ceil(options.length / 8)));
                    // Chunk hex
                    data = data.match(/.{1,2}/g);
                    // Convert to byte array
                    for (i = 0; i < bytes.length; i += 1) {
                        bytes[i] = parseInt(data[i], 16);
                    }
                    return bytes;
                },
                length : options.length
            }
        };
    }
})();


// FIXME - scrap?
    function reverse_lookup(object, value) {
        var key;
        for (key in object) {
            if (object.hasOwnProperty(key) && object[key] === value) {
                return parseInt(key, 10);
            }
        }
    }


    function arraybuffer_to_array(arraybuffer) {
        var i, a = [];
        for (i = 0; i < arraybuffer.length; i += 1) {
            a[i] = arraybuffer[i];
        }
        return a;
    }


