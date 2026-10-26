import { ComponentMeta, ComponentRegistry } from '@inductiveautomation/perspective-client';
import { MapStudio, MapStudioMeta } from './MapStudio';

import 'maplibre-gl/dist/maplibre-gl.css';
import './mapstudio.css';

export { MapStudio };

// Register the component with the Perspective client registry.
const components: Array<ComponentMeta> = [
    new MapStudioMeta()
];

components.forEach((c: ComponentMeta) => ComponentRegistry.register(c));
