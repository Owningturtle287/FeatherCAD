export const APP_VERSION = '1.0.0';
export const DB_NAME = 'feathercad-db';
export const DB_VERSION = 1;
export const PROJECT_STORE = 'projects';
export const RECOVERY_STORE = 'recovery';
export const MAX_IMPORT_BYTES = 50 * 1024 * 1024;
export const AUTOSAVE_MS = 1200;

export const UNITS = {
  mm: { label: 'Millimeters', suffix: 'mm', toMM: 1 },
  cm: { label: 'Centimeters', suffix: 'cm', toMM: 10 },
  m: { label: 'Meters', suffix: 'm', toMM: 1000 },
  in: { label: 'Inches', suffix: 'in', toMM: 25.4 }
};

export const PLANES = [
  { id: 'plane-xy', name: 'XY Plane', normal: [0, 0, 1], color: '#35a7d0' },
  { id: 'plane-xz', name: 'XZ Plane', normal: [0, 1, 0], color: '#7b61c9' },
  { id: 'plane-yz', name: 'YZ Plane', normal: [1, 0, 0], color: '#2a9d6f' }
];

export const SKETCH_TOOLS = [
  ['select', 'Select'], ['line', 'Line'], ['polyline', 'Polyline'],
  ['cornerRect', 'Corner rectangle'], ['centerRect', 'Center rectangle'],
  ['circle', 'Circle'], ['centerArc', 'Center arc'], ['threeArc', '3-point arc'],
  ['polygon', 'Polygon'], ['slot', 'Slot'], ['trim', 'Trim'], ['extend', 'Extend'],
  ['offset', 'Offset'], ['fillet', 'Fillet'], ['construction', 'Construction'],
  ['project', 'Project'], ['move', 'Move'], ['duplicate', 'Duplicate'], ['delete', 'Delete']
];

export const CONSTRAINTS = [
  ['horizontal', 'Horizontal'], ['vertical', 'Vertical'], ['coincident', 'Coincident'],
  ['parallel', 'Parallel'], ['perpendicular', 'Perpendicular'], ['tangent', 'Tangent'],
  ['concentric', 'Concentric'], ['equal', 'Equal'], ['collinear', 'Collinear'],
  ['symmetric', 'Symmetric'], ['fixed', 'Fixed'], ['distanceX', 'Horizontal distance'],
  ['distanceY', 'Vertical distance'], ['distance', 'Linear distance'], ['radius', 'Radius'],
  ['diameter', 'Diameter'], ['angle', 'Angle']
];

export const FEATURE_TYPES = [
  ['extrude', 'Extrude / Boss'], ['cut', 'Extrude Cut'], ['revolve', 'Revolve'],
  ['revolveCut', 'Revolve Cut'], ['fillet', 'Fillet'], ['chamfer', 'Chamfer'],
  ['shell', 'Shell'], ['linearPattern', 'Linear Pattern'], ['circularPattern', 'Circular Pattern'],
  ['mirror', 'Mirror'], ['referencePlane', 'Reference Plane'], ['boolean', 'Boolean']
];

export const COLORS = {
  primary: 0x007ba7,
  selected: 0xffb000,
  hover: 0x61dafb,
  body: 0xb9dce8,
  edge: 0x17495a,
  under: '#1687b3',
  full: '#2e9d68',
  over: '#e08b00',
  conflict: '#c83f49',
  projected: '#8b65bd',
  construction: '#86929a'
};
