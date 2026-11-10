# T2.2 — Moiré net

Added **Moiré net** as a layered, self-supporting card. Its two line families use `pitchA` and `pitchA + pitchDiff`, with the second family turned by `angleDiff`; both can be straight or wavy. If both pitches match, sanitization raises a zero angle difference to 0.5° so the families cannot coincide. The Pattern section uses the new `phase` effect and shifts family B by the sampled field, including imported pictures.

`moireCrossingTiles` uses actual A/B geometric intersections, binned into 10 × 10 mm cells. Any active swatch tile with no intersection produces the ticket's warning: “The bands are too sparse to hold together; reduce the difference.” The current fine default is deliberately flagged by this criterion; that is a geometry warning, not a physical print conclusion.

Validation: output snapshots generated for default and all three presets; engine tests cover coincident-family prevention, tile counting and empty-tile warning, and the picture phase. Browser opened the card at 375, 768 and 1440 px; Export enabled, no horizontal overflow, no page errors. Source citations are catalogue M7 and references 43, 58 and 61; those papers mention the idea but do not measure this textile.

Printability scores remain estimates. No physical print or licence check is claimed.
