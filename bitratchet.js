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
            function shift_bytes(buffer, position, length) {
                var shifted_buffer, shifted_bytes, i, bytes = new Uint8Array(buffer),
                    position_offset = position % 8, length_offset = length % 8;
                // First create a view on the bytes we need
                if (length === 0) {
                    bytes = bytes.subarray(position / 8);
                } else {
                    bytes = bytes.subarray(position / 8,
                                           position / 8 + Math.ceil((length + length_offset + position_offset) / 8));
                }
                shifted_buffer = new ArrayBuffer(Math.ceil(length / 8));
                shifted_bytes = new Uint8Array(shifted_buffer);

                if (length_offset) {
                    // Handle MSB
                    shifted_bytes[0] = (bytes[0] >> (8 - length_offset - position_offset)) & (Math.pow(2, length_offset) - 1);
                    // Shift the rest
                    for (i = 1; i < shifted_bytes.length; i += 1) {
                        shifted_bytes[i] = ((bytes[i - 1] << (length_offset + position_offset)) & 0xff) | (bytes[i] >> (8 - position_offset - length_offset));
                    }
                } else if (position_offset) {
                    for (i = 0; i < shifted_bytes.length; i += 1) {
                        shifted_bytes[i] = ((bytes[i] << (length_offset + position_offset)) & 0xff) | (bytes[i + 1] >> (8 - position_offset - length_offset));
                    }
                } else {
                    // No offset, we can just copy bytes over
                    for (i = 0; i < shifted_bytes.length; i += 1) {
                        shifted_bytes[i] = bytes[i];
                    }
                }
                return shifted_buffer;
            }
            function assemble_data(fields, length) {
                var buffer = new ArrayBuffer(Math.ceil(length / 8)),
                    bytes = new Uint8Array(buffer), i, j, over_spill,
                    byte_position = 0, bit_position = length % 8;

                function add_bits(value, length) {
                    // Default to 8 bits for convenience
                    if (length === undefined) {
                        length = 8;
                    }
                    // Mask any excess data
                    value = value & (Math.pow(2, length) - 1);
                    // Add the value on to our byte array
                    if (bit_position + length <= 8) {
                        // We can fit value into current byte
                        bytes[byte_position] = bytes[byte_position] | (value << (8 - bit_position - length));
                        bit_position += length;
                    } else {
                        // We need to spill over onto next byte
                        over_spill = (length + bit_position) - 8
                        bytes[byte_position] = bytes[byte_position] | (value >> bit_position);
                        bytes[byte_position + 1] = (value << (8 - over_spill)) & 0xff;
                        byte_position += 1;
                        bit_position = over_spill;
                    }
                    // Finally move byte on if we've just finished it
                    if (bit_position === 8) {
                        bit_position = 0;
                        byte_position += 1;
                    }
                }
                for (i = 0; i < fields.length; i += 1) {
                    add_bits(fields[i].value[0], (fields[i].length % 8 || 8));
                    for (j = 1; j < fields[i].value.length; j += 1) {
                        add_bits(fields[i].value[j]);
                    }
                }
                return buffer;
            }

            return {
                parse : function (data) {
                    var result = {}, position = 0, bytes;
                    // For convenience allow hex strings too
                    if (typeof data === 'string') {
                        data = bitratchet.hex({ length : 4 * data.length }).unparse(data);
                    }
                    // Convert ArrayBuffer to int array for processing and begin
                    map_fields(function (k, v) {
                        var byte_offset, bit_offset, spare_bits, shifted_data, shifted_buffer, i, field;
                        if (typeof v === 'function') {
                            // For dynamic fields first figure out what our primitive is
                            v = v(result);
                        }
                        if (v) {
                            if (v.hasOwnProperty('parse')) {
                                // It's a primitive so parse the data
                                field = v.parse(shift_bytes(data, position, v.length));
                            } else {
                                // Result was given instead of primitive, just use that
                                field = v;
                            }
                            // If field isn't undefined add it to the results
                            if (field !== undefined) {
                                result[k] = field;
                            }
                            position += v.length;
                        }
                    });
                    this.length = position;
                    return result;
                },
                unparse : function (data) {
                    var results = [], bytes, buffer, byte_position, bit_offset, that, i, j, field;
                    // First parse each part collecting the result and it's length
                    this.length = 0;
                    that = this;
                    map_fields(function (k, v) {
                        if (typeof v === 'function') {
                            v = v(data);
                        }
                        if (v) {
                            if (v.hasOwnProperty('unparse')) {
                                field = v.unparse(data[k])
                            } else {
                                field = v;
                            }
                            if (field !== undefined) {
                                results.push({ value : new Uint8Array(field), length : v.length });
                            }
                            that.length += v.length;
                        }
                    });
                    // Now put all those results into an ArrayBuffer and return
                    return assemble_data(results, this.length);
                },
                length: 0
            };
        };
    }

    if (typeof bitratchet.number !== 'function') {
        (function () {
            // Helper functions for working with numbers
            function bits_used(bit_count) {
                return (bit_count % 8 || 8);
            }
            function twos_compliment(bytes) {
                var i, carry = 1;
                // Perform two's compliment
                for (i = bytes.length - 1; i >= 0; i -= 1) {
                    bytes[i] = ~bytes[i] & 0xff;
                    if (carry) {
                        if (bytes[i] < 255) {
                            bytes[i] += carry;
                            carry = 0;
                        } else {
                            bytes[i] = 0;
                            carry = 1;
                        }
                    }

                }
                return bytes;
            }
            function binary_to_number(bytes, bit_count, signed) {
                var i, number, negative;
                number = 0;
                // If number's signed run twos_compliment on binary before we start
                if (signed && (bytes[0] & Math.pow(2, bits_used(bit_count) - 1))) {
                    twos_compliment(bytes, bit_count);
                    negative = true;
                }
                // Mask any extra bits
                bytes[0] = bytes[0] & (Math.pow(2, bits_used(bit_count)) - 1);
                // Shift bytes onto our number
                for (i = 0; i < bytes.length; i += 1) {
                    number += bytes[bytes.length - i - 1] * Math.pow(2, i * 8);
                }
                // Finally add correct sign and return
                return negative ? -number : number;
            }
            function number_to_binary(number, bit_count) {
                var signed, i, negative, buffer = new ArrayBuffer(Math.ceil(bit_count / 8)),
                    bytes = new Uint8Array(buffer);
                // Deal with negative numbers
                if (number < 0) {
                    number = Math.abs(number);
                    negative = true;
                }
                // Loop through other bytes
                for (i = 0; i < bytes.length; i += 1) {
                    bytes[bytes.length - 1 - i] = number / Math.pow(2, i * 8) & 0xff
                }
                // Sign number if it's negative
                if (negative) {
                    twos_compliment(bytes, bit_count);
                }
                // Mask any extra bits and return
                bytes[0] = bytes[0] & (Math.pow(2, bits_used(bit_count)) - 1);
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
                        var copy;
                        // Create a view on the bytes we care about
                        data = (new Uint8Array(data)).subarray(0, Math.ceil(options.length / 8));
                        // Copy the data to avoid corrupting what was given to us
                        // FIXME is this really necessary?
                        copy = new Uint8Array(new ArrayBuffer(data.length));
                        copy.set(data);
                        // And parse
                        return round_number(binary_to_number(copy, options.length, options.signed) * scale(options), options.precision);
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
                    } else {
                        return options.missing;
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

    if (typeof bitratchet.skip !== 'function') {
        bitratchet.skip = function skip(options) {
            return {
                parse : function () { },
                unparse : function () { },
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
                            hex += (data[i] >> 4).toString(16);
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