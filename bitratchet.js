/*global ArrayBuffer, Uint8Array*/
/*jslint bitwise: true, regexp: true, indent: 4*/

var bitratchet;
if (!bitratchet) {
    bitratchet = {};
}

(function () {
    "use strict";

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
                    position_offset = position % 8, length_offset;
                if (length === 0) {
                    // No length so just move bytes on to account for position offset
                    bytes = bytes.subarray(position / 8);
                    shifted_buffer = new ArrayBuffer(bytes.length);
                    shifted_bytes = new Uint8Array(shifted_buffer);
                    // First move MSB to right position
                    shifted_bytes[0] = (bytes[0] << position_offset) & 0xff;
                    // Now move on the rest
                    for (i = 1; i < bytes.length; i += 1) {
                        shifted_bytes[i - 1] = shifted_bytes[i - 1] | (bytes[i] >> (8 - position_offset));
                        shifted_bytes[i] = (bytes[i] << position_offset) & 0xff;
                    }
                } else {
                    // There's a length so we can do all the work for them :)
                    length_offset = length % 8;
                    bytes = bytes.subarray(position / 8,
                                           position / 8 + Math.ceil((length + length_offset + position_offset) / 8));
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
                }
                return shifted_buffer;
            }
            function assemble_data(fields, length) {
                var i, j, over_spill,
                    buffer = new ArrayBuffer(Math.ceil(length / 8)),
                    bytes = new Uint8Array(buffer), byte_position = 0, bit_position = 8 - (length % 8 || 8);

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
                        over_spill = (length + bit_position) - 8;
                        bytes[byte_position] = bytes[byte_position] | (value >> over_spill);
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
                parse : function (data, store) {
                    var result = {}, position = 0;
                    // For convenience allow hex strings too
                    if (typeof data === 'string') {
                        data = bitratchet.hex({ length : 4 * data.length }).unparse(data);
                    }
                    // Convert ArrayBuffer to int array for processing and begin
                    map_fields(function (k, v) {
                        var field, field_store;
                        if (typeof v === 'function') {
                            // For dynamic fields first figure out what our primitive is
                            v = v(result);
                        }
                        if (v) {
                            if (v.hasOwnProperty('parse')) {
                                // It's a primitive so parse the data
                                if (v.length) {
                                    // Static field, parse normally
                                    field = v.parse(shift_bytes(data, position, v.length));
                                    position += v.length;
                                } else {
                                    // Dynamic field, parse and take note of length
                                    field_store = {};
                                    field = v.parse(shift_bytes(data, position, 0), field_store);
                                    position += field_store.length;
                                }
                            } else {
                                // Result was given instead of primitive, just use that
                                field = v;
                            }
                            // If field isn't undefined add it to the results
                            if (field !== undefined) {
                                result[k] = field;
                            }
                        }
                    });
                    if (store) {
                        store.length = position;
                    }
                    return result;
                },
                unparse : function (data, store) {
                    var fields = [], field, field_store, field_length, record_length = 0;
                    // First parse each part collecting the result and it's length
                    map_fields(function (k, v) {
                        if (typeof v === 'function') {
                            v = v(data);
                        }
                        if (v && v.hasOwnProperty('unparse')) {
                            if (v.length) {
                                // Static field
                                field = v.unparse(data[k]);
                                field_length = v.length;
                            } else {
                                // Dynamic field
                                field_store = {};
                                field = v.unparse(data[k], field_store);
                                field_length = field_store.length;
                            }
                            if (field === undefined) {
                                // We're skipping data as we have a length but no value - zero it
                                fields.push({ value : new Uint8Array(new ArrayBuffer(Math.ceil(field_length / 8))),
                                               length : field_length });
                            } else {
                                // We have data, add it
                                fields.push({ value : new Uint8Array(field), length : field_length });
                            }
                            // Either way increase our overall length
                            record_length += field_length;
                        }
                    });
                    // Now put all those fields into an ArrayBuffer and return
                    if (store) {
                        store.length = record_length;
                    }
                    return assemble_data(fields, record_length);
                }
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
                var i, negative, buffer = new ArrayBuffer(Math.ceil(bit_count / 8)),
                    bytes = new Uint8Array(buffer);
                // Deal with negative numbers
                if (number < 0) {
                    number = Math.abs(number);
                    negative = true;
                }
                // Loop through other bytes
                for (i = 0; i < bytes.length; i += 1) {
                    bytes[bytes.length - 1 - i] = number / Math.pow(2, i * 8) & 0xff;
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

    if (typeof bitratchet.string !== 'function') {
        (function () {
            bitratchet.string = function string(options) {
                // Helper functions
                function buffer_to_string(buffer) {
                    var i, chars = [], bytes = new Uint8Array(buffer);
                    // Convert byte-array to array of character strings
                    for (i = 0; i < bytes.length; i += 1) {
                        chars[i] = String.fromCharCode(bytes[i]);
                    }
                    // Join characters into a single string and return
                    return chars.join("");
                }
                function string_to_buffer(s, length) {
                    var i, buffer = new ArrayBuffer(length),
                        bytes = new Uint8Array(buffer);

                    for (i = 0; i < bytes.length; i += 1) {
                        bytes[i] = s.charCodeAt(i);
                    }
                    return buffer;
                }
                // Validate options
                if (options.length && options.length % 8) {
                    throw "Invalid length, must be divisible by 8.";
                }
                if (!options.length && options.terminator === undefined && !options.pascal) {
                    throw "String needs either a length, terminating character or to be a pascal string.";
                }
                if (options.pascal && (options.terminator !== undefined || options.length)) {
                    throw "Pascal strings don't support the other options.";
                }
                if (options.read_full_length && !(options.terminator !== undefined && options.length)) {
                    throw "read_full_length option required both length and terminator options.";
                }
                // Return the string primitive
                return {
                    parse : function (data, store) {
                        var end, result, length_hit = false;
                        // Convert buffer to string
                        result = buffer_to_string(data);
                        // Firstly deal with pascal strings
                        if (options.pascal) {
                            if (store) {
                                store.length = (result.charCodeAt(0) + 1) * 8;
                            }
                            return result.substr(1, result.charCodeAt(0));
                        }
                        // If string is of static length we can return
                        if (this.length) {
                            if (options.terminator !== undefined) {
                                end = result.search(String.fromCharCode(options.terminator));
                            }
                            if (options.terminator !== undefined && end > -1) {
                                return result.substr(0, end + 1);
                            } else {
                                return result.substr(0, options.length / 8);
                            }
                        }
                        // Otherwise we need to figure out its length
                        end = result.search(String.fromCharCode(options.terminator));
                        if (end === -1) {
                            if (options.length) {
                                end = options.length / 8;
                            } else {
                                throw "Unterminated string, provide a length.";
                            }
                        } else if (end > options.length / 8) {
                            end = options.length / 8;
                            length_hit = true;
                        }
                        if (store) {
                            store.length = (options.read_full_length || length_hit) ? options.length : (end + 1) * 8;
                        }
                        // Then read it as normal
                        return result.substr(0, end);
                    },
                    unparse : function (data, store) {
                        var buffer;
                        // First handle pascal strings
                        if (options.pascal) {
                            data = String.fromCharCode(data.length) + data;
                            if (store) {
                                store.length = data.length * 8;
                            }
                            return string_to_buffer(data, data.length);
                        }

                        // Next make sure string is terminated if it should be
                        if (options.terminator !== undefined &&
                                (!options.length || data.length * 8 < options.length) &&
                                data.search(String.fromCharCode(options.terminator)) === -1) {
                            data += String.fromCharCode(options.terminator);
                        }
                        // Convert to buffer
                        buffer = string_to_buffer(data, this.length / 8 ||
                                                  data.search(String.fromCharCode(options.terminator)) + 1 ||
                                                  options.length / 8);
                        // Take note of length
                        if (!this.length && store) {
                            store.length = buffer.byteLength * 8;
                        }
                        // and return
                        return buffer;
                    },
                    length : (function () {
                        if (options.length && (options.terminator === undefined || options.read_full_length)) {
                            return options.length;
                        }
                    }())
                };
            };
        }());
    }

    if (typeof bitratchet.lookup !== 'function') {
        bitratchet.lookup = function lookup(options) {
            function value_index(o, value, missing_value) {
                var key, missing_key, found;
                for (key in o) {
                    if (o.hasOwnProperty(key)) {
                        if (o[key] === value) {
                            return { index : key, found : true};
                        }
                        if (o[key] === missing_value) {
                            missing_key = key;
                            found = true;
                        }
                    }
                }
                return { index : missing_key, found : found};
            }
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
                    var result, find_result;
                    find_result = value_index(options.table, data, options.missing);
                    if (find_result.found) {
                        result = options.type.unparse(find_result.index);
                        this.length = options.type.length;
                        return result;
                    } else {
                        // We couldn't find value given in lookup table
                        throw "Value given not in lookup-table.";
                    }
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
            function a_index(a, item) {
                var i;
                for (i = 0; i < a.length; i += 1) {
                    if (a[i] === item) {
                        return i;
                    }
                }
                return -1;
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
                    if (options.length > data.length * 8) {
                        throw "Too little data given to parse to hex.";
                    }
                    // Parse all bytes to hex
                    for (i = 0; i < data.length; i += 1) {
                        if (data[i] < 0x10) {
                            hex += "0";
                        }
                        hex += data[i].toString(16);
                    }
                    // Return right amount of the hex
                    return hex.substr(hex.length - options.length / 4);
                },
                unparse : function (data) {
                    if (!/^[0-9a-fA-F]+$/.test(data)) {
                        throw "Invalid hex, can't unparse.";
                    }
                    var i, buffer = new ArrayBuffer(Math.ceil(options.length / 8)),
                        bytes = new Uint8Array(buffer);
                    // Chunk hex
                    if (data.length % 2) {
                        data = '0' + data;
                    }
                    data = data.match(/.{1,2}/g);
                    // Convert to byte array
                    for (i = 0; i < bytes.length; i += 1) {
                        bytes[i] = parseInt(data[i], 16);
                    }
                    // Mask spare nibble if we have one
                    if (options.length % 8) {
                        bytes[0] = bytes[0] & 0xf;
                    }
                    // Return
                    return buffer;
                },
                length : options.length
            };
        };
    }
}());