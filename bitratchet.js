/*global ArrayBuffer, Uint8Array*/
/*jslint bitwise: true, regexp: true, indent: 4*/

var bitratchet;
if (!bitratchet) {
    bitratchet = {};
}

(function () {
    "use strict";

    function a_index(a, item) {
        var i;
        for (i = 0; i < a.length; i += 1) {
            if (a[i] === item) {
                return i;
            }
        }
        return -1;
    }


    if (typeof bitratchet.record !== 'function') {
        bitratchet.record = function record(structure) {
            function map_fields(f) {
                var field;
                for (field in structure) {
                    if (structure.hasOwnProperty(field)) {
                        f(field, structure[field]);
                    }
                }
            }
            return {
                parse : function (data) {
                    var result = {}, position = 0;
                    data = new Uint8Array(data);
                    map_fields(function (k, v) {
                        var byte_offset, bit_offset, spare_bits, shifted_data, shifted_buffer, i, field;
                        if (position % 8 === 0) {
                            // If our position falls on a byte just parse the field
                            if (v.length) {
                                // If field has set length just pass it required data
                                field = v.parse(data.subarray(position / 8, position / 8 + Math.ceil(v.length / 8)), result);
                            } else {
                                // Otherwise pass it all remaining data
                                field = v.parse(data.subarray(position / 8), result);
                            }
                        } else {
                            // Our position falls over bytes so shift data along first
                            byte_offset = Math.floor(position / 8);
                            bit_offset = position % 8;
                            if (v.length) {
                                // Field has set length so just shift required data
                                shifted_buffer = new ArrayBuffer(Math.ceil(v.length / 8));
                            } else {
                                // Field has dynamic length so shift all remaining data
                                shifted_buffer = new ArrayBuffer(data.length - byte_offset);
                            }
                            shifted_data = new Uint8Array(shifted_buffer);
                            spare_bits = 0;
                            for (i = 0; i < shifted_data.length; i += 1) {
                                shifted_data[i] = (data[i + byte_offset] >> bit_offset) | spare_bits;
                                spare_bits = data[i + byte_offset] & bit_offset;
                            }
                            // Now we can parse it
                            field = v.parse(shifted_buffer, result);
                        }
                        // If field isn't false add it to the results
                        if (field !== undefined) {
                            result[k] = field;
                        }
                        position += v.length;
                    });
                    this.length = position;
                    return result;
                },
                unparse : function (data) {
                    var results = [], bytes, buffer, byte_position, bit_offset, that, i, j;
                    // First parse each part collecting the result and it's length
                    this.length = 0;
                    that = this;
                    map_fields(function (k, v) {
                        results.push({ value : new Uint8Array(v.unparse(data[k], data)), length : v.length });
                        that.length += v.length;
                    });
                    // Now put all those results into an ArrayBuffer and return
                    buffer = new ArrayBuffer(Math.ceil(this.length / 8));
                    bytes = new Uint8Array(buffer);
                    bit_offset = 0;
                    byte_position = 0;
                    for (i = 0; i <  results.length; i += 1) {
                        for (j = 0; j < results[i].value.length; j += 1) {
                            if (bit_offset === 0) {
                                // No bit offset so copy byte over straight
                                bytes[byte_position] = results[i].value[j];
                            } else {
                                // Take account of bit offset when copying byte over
                                bytes[byte_position] = bytes[byte_position] | results[i].value[j] >> bit_offset;
                                if (byte_position + 1 < bytes.length) {
                                    bytes[byte_position + 1] = results[i].value[j] & bit_offset;
                                }
                            }
                            byte_position += 1;
                        }
                        bit_offset = (bit_offset + results[i].length) % 8;
                    }
                    return buffer;
                },
                length: 0
            };
        };
    }

    if (typeof bitratchet.number !== 'function') {
        (function () {
            // Helper functions for working with numbers
            function binary_to_number(bytes, bit_count, signed) {
                var i, byte_count, number;
                byte_count = Math.ceil(bit_count / 8);
                for (i = 0; i < byte_count; i += 1) {
                    if (i === 0) {
                        // Last byte
                        if (bit_count % 8 === 0) {
                            // No spare bits
                            number = bytes[byte_count - 1];
                        } else {
                            // Spare bits, mask them
                            number = bytes[byte_count - 1] & Math.pow(2, bit_count % 8) - 1;
                        }
                    } else {
                        // Shift other bytes off
                        number += bytes[byte_count - i - 1] * Math.pow(2, i * 8);
                    }
                }
                if (signed && number > Math.pow(2, bit_count - 1)) {
                    return -(number - Math.pow(2, bit_count - 1));
                } else {
                    return number >>> 0;
                }
            }
            function number_to_binary(number, bit_count) {
                var signed, bits_used, current_byte, i, buffer = new ArrayBuffer(Math.ceil(bit_count / 8)),
                    bytes = new Uint8Array(buffer);
                // Take note of signing then clear it
                signed = number < 0;
                number = Math.abs(number);
                // Loop through bytes
                for (i = 0; i < bytes.length; i += 1) {
                    current_byte = bytes.length - i - 1;
                    if (current_byte === 0) {
                        // For most significant byte mask unused bits and make sure sign bit is high for negative numbers
                        bits_used = bit_count % 8 || 8;
                        bytes[0] = (number / Math.pow(2, i * 8)) & (Math.pow(2, bits_used) - 1) | (signed ? Math.pow(2, bits_used - 1) : 0);
                    } else {
                        // For other bytes just shift along
                        bytes[current_byte] = number / Math.pow(2, i * 8) & 0xff;
                    }
                }
                return buffer;
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
                        data = new Uint8Array(data);
                        return round_number(binary_to_number(data, options.length, options.signed) * scale(options), options.precision);
                    },
                    unparse : function (data) {
                        return number_to_binary(Math.round(data / scale(options)), options.length);
                    },
                    length: options.length
                };
            };
        }());
    }

    if (typeof bitratchet.lookup !== 'function') {
        bitratchet.lookup = function lookup(options) {
            return {
                parse : function (data) {
                    var index = options.type.parse(data);
                    if (options.table.hasOwnProperty(index)) {
                        return options.table[index];
                    }
                },
                unparse : function (data) {
                    var index, result;
                    index = a_index(options.table, data);
                    index = index > -1 ? index : a_index(options.table, options.missing);
                    if (index > -1) {
                        result = options.type.unparse(index);
                        this.length = options.type.length;
                        return result;
                    }
                    if (options.type.length === 0) {
                        // Result was missing and lookup type is dynamic so we can't
                        // know what the length should be. Throw an exception.
                        throw "Lookup can't handle missing values when unparsing if the type is dynamic!";
                    }
                    return 0;
                },
                length : options.type.length
            };
        };
    }

    if (typeof bitratchet.flags !== 'function') {
        bitratchet.flags = function flags(options) {
            function current_byte(i) {
                return Math.floor(i / 8);
            }
            function current_bit(i) {
                return 7 - i % 8;
            }
            return {
                parse : function (data) {
                    var i, results = {};
                    data = new Uint8Array(data);
                    // Next assemble the result
                    for (i = 0; i < options.length; i += 1) {
                        if (options.flags[i]) {
                            // Select correct byte, then bit and use it to add result value
                            results[options.flags[i]] = options.values[data[current_byte(i)] >> current_bit(i) & 1];
                        }
                    }
                    return results;
                },
                unparse : function (data) {
                    var i, buffer = new ArrayBuffer(Math.ceil(options.length / 8)),
                        bytes = new Uint8Array(buffer);
                    // Work through flags ORing their values onto relevant byte
                    for (i = 0; i < options.flags.length; i += 1) {
                        if (options.flags[i]) {
                            bytes[current_byte(i)] = bytes[current_byte(i)] | (a_index(options.values, data[options.flags[i]]) << current_bit(i));
                        }
                    }
                    return buffer;
                },
                length : options.length
            };
        };
    }

    if (typeof bitratchet.dynamic !== 'function') {
        bitratchet.dynamic = function dynamic(f) {
            return {
                parse : function (data, record) {
                    var result, field = f(record);
                    if (field) {
                        result = field.parse(data);
                        this.length = field.length;
                        return result;
                    } else {
                        this.length = 0;
                    }
                },
                unparse : function (data, record) {
                    var result, field = f(record);
                    if (field) {
                        result = field.unparse(data);
                        this.length = field.length;
                        return result;
                    } else {
                        this.length = 0;
                    }
                },
                length: 0
            };
        };
    }


    if (typeof bitratchet.skip !== 'function') {
        bitratchet.skip = function skip(options) {
            return {
                parse : function (data) {
                    return undefined;
                },
                unparse : function (data) {
                    return undefined;
                },
                length : options.length
            };
        };
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
                    data = new Uint8Array(data);
                    // Make sure we've been given enough data
                    if (data.length * 8 > options.length + 4) {
                        throw "Wrong amount of data given to parse to hex";
                    }
                    // Parse to hex
                    for (i = 0; i < data.length; i += 1) {
                        if (i * 8 > options.length - 8) {
                            // If we're on last nibble ignore extra nibble
                            hex += (data[i] >> 4).toString(16)
                        } else {
                            // Otherwise add full padded byte
                            if (data[i] < 0x10) {
                                hex += "0";
                            }
                            hex += data[i].toString(16);
                        }
                    }
                    return hex;
                },
                unparse : function (data) {
                    if (!/^[0-9a-fA-F]+$/.test(data)) {
                        throw "Invalid hex, can't unparse.";
                    }
                    var i, buffer = new ArrayBuffer(Math.ceil(options.length / 8)),
                        bytes = new Uint8Array(buffer);
                    // Chunk hex
                    data = data.match(/.{1,2}/g);
                    // Convert to byte array
                    for (i = 0; i < bytes.length; i += 1) {
                        if (i * 8 > options.length - 8) {
                            bytes[i] = parseInt(data[i], 16) & 0xf0;
                        } else {
                            bytes[i] = parseInt(data[i], 16);
                        }
                    }
                    return buffer;
                },
                length : options.length
            };
        };
    }
}());