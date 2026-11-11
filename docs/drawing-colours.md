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

## Editing and applying a colour

Select a colour chip to edit its settings. Its checkbox controls the working selection. Apply keeps the ticked colours in the piece so you can untick them and work on another colour over them.

| Checkbox | Applied | In the preview and build | Apply |
| --- | --- | --- | --- |
| Unticked | No | No | No effect |
| Ticked | No | Yes | Keeps the colour in the piece and records its print order |
| Unticked | Yes | Yes | Already applied |
| Ticked | Yes | Yes | Already applied |

Changing the role, design, or line settings of an excluded colour adds it to the working piece so you can see the edit. **Take out of the piece** removes an applied colour from the build and clears its checkbox. Apply every working colour before exporting. Apply assigns an order the first time a colour is applied. Builds print layer by layer, using that order within each layer, then the drawing order for colours with no assigned order.

Pattern and Solid regions respect enabled holes. An open stroke in one of those regions also stops at the hole. Use a dedicated **Line** region for a tie that crosses a hole. Its strokes are clipped to the page, and the geometry check uses the same page boundary. Review where those lines connect before printing.

See [Print state and history](print-state.md) for the saved document and toolpath contracts.
