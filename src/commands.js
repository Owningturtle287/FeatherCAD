import { store } from './store.js';
import { uid } from './utils.js';

export const commands = {
  rename(id, name) {
    store.mutate('Rename item', project => {
      if (project.id === id) project.name = name;
      for (const collection of ['planes','sketches','referenceGeometry','bodies','features','imports']) {
        const item = project[collection].find(entry => entry.id === id); if (item) item.name = name;
      }
    });
  },
  setVisibility(id, visible) {
    store.mutate('Change visibility', project => {
      for (const collection of ['planes','sketches','referenceGeometry','bodies','imports']) {
        const item = project[collection].find(entry => entry.id === id); if (item) item.visible = visible;
      }
    });
  },
  suppress(id, suppressed) {
    store.mutate(suppressed ? 'Suppress feature' : 'Restore feature', project => {
      const item = project.features.find(feature => feature.id === id); if (item) item.suppressed = suppressed;
    });
  },
  remove(id) {
    store.mutate('Delete item', project => {
      for (const collection of ['sketches','referenceGeometry','bodies','features','imports']) {
        project[collection] = project[collection].filter(entry => entry.id !== id);
      }
      project.features = project.features.filter(feature => feature.sketchId !== id && feature.bodyId !== id);
      if (project.selectedId === id) project.selectedId = null;
    });
  },
  reorderFeature(id, direction) {
    store.mutate('Reorder feature', project => {
      const index = project.features.findIndex(feature => feature.id === id);
      const next = index + direction;
      if (index < 0 || next < 0 || next >= project.features.length) return;
      const [feature] = project.features.splice(index, 1); project.features.splice(next, 0, feature);
    });
  },
  createReferencePlane(basePlaneId, offset = 0, angle = 0) {
    const id = uid('plane');
    store.mutate('Create reference plane', project => project.planes.push({ id, name: `Plane ${project.planes.length - 2}`, basePlaneId, offset, angle, visible: true, standard: false }));
    return id;
  }
};
