# Drawing colours

A drawing is made in seven colours. Each distinct colour becomes one region in the colour bar above the preview, and the studio names it.

| R | G | B | Colour | Default role |
|---:|---:|---:|---|---|
| 0 | 0 | 0 | Black | Line |
| 255 | 0 | 0 | Red | Pattern (the design you choose) |
| 0 | 255 | 0 | Green | Solid |
| 0 | 0 | 255 | Blue | Hole |
| 255 | 255 | 0 | Yellow | Solid |
| 255 | 0 | 255 | Magenta | Line |
| 0 | 255 | 255 | Cyan | Line |

- Use pure RGB values. A colour within 8 of a palette value on every channel (export rounding) is read as that palette colour, so `#fe0000` and `#ff0000` are one region.
- A shade further away keeps its own region, as it always did, and its role follows the nearest of red, blue, green or yellow, or Line otherwise.
- The role of any region can be changed in the colour bar. The roles above are only the starting point.
- The roles for Black, Magenta and Cyan are the existing defaults for colours that are not red, blue, green or yellow. If you want them to start as something else, say so and it is one line in `site/src/engine/regions.js`.
