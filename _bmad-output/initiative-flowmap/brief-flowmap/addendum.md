# Addendum - Flow Map brief

Detail that belongs in the PRD or architecture, or that earned a place but does not fit the brief.

## Current state: the built-in Perspective Map (Ignition 8.3)

Source: IA docs, Perspective Map component page (read 2026-10-25). Labels: **[IA docs]**.

- Built on Leaflet. Props-only configuration: `init` (center, zoom), `zoom`, `location`, `maxBounds`, `customControls` (embedded views in a corner). [IA docs]
- Layers: raster `tile` (OSM template or WMS) and `image`; vector `polygon`, `polyline`, `rectangle`, `circle` with stroke and fill (`color`, `weight`, `opacity`, `dashArray`, `dashOffset`); UI `marker` (icon `path`, `color`, `size`, `rotate`, `tooltip`, `popup`), `popup`, embedded `view`; `geoJSON` FeatureCollection with `styleOptions`. [IA docs]
- The docs say the `geoJSON` prop is meant to be fed by a binding and transform, not edited by hand. [IA docs]
- No documented way for an end user to draw, move or delete shapes or markers on the map. No clustering. No animation beyond zoom and fade. [IA docs, by absence; verify on a live Gateway]
- Implication: today every add, move or remove of a map item means editing props arrays in the Designer or writing a binding over a table. This is the ease-of-use gap the user names.

## Comparable: Nader Chinichian's Map Administration Tool

Sources: LinkedIn post by Nader Chinichian (posted about 2024, "Ignition Perspective Map Administration Tool", promoted as a Perspective application to administer a GeoSCADA system; 152 reactions, 14 comments); YouTube video of the same title on his channel (title only; the page could not be fetched from this session); LinkedIn DM to the user, 2024-11-01.

- Pure Perspective project, not a module. [DM]
- Two parts: an admin project and an end-user project. [DM]
- Includes many icons, CSS classes, widgets and more. [DM]
- Sold as resources to system integrators worldwide. [DM]
- Price about 25,000 USD. [user, not seen in a source]
- Feature list from the video: not yet captured. Open item for the user.
