-- G-code export popularity. Settings files and build failures are kept separate.
SELECT design, COUNT(*) AS exports
FROM export_events
WHERE export_type IN ('gcode-swatch', 'gcode-panel')
GROUP BY design ORDER BY exports DESC;

-- Downloads by day and format.
SELECT created_day, export_type, COUNT(*) AS exports
FROM export_events
WHERE export_type IN ('gcode-swatch', 'gcode-panel', 'settings-json')
GROUP BY created_day, export_type ORDER BY created_day;

-- Most-used design / shape / pattern combinations.
SELECT design,
  json_extract(properties_json, '$.settings.shape') AS shape,
  json_extract(properties_json, '$.settings.pattern') AS pattern,
  COUNT(*) AS exports
FROM export_events WHERE export_type IN ('gcode-swatch', 'gcode-panel')
GROUP BY design, shape, pattern ORDER BY exports DESC;

-- Dimensions, layer thickness and SVG use.
SELECT design, width_mm, height_mm,
  json_extract(properties_json, '$.print.layerHeight') AS layer_height,
  json_extract(properties_json, '$.sources.svg') AS used_svg,
  COUNT(*) AS exports
FROM export_events WHERE export_type IN ('gcode-swatch', 'gcode-panel')
GROUP BY design, width_mm, height_mm, layer_height, used_svg ORDER BY exports DESC;

-- Build failures by design and fixed failure category, independent of download counts.
SELECT design,
  json_extract(properties_json, '$.error.code') AS error_code,
  COUNT(*) AS failures
FROM export_events WHERE export_type = 'build-error'
GROUP BY design, error_code ORDER BY failures DESC;
