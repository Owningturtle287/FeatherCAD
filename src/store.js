import { clone, timestamp, uid } from './utils.js';
import { PLANES } from './constants.js';

export function createProject({ name, units = 'mm', template = 'blank' }) {
  const now = timestamp();
  return {
    format: 'FeatherCAD', formatVersion: 1,
    id: uid('project'), name: name.trim() || 'Untitled', units, template,
    createdAt: now, updatedAt: now, revision: 0,
    preferences: { grid: true, gridSize: units === 'in' ? 0.25 : 10, snap: true, theme: 'system' },
    camera: { projection: 'perspective', position: [140, 110, 140], target: [0, 0, 0], up: [0, 1, 0] },
    visibility: { origin: true, axes: true, planes: true, grid: true },
    planes: PLANES.map(plane => ({ ...plane, visible: true, standard: true })),
    sketches: [], referenceGeometry: [], bodies: [], features: [], imports: [],
    activeSketchId: null, selectedId: null, warnings: [], lastValidRevision: 0
  };
}

export class ProjectStore extends EventTarget {
  constructor() {
    super();
    this.project = null;
    this.undoStack = [];
    this.redoStack = [];
    this.dirty = false;
  }
  setProject(project, { resetHistory = true } = {}) {
    this.project = clone(project);
    if (resetHistory) { this.undoStack = []; this.redoStack = []; }
    this.dirty = false;
    this.emit('project');
  }
  mutate(label, operation, { history = true } = {}) {
    if (!this.project) return;
    if (history) {
      this.undoStack.push({ label, project: clone(this.project) });
      if (this.undoStack.length > 80) this.undoStack.shift();
      this.redoStack = [];
    }
    operation(this.project);
    this.project.updatedAt = timestamp();
    this.project.revision += 1;
    this.dirty = true;
    this.emit('change', { label });
  }
  undo() {
    const item = this.undoStack.pop();
    if (!item || !this.project) return false;
    this.redoStack.push({ label: item.label, project: clone(this.project) });
    this.project = item.project; this.dirty = true; this.emit('change', { label: `Undo ${item.label}` }); return true;
  }
  redo() {
    const item = this.redoStack.pop();
    if (!item || !this.project) return false;
    this.undoStack.push({ label: item.label, project: clone(this.project) });
    this.project = item.project; this.dirty = true; this.emit('change', { label: `Redo ${item.label}` }); return true;
  }
  select(id) { if (!this.project) return; this.project.selectedId = id; this.emit('selection', { id }); }
  markSaved() { this.dirty = false; this.emit('saved'); }
  emit(type, detail = {}) { this.dispatchEvent(new CustomEvent(type, { detail })); }
}

export const store = new ProjectStore();
