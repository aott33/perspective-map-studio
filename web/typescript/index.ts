import { ComponentMeta, ComponentRegistry } from '@inductiveautomation/perspective-client';
import { MapStudio, MapStudioMeta } from './MapStudio';

import 'maplibre-gl/dist/maplibre-gl.css';
import './mapstudio.css';

export { MapStudio };
// The style rule preview the kind setup screen embeds (epic 3 entry 1, docs/styles.md).
export { StylePreview, PresetPalette, TintPalette } from './StylePreview';

// Register the component with the Perspective client registry.
const components: Array<ComponentMeta> = [
    new MapStudioMeta()
];

components.forEach((c: ComponentMeta) => ComponentRegistry.register(c));
