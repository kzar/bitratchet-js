bitratchet-js
=============

A Javascript library for processing binary data, similar to [BinData for Ruby](http://bindata.rubyforge.org/) and taking ideas from my earlier (much more limited) [BitRatchet PHP library](https://github.com/kzar/bit-ratchet).

Makes use of the [new ArrayBuffer feature](https://github.com/kzar/bit-ratchet) in Javascript and allows for simple (yet flexible) parsing and "unparsing" of binary data.
Features include:

 - Avoid duplicate code, you only have to specify records once as with [BinData](http://bindata.rubyforge.org/). (Normally you end up writing double the code when you need to generate messages as well as read them.)
 - Deal transparently with bit (as opposed to byte) based fields, shifting is completely taken care of - as with the [PHP BitRatchet library](https://github.com/kzar/bit-ratchet).
 - Handle dynamic fields that can vary in length and structure based on any context of the data already parsed and external state.
 - Build your own flexible primitives that can extend the library to your problem domain. They can fully leverage the provided primitives.

Developed to help implement a commercial telematics messaging protocol in Javascript.

Status
------

I'm happy with the interface, it's flexible enough to do everything I've needed to do. There's a fairly comprehensive test suite which is all passing, JSLint passes as well. The internal workings of the included primitives are fairly messy though and could do with a good tidy. Also I'm looking to add a lot more validation, currently little is performed. I would like to have a tool like [buildr](https://github.com/balupton/buildr.npm) set up to speed up development. Lastly although there is a fair amount of documentation it certainly needs work and I would like to add some more worked examples.

TL;DR - Consider this an initial release.

Setup
-----

If you just want to use bitratchet you can simply make sure the latest file is included:

      <script src="js/bitratchet-x.x.x-min.js" type="text/javascript"></script>

and you can run the tests in the browser, open `test/bitratchet-test.html`.

You can also require bitratchet from [node.js](http://nodejs.org/):

      bitratchet = require("js/bitratchet-x.x.x-min");
      console.log(bitratchet.version);

If you have the [node-qunit port](https://github.com/kof/node-qunit) you can run the tests from the command line:

      sudo npm install -g quint
      qunit -c bitratchet:./bitratchet.js -t ./test/bitratchet-test.js
      qunit -c bitratchet:./bitratchet-x.x.x-min.js -t ./test/bitratchet-test.js

Finally you can roll your own minified version using [the uglify tool](https://github.com/mishoo/UglifyJS):

      sudo npm install -g uglify-js
      uglifyjs bitratchet.js > bitratchet-x.x.x-min.js

(I would like to use [buildr](https://github.com/balupton/buildr.npm) or something similar to automate this stuff but I've had no luck getting any of them working. If you're good with this stuff send a pull request!)

Usage
-----

Using bitratchet is dead simple, generally you'll have a record defined somewhere that follows the specification of the binary format you need to deal with. Then it's as easy as passing an ArrayBuffer to the parse function of your record. Generating data is as simple as passing the message / file / whatever object to your record's unparse function.

Here's a worked example, supposing your dealing with a very simple messaging protocol:

<table>
  <tr>
    <th>Field name</th><th>Field type</th><th>Length</th><th>Description</th>
  </tr><tr>
    <td>sequence</td><td>Unsigned Integer</td><td>Word (16 bits)</td><td>Sequence number for the message.</td>
  </tr><tr>
    <td>sender</td><td>IP Address</td><td>Long (32 bits)</td><td>IP address of the message sender.</td>
  </tr><tr>
    <td>length</td><td>Unsigned Integer</td><td>Byte (8 bits)</td><td>Total (byte) length of the text.</td>
  </tr><tr>
    <td>text</td><td>String</td><td>Variable depending on length field</td><td>Actual text of the message.</td>
  </tr>
</table>

We could implement our message record like this:

      function ip_address() {
          return {
              parse : function (data) {
                  var i, ip = "", bytes = new Uint8Array(data);
                  for (i = 0; i < bytes.length; i += 1) {
                      ip += bytes[i].toString(10) + ".";
                  }
                  return ip.slice(0, -1);
              },
              unparse : function (data) {
                  return bitratchet.hex({ length : 8 * 4 }).unparse(data.replace(/\./g, ""));
              },
              length : 8 * 4,
          };
      }

      message = bitratchet.record({
          sequence : bitratchet.number({ length : 8 * 2 }),
          sender : ip_address(),
          text : bitratchet.string({ pascal : true })
      });

... and then supposing we had an ArrayBuffer containing a message, we could parse it like so:

      message.parse(arraybuffer).data;

Finally to generate a new message we could do this:

      message.unparse({ sequence : 3, sender : "127.0.0.1", text : "Hello world!" }).data;

(Notice that we've referred to the data key of the result each time, that's because as a dynamic primitive `bitratchet.record` returns an object containing the result length and result data.)

Now that example is very simple, it omits most of the powerful functionality provided but hopefully it gives you somewhere to start. If you're interested in seeing more complicated usage have a look in the tests `test/bitratchet-test.js`, you should be able to find an example of every feature there.

Primitives
----------

Primitives are used to parse individual fields, often they are provided by a function that takes some options and returns the primitive object. Bitratchet consists of 6 commonly used primitives that handle the meat of the work. You're then free to add your own (detailed below in the Extending section) domain specific ones.

Primitive objects must follow these rules:

 - It must contain a `parse` field containing a function that expects data in a ArrayBuffer and returns the parsed information.
 - It must contain an `unparse` field containing a function that accepts the parsed information and returns an ArrayBuffer with the unparsed data.
 - Parse and unparse functions are passed three extra parameters, `external_state`, `record_context` and `parent_field_name`. `external_state` is an object containing any external state needed to parse / unparse the data, `record_context` is an object containing the parsed / unparsed data so far. `parent_field_name` is used by the record primitive to assemble the `record_context` on the fly and can be safely ignored.
 - It should contain a `missing` field - usually just set to `options.missing` - that contains the default value to use. If the `missing` field contains a function it will be called with the `external_state` and `record_context` to determine the default value. If the `missing` field isn't present and a value isn't given an exception will be thrown.
 - It should contain a length field containing a number specifying - in bits - how large the primitive is. If the length field is omitted the primitive is considered of dynamic length.
 - Dynamic length primitives are only necessary when the primitive's length varies depending on _its own value_. They are only necessary for records and other advanced situations. The dynamic primitives `parse` and `unparse` functions must return an object containing the data and bit length like so: `{ data : ..., length : ... }` instead of just the data. Dynamic length fields also have to deal with shifting extra data manually.
 - If the primitive's length is not divisible by 8 the parse function should ignore any extra bits (which will be positioned at the MSB end of the first and MSB byte).
 - If the primitive is created with invalid options, or used with invalid data an exception should be thrown.

Included primitives:

 - `number` can be used for most types of numbers. It handles signed / unsigned, scaled / integer and rounding.

<!-- Break list -->

      Expects an options object that can contain the following options:
      {
        length : Length of the number in bits, this is required.
        signed : Is the number signed? (Default is false.)
        precision : Decimal place precision to round to. (Default is no rounding.)
        scale_range : If the number is scaled to a range provide the range. (The same as providing a custom_scale of Math.pow(2, options.length) / options.scale_range)
        custom_scale : If the number is scaled inefficiently you can directly provide the scale.
        missing : Default value or function to calculate default value given context.
      }

 - `record` a really important primitive used to group primitives, detailed in it's own section below.
 - `flags` a useful primitive for handling bit flags, you provide an array of flag names and values an object is given in return. __Note that skipped bits are left low when unparsed.__

<!-- Break list -->

      Expected options:
      {
        length : Length in bits of raw data.
        flags : Array of flags, falsey to skip / ignore, e.g. ["blue", 0, "red", "yellow"], should be of same length as length option above.
        values : Array of values, for example ["false", "true"] or ["off", "on"]. (Can also be a two-dimensional array if each field needs a different value, e.g. [["false", "true"], ["off", "on"]].)
        missing : Default value or function to calculate default value given context.
      }

 - `hex` a simple primitive to read and return hex. Can't work with more granularity than nibbles for obvious reasons. (As always there are no limitations stopping you reading over byte boundaries however.)

<!-- Break list -->

      Expected options:
      {
        length : Length of hex to read in bits, must be divisible by 4.
        missing : Default value or function to calculate default value given context.
      }

 - `lookup` - a simple primitive you can use to parse "lookup table" entries, it accepts a data type (should be number), table array of values and optionally a missing value for situations where the table doesn't contain the value provided.

<!-- Break list -->

      Expected options:
      {
        type : Primitive used to parse the lookup index, should be a number
        table : Array of values, table[type.parse(data)] is used to parse a value
        missing : Default value or function to calculate default value given context.
      }

 - `string` - a primitive you can use to deal with strings contained within the binary data. Fixed length, pascal strings and character dynamic length character terminated strings are supported.

<!-- Break list -->

      Expected options:
      {
        length : Length of the string in bits, must be divisible by 8! If terminator option isn't present this is required, otherwise it's optional.
        terminator : ASCII character code (as integer) for the terminating character, required if length option isn't present. (Length will include terminating character if relevant.)
        read_full_length : If length and terminator options are present this option modifies the behavior. If `true` the full length of the string will be read, just the extra characters past the terminating character dropped. If `false` and we read the terminating character before reaching the length the remaining data wont be skipped. If `false` and we read 'till the end of length the behavior is as normal.
        pascal : Used to read pascal strings where the first byte is the length of the following string. Can't be used with the previous options.
        missing : Default value or function to calculate default value given context.
      }

Records
-------

Records are used to group primitives together, but they are actually are primitives too and follow all the rules that primitives follow. Even so records are a powerful tool, they can be nested and take care of all the bit shifting.

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

 - Each field's value should either be a primitive or a function.
 - If a function is given it will be called at the time of parsing / unparsing and it will be passed both the `external_state` and `record_context` as parameters.
 - During parsing / unparsing if a primitive returns `undefined` it's data will be skipped.
 - During parsing / unparsing if a primitive returns anything else without the `parse` / `unparse` property the value returned will be used for the field.
 - During unparsing if a value for a field is missing and the primtive contains a `missing` option the `missing` option's value will be used instead. If the `missing` option is a function the function will be called with the passed in external_state and the record's context at that point in time.

Notes
 - For convenience record.parse can accept a hex string instead of a proper ArrayBuffer of data.
 - As Record is the prototypical dynamic primitive the `parse` and `unparse` functions will return an object containing the length and data like `{ data : ..., length : ... }` instead of just the data.

Extending
---------

Bitratchet is easy to extend, you can make your own primitives with total flexibility to suit your needs whilst still leveraging ones provided. (Refer to the list of rules primitives must abide to in the primitive section above when creating your own.)

For example here's a time-stamp primitive that makes use of the number primitive to easily parse time-stamps in the data:

      function timestamp(options) {
          return {
              parse : function (data) {
                  return new Date(bitratchet.number(options).parse(data) * 1000);
              },
              unparse : function (data) {
                  var timestamp = (typeof data === 'string' ? Date.parse(data) : data.getTime()) / 1000;
                  return bitratchet.number(options).unparse(timestamp);
              },
              length : options.length,
              missing : function () { return Date.now(); }
          };
      }

Notice the missing option, if the data isn't present during unparsing today's date will be used.

Here's another example, this time for parsing IP address':

      function ip_address() {
          return {
              parse : function (data) {
                  var i, ip = "", bytes = new Uint8Array(data);
                  for (i = 0; i < bytes.length; i += 1) {
                      ip += bytes[i].toString(10) + ".";
                  }
                  return ip.slice(0, -1);
              },
              unparse : function (data) {
                  return bitratchet.hex({ length : 8 * 4 }).unparse(data.replace(/\./g, ""));
              },
              length : 8 * 4,
          };
      }

Notice there is no missing option, if the data isn't present during unparsing an exception will be thrown.

License
-------
Copyright Dave Barker 2012

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.