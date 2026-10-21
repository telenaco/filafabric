# Path optimisation: printing a drawing in the least time

*Researched and written 2026-10-15. What was read, what was chosen, what it did on real drawings, and what was left out.*

## The problem

A vector drawing is a set of lines. The nozzle prints each line, and between two lines it must **retract, lift, travel and
drop** without printing. That is dead time: with TPU it is also where strings and blobs come from. A drawing of a hundred
separate strokes pays the lift a hundred times however short each travel is, so the thing to minimise is not only the
distance travelled but the **number of strokes** and then the distance between them.

What may change: the order lines are printed in, the direction of each, where a closed shape begins, and which lines
are printed as one stroke. What may not: what is printed (every line once, no line twice), the layers (layer 1 before
layer 2), and the position of a colour-change pause.

## What the literature and the tools say

| Formulation | What it models | Notes |
|---|---|---|
| **TSP** over the lines' end points, each line either way round | Order and direction of separate lines | The common model for pen plotters and FFF travel. NP-hard; heuristics are used in practice. [Butler](https://nb.paulbutler.org/optimizing-plots-with-tsp-solver/), [Fok et al.](https://www.researchgate.net/publication/291973028_Trajectory_Planning_for_3D_Printing_A_Revisit_to_Traveling_Salesman_Problem), [arXiv 1910.01840](https://arxiv.org/pdf/1910.01840) |
| **Generalised TSP / TSP with neighbourhoods** | A closed contour may be entered anywhere (laser cutting pierce points) | Surveyed in [A review of cutting path algorithms for laser cutters](https://www.researchgate.net/publication/309447789_A_review_of_cutting_path_algorithms_for_laser_cutters); metaheuristics such as [simulated annealing with ALNS](https://link.springer.com/article/10.1007/s00170-019-03569-6) |
| **Rural postman / Chinese postman** | Lines that meet form a graph that must be covered edge by edge | The right model when lines touch: [Chinese postman on lattices](https://www.researchgate.net/publication/317701126_Path_Optimization_Along_Lattices_in_Additive_Manufacturing_Using_the_Chinese_Postman_Problem), a [heuristic RPP print-path solver](https://github.com/JHU-Mueller-Lab/Print-Path-Planning-for-Multimaterial-Structures) and its [2026 paper](https://www.tandfonline.com/doi/full/10.1080/17452759.2026.2694273), [Eulerian paths](https://en.wikipedia.org/wiki/Eulerian_path) |

What the tools do:

- **vpype** (the plotter community's standard): `linemerge` joins lines whose ends lie within a tolerance, `linesort`
  orders and flips lines greedily to cut pen-up travel, `reloop` moves the seam of closed paths. The docs advise merging
  before sorting: fewer lines is the larger saving. ([vpype fundamentals](https://vpype.readthedocs.io/en/1.15.0/fundamentals.html),
  [cookbook](https://vpype.readthedocs.io/en/1.2.0/cookbook.html))
- **Greedy nearest-neighbour** is the baseline everywhere; one polargraph project measured about 4.1 million units of
  pen-up travel falling to about 124 thousand with it ([polargraph-optimizer](https://github.com/ezheidtmann/polargraph-optimizer)).
  It is not optimal, and a [3D-printing patent family](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/10399280)
  notes that it can be worse than leaving the slicer's layer order, while a local search removed about 62% of the
  extrusion-free travel.
- **Local search** (2-opt, Or-opt, Lin–Kernighan) is what a TSP heuristic uses after a construction pass. From memory of
  Johnson and McGeoch's survey (to be checked against the chapter before it is quoted): about 5% above the optimum for
  2-opt, 3% for 3-opt, 2% for Lin–Kernighan on random Euclidean instances. Exact solvers and Christofides are far too
  slow or too weak for a page that regenerates at every slider move.
- **Eulerian decomposition**: in a connected graph with 2k nodes of odd degree, the fewest strokes that print every
  edge exactly once is **k** (one if every junction is even). The 2k ends are paired and the pairs joined by dummy
  edges, an Eulerian path found with Hierholzer's algorithm, and the path cut at the dummy edges. How the odd nodes are
  paired decides how long the jumps are (a minimum-weight matching is the exact answer; nearest neighbour is the cheap
  one).

## What is implemented (`src/engine/network.js`, `src/engine/travel.js`, `orderStrands` in `fabric.js`)

Applied to Drawing & infill, an imported drawing's lines and a full panel's drawing, in this order:

1. **Merge** (`mergeTouching`): strokes whose ends lie within 1.1 bead widths become one stroke; the short step across
   is part of it. Three passes of a wide line become one back-and-forth stroke. A step is only taken where it stays
   inside the outline.
2. **Network** (`joinNetwork`, new): lines are split where another line meets or crosses them; the pieces are the
   edges of a graph; per connected piece the odd nodes are paired by nearest neighbour, and an Eulerian path is cut at
   the dummy edges. A line end that stops within a bead of another line's side is joined by a short step (again only
   inside the outline). Strands that are raised, carry per-point flow, or belong to another layer, kind, name or
   standing against the outline are left alone, and a drawing over 40 000 segments or 4 000 odd junctions is skipped.
3. **Greedy order** (`orderStrands`): layer first, then nearest end, with a closed shape entering at its nearest vertex.
4. **Local search** (`improveTravel`): 2-opt, where reversing a run of strands (each flipped) changes only the two moves at
   its ends so a candidate costs O(1), then Or-opt for one to three strands in either direction, then each closed
   shape's seam. The search is capped by a **count of evaluations, not time**, so the same drawing always gives the
   same G-code.

## What it did

Whole pipeline through `layeredResult` on the Prusa MK3S and Filaflex Foamy 95, outline mode, no backing:

| Drawing (100 mm unless noted) | Strokes: greedy → merge → merge + network | Print time: greedy → merge → merge + network |
|---|---|---|
| The example drawing (200 mm: star, rings, 10 wide lines) | 45 → 25 → **23** | 4.85 → 4.74 → **4.74** min |
| A lattice written as 144 separate unit segments | 144 → 15 → **14** | 3.37 → 2.15 → **2.16** min |
| A triangulated net written as 192 separate edges | 192 → 57 → **2** | 4.98 → 3.72 → **3.18** min |

The lattice's 14 is the exact minimum (its 28 border nodes have three sides meeting). The net, whose junctions are
nearly all even, prints in two strokes. Where lines only cross (a grid of long lines) there is nothing to save: every
end is odd and k strokes are needed for k lines. And where lines meet end to end, merging already did the work.

## What was left out, and why

- **Minimum-weight matching** of odd nodes (the exact Chinese postman answer). Nearest neighbour is within a few percent
  here and the later ordering step absorbs the rest; a blossom implementation is a lot of code for it.
- **Lin–Kernighan / Or-opt with neighbour lists.** A pass of 2-opt is O(n²), so drawings of several thousand separate
  strokes are only partly improved before the evaluation cap. Neighbour lists would make it O(n k); nothing printed so
  far needs it, because the network step removes most of those strokes first.
- **Travelling over what is printed** instead of lifting (combing). With TPU the hop is what keeps the bead from
  dragging; this is a separate decision with a print test behind it.
- **Time as the cost.** Every stroke costs the same lift, so for a fixed set of strokes distance is the right cost to
  order by; merging and the network step are what remove lifts.
- **Turning at a junction.** A trail may turn sharply where lines meet; a flexible filament takes that, a stiff one might
  not, and the choice of which line continues is arbitrary.

## Drawing conventions

Colour is how a drawing says what it is: pure **red** closed shapes are filled, **blue** closed shapes are left empty,
**green** closed contours bend the pattern, and everything else, black above all, is a line printed as a path. A line
as wide as the extrusion is one pass, a wider one several side by side (see the README). Lines that meet or cross in
any of these are one network to the optimiser.
