bitratchet-js
=============

This library is work in progress, don't attempt to use it yet. - Dave
---------------------------------------------------------------------

A Javascript library for processing binary data, similar to [BinData for Ruby](http://bindata.rubyforge.org/) and taking ideas from my earlier (much more limited) [BitRatchet PHP library](https://github.com/kzar/bit-ratchet).

Makes use of the [new ArrayBuffer feature](https://github.com/kzar/bit-ratchet) in Javascript and allows for simple (yet flexible) parsing and "unparsing" of binary data.
Features include:

 - Avoid duplicate code, you only have to specify records once as with [BinData](http://bindata.rubyforge.org/). (Normally you end up writing double the code when you need to generate messages as well as read them.)
 - Deal transparently with bit (as opposed to byte) based fields, shifting is completely taken care of - as with the [PHP BitRatchet library](https://github.com/kzar/bit-ratchet).
 - Handle dynamic fields that can vary in length and structure based on any context of the data already parsed. (Fields can even vary in length based on their own value but shifting is no longer handled automatically in that one, extreme situation.)
 - Build your own flexible primitives that can extend the library to your problem domain. They can fully leverage the provided primitives.

Developed to help implement a commercial telematics messaging protocol in Javascript.

Usage
-----

Make sure you're importing the bitratchet library:

      <script src="js/bitratchet.js" type="text/javascript"></script>

For now look at the tests to see how it works, sorry I'll document more soon.

Primitives
----------

Primitives are used to parse individual fields, often they are provided by a function that takes some options and returns the primitive object.
The primitive object must follow these rules:

 - It must contain a `parse` field containing a function that expects data in a ArrayBuffer and returns the parsed information.
 - It must contain an `unparse` field containing a function that accepts the parsed information and returns an ArrayBuffer with the unparsed data.
 - It should contain a length field containing a number specifying - in bits - how large the primitive is. If the length field is omitted the primitive is considered of dynmaic length.
 - Dynamic length primitives are only necessary when the primitive's length varies depending on _its own value_. They are only necessary for records and other advanced situations. The dynamic primitives `parse` and `unparse` functions must accept an optional second parameter called store and they must populate the store object - if given - with a bit length after processing the data. Dynamic length fields also have to deal with extra data and don't get as much help with putting their data into the right position.
 - If the primitive's length is not divisible by 8 the parse function should ignore any extra bits (left at the MSB end of the first and MSB byte) and the unparse function should take care to zero them.
 - If the primitive is created with invalid options, or used with invalid data an exception should be thrown.

Included primitives:

 - `number` can be used for most types of numbers. It handles signed / unsigned, scaled / integer and rounding.

      Expects an options object that can contain the following options:
      {
        length : Length of the number in bits, this is required.
        signed : Is the number signed? (Default is false.)
        precision : Decimal place precision to round to. (Default is no rounding.)
        scale_range : If the number is scaled to a range provide the range. (The same as providing a custom_scale of Math.pow(2, options.length) / options.scale_range)
        custom_scale : If the number is scaled inefficiently you can directly provide the scale.
      }

 - `record` a really important primitive used to group primitives, detailed in it's own section below.
 - `flags` a useful primitive for handling bit flags, you provide an array of flag names and values an object is given in return. __Note that skipped bits are left low when unparsed.__

      Expected options:
      {
        length : Length in bits of raw data.
        flags : Array of flags, falsey to skip / ignore, e.g. ["blue", 0, "red", "yellow"], should be of same length as length option above.
        values : Array of values, for example ["false", "true"] or ["off", "on"]
      }

 - `dynamic` a flexible primitive that just expects a function. The function given must return another primitive and can make use of the previously read fields in a record and the data.

      Expected options:
      function that returns a primitive based on the context.

 - `hex` a simple primitive to read and return hex. Can't work more granulary than nibbles for obvious reasons. (As always there are no limitations stopping you reading over byte boundaries however.)

      Expected options:
      {
        length : Length of hex to read in bits, must be divisible by 4.
      }

 - Lookup - a simple primitive you can use to parse "lookup table" entries, it accepts a data type (should be number), table array of values and optionally a missing value for situations where the table doesn't contain the value provided.

      Expected options:
      {
        type : Primitive used to parse the lookup index, should be a number
        table : Array of values, table[type.parse(data)] is used to parse a value
        missing : Default value when table doesn't contain given index. Note - must be present in table
      }

 - String - a primitive you can use to deal with strings contained within the binary data. Fixed length and character dynamic length charater terminated strings are supported.

      Expected options:
      {
        length : Length of the string in bits, must be divisible by 8! If terminator option isn't present this is required, otherwise it's optional.
        terminator : ASCII character code (as integer) for the terminating character, required if length option isn't present. (Length will include terminating character if relevant.)
        read_full_length : If length and terminator options are present this option modifies the behavoir. If `true` the full length of the string will be read, just the extra characters past the terminating character dropped. If `false` and we read the terminating character before reaching the length the remaining data wont be skipped. If `false` and we read 'till the end of length the behavoir is as normal.
      }

Records
-------

Records are used to group primitves together, but they are actually are primitives too and follow all the rules that primitives follow. Even so records are a powerful tool, they can be nested and take care of all the bit shifting.

Records are created with a structure object, for example:

      Example showing nesting and bit-shifting:

      bitratchet.record({
        num : bitratchet.number({ length : 7 }),
        stuff : bitratchet.record({
          hex({ length : 4 }),
          number({ length : 2})
        }),
        hex : bitratchet.hex({ length : 8 })
     });

 - Each field's value should either be a primitive or a function that takes the current record context and returns one.
 - During parsing if a primitive returns `undefined` it's data will be skipped.
 - During parsing if a primitive returns anything else without the `parse` property the value returned will be used for the field.

Note - for convenience record.parse can accept a hex string instead of a proper ArrayBuffer of data.

License
-------
Copyright Dave Barker 2012

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.