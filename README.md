# FeatherCAD

FeatherCAD is a lightweight, local-first, mobile-first parametric sketch-to-3D CAD progressive web app. It starts on a clean welcome screen, stores projects in IndexedDB, keeps editable sketch geometry and feature history, and renders hardware-accelerated polygonal solids with Three.js.

This repository is a complete static site. It needs no build, server-side component, account, API key, or paid service.

## Architecture and honest browser limitations

- `src/store.js`, `src/commands.js`, and `src/history.js` own serializable project state, command history, feature dependencies, suppression, and rebuild planning.
- `src/sketch/` contains the 2D entity model, snapping, closed-profile validation, a lightweight iterative constraint solver, SVG sketch view, and touch/mouse tool controller.
- `src/geometry/` converts valid profiles to triangle solids, evaluates extrudes/revolves and modifiers, and performs in-repository BSP/CSG Boolean operations.
- `src/renderer.js` owns Three.js, cameras, adaptive rendering, reference planes, selection, measurements, display modes, and navigation.
- `src/io/` and `src/workers/` validate and convert files. STL, OBJ, DXF, and SVG parsing runs off the main thread. glTF/GLB and 3MF use pinned Three.js loaders.
- `src/ui/` renders the responsive tree, sheets, dialogs, properties, tools, and original SVG icon system.
- `db.js` uses IndexedDB for durable projects and recovery snapshots. The service worker caches the app shell and runtime modules for repeat offline launches.

FeatherCAD uses a polygonal modeling engine, not an exact boundary-representation (B-rep) kernel. Extrude, revolve, CSG, patterns, mirror, extrusion fillet/chamfer, and mesh shell operations are real triangle-mesh operations and remain editable in history, but they do not offer Open Cascade's analytic-surface tolerances. Fillet/chamfer is deliberately limited to a body produced by one extrusion. Shell currently supports a single connected mesh and opens the positive local-Z end. Feature errors preserve the earlier valid body and report the failed history item.

The lightweight constraint solver handles the listed common relations iteratively and reports obvious conflicting/over-constrained states; it is not a full symbolic geometric-constraint solver. Tangency, symmetry, and collinearity are practical two-entity operations. Projected external geometry uses the selected body's planar bounding projection rather than extracting analytic B-rep edges.

STEP and IGES are explicitly rejected because shipping reliable exact import/export requires a large Open Cascade WASM bundle that this lightweight repository does not include. No failed import creates substitute or sample geometry.

Three.js 0.170.0 is pinned in the import map and fetched from jsDelivr on the first connected load. After a successful first load, the service worker runtime-caches it. Opening through `file://` is not supported because browser ES modules, workers, IndexedDB behavior, and service workers require an HTTP origin.

## Directory tree

```text
.
├── index.html
├── styles.css
├── manifest.webmanifest
├── service-worker.js
├── package.json
├── LICENSE
├── THIRD_PARTY_LICENSES.md
├── README.md
├── assets/
│   ├── logo-mark.svg
│   ├── wordmark.svg
│   ├── logo-monochrome.svg
│   ├── favicon.svg
│   ├── icon-source.svg
│   ├── maskable-source.svg
│   ├── apple-touch-icon.png
│   ├── icon-192.png
│   ├── icon-512.png
│   ├── maskable-192.png
│   └── maskable-512.png
├── scripts/
│   └── check.mjs
└── src/
    ├── app.js
    ├── commands.js
    ├── constants.js
    ├── db.js
    ├── history.js
    ├── renderer.js
    ├── store.js
    ├── utils.js
    ├── geometry/
    │   ├── csg.js
    │   └── features.js
    ├── io/
    │   ├── exporter.js
    │   └── importer.js
    ├── sketch/
    │   ├── controller.js
    │   ├── model.js
    │   ├── solver.js
    │   └── view.js
    ├── ui/
    │   ├── icons.js
    │   ├── properties.js
    │   └── templates.js
    └── workers/
        └── import-worker.js
```

## Run locally

Prerequisites: any current Python 3 or Node.js installation and an internet connection for the first Three.js load.

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080`. Alternatively:

```bash
npm run serve
```

Run repository checks with:

```bash
npm run check
```

The site intentionally uses relative paths, so it also works beneath a GitHub Pages repository subpath.

## GitHub Pages deployment

1. Copy the repository contents to the root of a GitHub repository and push the default branch.
2. In **Settings → Pages**, select **Deploy from a branch**.
3. Choose the default branch and `/ (root)`, then save.
4. Visit the generated HTTPS Pages URL once while online so the PWA can cache its runtime modules.

No base-path edit or build output is required. When changing cached source, increment `VERSION` in `service-worker.js`; activation deletes older FeatherCAD caches safely.

## Install on iPhone

1. Open the HTTPS GitHub Pages URL in Safari.
2. Tap **Share**, then **Add to Home Screen**.
3. Confirm **FeatherCAD**.
4. Launch from the new icon. The app uses standalone display mode, safe-area insets for notches and the home indicator, 44-pixel minimum targets, iOS-safe 16-pixel inputs, and locked viewport gestures.

Portrait and landscape share the same project/camera state. One-finger drag orbits in 3D and draws in Sketch Mode; two-finger drag pans; pinch zooms; tap selects; double-tap focuses; long press opens context actions. Mouse orbit/pan/wheel, hover feedback, Delete, Escape, `F`, `Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z`, and `Ctrl/Cmd+S` are available on desktop.

## Modeling workflow

1. Choose **New Project**, then enter a name, units, and an optional preferences-only template.
2. Select XY, XZ, YZ, or a custom reference plane in the Model tree.
3. Choose **Sketch**. The prominent mode indicator changes to **SKETCH MODE**.
4. Open **Sketch** again for drawing tools. Draw a closed profile, select geometry, and use **Constraints & dimensions**. Tap a displayed dimension to edit it.
5. Choose **Confirm**. Invalid or self-intersecting profiles stay editable and cannot be used by a solid feature.
6. Select the sketch and choose **Feature → Extrude / Boss** or **Revolve**.
7. Select a body for modifiers, patterns, mirror, cuts, shell, or Boolean operations.
8. Select an earlier sketch or feature in the history tree to edit values, suppress, rename, delete, or reorder. Downstream features rebuild and show errors without corrupting project JSON.

Projects autosave after edits. **Save**, **Save As**, duplicate, rename, delete, native import/export, recovery snapshots, and recent projects all operate locally in the browser.

## Native `.feathercad` format

The native file is human-readable JSON containing:

- format and schema version, ID, name, units, dates, and revision;
- preferences, camera, viewport visibility, standard and custom planes;
- every sketch entity, constraint, dimension, status, and detected profile;
- ordered editable feature definitions, parameters, suppression, links, and rebuild errors;
- body metadata and non-parametric mesh import data.

Native export is the only format that preserves full FeatherCAD parametric history.

## File-format support

| Format | Import | Export | Status | Notes |
|---|---|---|---|---|
| FeatherCAD `.feathercad`, `.fcd` | Yes | Yes | **Fully supported** | Editable JSON history, sketches, constraints, metadata, units, and embedded imported mesh data |
| STL binary | Yes | Yes | **Fully supported** | Mesh only; triangle normals and geometry retained |
| STL ASCII | Yes | Yes | **Fully supported** | Mesh only; choose text mode for export |
| OBJ | Yes | Yes | **Mesh only** | Vertex/face geometry; materials, MTL, lines, and point clouds are not preserved |
| glTF / GLB | Yes | Yes | **Mesh only** | Three.js scene meshes; parametric history cannot be represented |
| 3MF | Yes | No | **Mesh only** | Three.js loader; first model resources are tessellated; export is not claimed |
| DXF | Yes | Yes | **Partially supported** | LINE and CIRCLE import/export; other entities are rejected/ignored with a warning |
| SVG | Yes | Yes | **Partially supported** | line, circle, rect, polyline, and polygon primitives; complex paths/transforms are not claimed |
| STEP / STP | No | No | **Not supported** | Exact B-rep kernel is not bundled; clear error shown |
| IGES / IGS | No | No | **Not supported** | Exact B-rep kernel is not bundled; clear error shown |

Imports are limited to 50 MB and one million STL triangles. Geometry above those limits is rejected with a specific message. Worker-backed imports show cancellable real progress milestones; no fake timer is used.

## Feature checklist

- [x] Clean welcome screen; recent projects appear only when saved projects exist
- [x] Empty new projects with origin and XY/XZ/YZ planes only
- [x] Project name, mm/cm/m/in units, preferences-only templates
- [x] Explicit Sketch Mode and 3D Model mode with consistent Confirm/Cancel
- [x] Line, connected polyline, center/corner rectangle, circle, center/three-point arc, polygon, and slot
- [x] Trim, extend, offset, two-line sketch fillet, construction, projected bounds, select/move/duplicate/delete
- [x] Endpoint, midpoint, center, grid, and projected snapping indicators
- [x] Horizontal, vertical, coincident, parallel, perpendicular, tangent, concentric, equal, collinear, symmetric, fixed relations
- [x] Horizontal/vertical/linear, radius, diameter, and angle dimensions with tap editing
- [x] Under/full/over/conflict colors, messages, profile closure, and self-intersection validation
- [x] Extrude, cut, revolve, revolve cut, extrusion fillet/chamfer, mesh shell
- [x] Linear/circular patterns, mirror, custom reference planes, union/subtract/intersect
- [x] Editable, renameable, suppressible, deletable, dependency-checked feature history
- [x] Last-valid history metadata and clear rebuild errors
- [x] Perspective/orthographic, seven standard views, isometric, fit, shaded/edges/wireframe/transparent, section clipping
- [x] Origin/axes/grid/plane visibility and body/feature plus general sub-object selection filters
- [x] Undo/redo, autosave, crash snapshots, camera persistence, idle rendering, resource disposal
- [x] Responsive phone/desktop tree, properties, bottom dock/sheets, keyboard and touch navigation
- [x] Distance/bounds, mesh area, volume, and density-based approximate mass
- [x] Native/STL/OBJ/glTF/GLB/DXF/SVG/PNG exports with fidelity warning
- [x] IndexedDB projects, recent list, rename, duplicate, Save As, delete, import validation
- [x] Installable PWA, offline repeat launch, light/dark modes, safe areas, reduced motion, visible focus
- [ ] Spline, sweep, loft, hole tool, draft, analytic edge/face selection, and exact STEP/IGES (not claimed)

## Manual test plan

### Startup and persistence

1. Clear site data and load the app at 320, 375, 390, 430, 768, 1024, and 1440 CSS-pixel widths. Confirm only New/Open/Import appears and Recent is absent.
2. Create a blank mm project. Confirm no body, sketch, preselection, or sample geometry exists.
3. Refresh, reopen the saved project, rotate the camera, change orientation, and refresh again. Confirm model and camera persist.
4. Create two projects, rename, duplicate, Save As, delete one with confirmation, and verify the Recent list.

### Sketch and constraints

1. Select XY Plane, enter Sketch Mode, draw a corner rectangle, and confirm valid-profile fill.
2. Draw four disconnected lines, snap endpoints into a loop, and confirm closure is detected.
3. Draw crossing loop edges and confirm it is invalid and cannot produce an extrusion.
4. Apply every relation to compatible selected geometry. Add/edit linear, axis, radius, diameter, and angle dimensions.
5. Exercise trim, extend, offset, fillet, construction, duplicate, drag move, delete, and Cancel rollback.
6. Test touch drawing, two-finger browser-navigation isolation, portrait/landscape rotation, and numeric input on iPhone.

### Features and history

1. Extrude a rectangle. Add a circle sketch and extrude cut it through the body.
2. Revolve a closed profile; repeat with Revolve Cut against a selected body.
3. Apply fillet and chamfer to a single extrusion, then shell a valid mesh with a conservative thickness.
4. Apply linear and circular patterns, mirror, and all three Boolean operations.
5. Edit the first sketch dimension and feature depths; confirm downstream rebuild.
6. Force an invalid dimension or shell thickness. Confirm an error appears and project JSON/history remains usable.
7. Suppress/restore, rename, delete with confirmation, and attempt an invalid reorder.

### View, measurement, and I/O

1. Test all views/projections/display modes, fit, visibility toggles, selection filters, section view, and dark mode.
2. Compare bounding dimensions and volume of a known 10 × 20 × 30 extrusion. Enter density and verify mass = mesh volume × density.
3. Round-trip a `.feathercad` project and compare sketches/features/units.
4. Import known binary/ASCII STL, OBJ, GLB, 3MF, primitive SVG, and LINE/CIRCLE DXF files; verify warnings and non-parametric classification.
5. Import corrupt, unsupported, and over-50-MB files. Confirm specific errors and no inserted geometry.
6. Export STL binary/text, OBJ, GLB/glTF, SVG, DXF, and PNG; open each in an independent viewer.
7. Install from Safari, launch standalone, disconnect network after one complete online load, and verify repeat app-shell launch.

## Performance and safety

Rendering is invalidation-driven and stops drawing when controls and the scene are idle. Sketch pointer previews do not rebuild 3D history. Confirmed features rebuild once. Triangle imports run in a worker where practical; imports are capped at 50 MB and STL at one million triangles. WebGL geometries and materials are disposed on rebuild/project close. Feature history uses up to 80 undo snapshots. Autosave is debounced to 1.2 seconds and a separate recovery snapshot is requested on an unsaved page exit.

Complex CSG can still be expensive on a phone because BSP cost grows rapidly with triangle count. Use simple sketch profiles, moderate lathe segment counts (the UI defaults to 48), and imported meshes below roughly 200,000 triangles for responsive iPhone editing.

## License

FeatherCAD is MIT licensed. See [LICENSE](./LICENSE) and [THIRD_PARTY_LICENSES.md](./THIRD_PARTY_LICENSES.md).
