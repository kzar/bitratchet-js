bitratchet-js
=============

This library is work in progress, don't attempt to use it yet. - Dave
---------------------------------------------------------------------

A Javascript library for processing binary data, similar to BinData for Ruby and taking ideas from my earlier (much more limited) PHP library.

Makes use of the new ArrayBuffer Javascript feature and allows for simple (yet flexible) parsing and "unparsing" of binary data.
Features include:

 - Avoid duplicate code, you only have to specify records once as with BinData.
 - Deal transparently with bit (as opposed to byte) based fields, shifting is taken care of - as with the PHP BitRatchet.
 - Handle dynamic fields that can vary in length and structure.
 - Build your own flexible primtives that can extend the library to your problem domain.

Developed by Dave Barker to aid parsing of a implementing a commerical telematics messaging protocol in Javascript.

Usage
-----

Make sure you're importing the bitratchet library:

      <script src="js/bit-ratchet.js" type="text/javascript"></script>

Primitives
----------

Primitives are used to parse individual fields, they are functions return a primitive object based on the options passed.
The primitive object that's returned must follow these rules:

 - It must contain a `parse` field containing a function that expects data in a ArrayBuffer and returns the parsed information.
 - It must contain an `unparse` field containing a function that accepts the parsed information and returns an ArrayBuffer with the unparsed data.
 - It must contain a length field containing a number specifying - in bits - how large the primtive is. If the primitive is of a static length this should be set immediately, if the primtive is of dynamic length it should be initially set to 0 and then adjusted by the parse and unparse functions.
 - If the primtive's length is not divisible by 8 it must ignore the remaining bits inside the last byte of the ArrayBuffer.
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
 - `record`
 - `flags`
 - `dynamic`
 - `hex`

Records
-------

License
-------
Copyright Dave Barker 2012

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.