import { validateParameters } from './parameters.mjs';

const controllerKeys = ['esp32_size_x', 'esp32_size_y', 'esp32_size_z', 'controller_pcb_thickness', 'controller_underside_projection', 'controller_antenna_length', 'controller_antenna_margin', 'controller_access_end_length', 'controller_opposite_access_length', 'controller_edge_overlap', 'controller_mount_points', 'controller_dimensions_verified', 'controller_contacts_verified'];
const motorKeys = ['motor_envelope_diameter', 'motor_envelope_height', 'motor_mount_points', 'motor_mount_hole_diameter', 'motor_center_relief_diameter', 'motor_thread_depth', 'motor_engagement_min', 'motor_engagement_max', 'motor_mount_verified'];
const propKeys = ['prop_diameter', 'prop_blade_thickness', 'prop_deflection_allowance'];
const matches = (parameters, changes) => Object.entries(changes).every(([key, value]) => JSON.stringify(parameters[key]) === JSON.stringify(value));
const pick = (source, keys) => Object.fromEntries(keys.map(key => [key, structuredClone(source[key])]));

export function componentCatalog(config) {
  return {
    controller: [
      { id: 'website_esp32', label: 'ESP32-S3 / saved envelope', changes: { ...pick(config.defaults, controllerKeys), controller_preset: config.defaults.controller_preset }, basis: 'Saved YD-ESP32-S3 candidate envelope; purchased-board match unverified. The default upper retains the upward-header ledges.' },
      ...Object.entries(config.controllers).map(([id, entry]) => ({ id, label: entry.label, changes: { ...entry.changes, controller_preset: id }, basis: entry.basis })),
      { id: 'custom', label: 'Custom controller envelope', group: 'Controller PCB', basis: 'Current editable envelope; hardware match and contacts unverified.' }
    ],
    esc: [
      { id: 'velox_v50a', label: 'Velox V50A 6S / 32BIT 4-in-1', changes: { ...config.hardware_defaults.parameters, esc_board_hole_diameter: config.defaults.esc_board_hole_diameter, esc_mount_verified: config.defaults.esc_mount_verified }, basis: config.hardware_defaults.esc.basis },
      { id: 'custom', label: 'Custom ESC envelope', group: 'ESC', basis: 'Current editable ESC outline and mounting pattern; purchased-part match unverified.' }
    ],
    motor: [
      { id: 'v2207_v3', label: 'V2207 V3 / drawing envelope', changes: pick(config.defaults, motorKeys), basis: 'Existing 27.5 mm x 31.8 mm drawing-based envelope and mounting pattern. Shaft, threads and purchased-part match require checking.' },
      { id: 'custom', label: 'Custom motor envelope', group: 'Motors', basis: 'Current editable envelope and mounting pattern; shaft seating and hardware match unverified.' }
    ],
    prop: [
      { id: 'conservative_51', label: '5.1-inch / conservative envelope', changes: pick(config.defaults, propKeys), basis: config.hardware_defaults.propellers.basis },
      { id: 'custom', label: 'Custom prop envelope', group: 'Frame', basis: 'Current editable swept envelope. The existing 64.77 mm reference radius remains a conservative minimum.' }
    ]
  };
}

export function inferComponent(parameters, choices) {
  return choices.find(choice => choice.changes && matches(parameters, choice.changes))?.id || 'custom';
}

export function applyComponent(parameters, kind, id, config) {
  const choice = componentCatalog(config)[kind]?.find(item => item.id === id);
  if (!choice) throw new Error('Unsupported component selection.');
  if (!choice.changes) return structuredClone(parameters);
  const next = { ...structuredClone(parameters), ...structuredClone(choice.changes) };
  // Reuse existing wall/board-clearance allowances rather than inventing a new fit recipe.
  const room = (x, y, rotation, cx, cy, allowance) => {
    const angle = rotation * Math.PI / 180, c = Math.abs(Math.cos(angle)), s = Math.abs(Math.sin(angle));
    return [x * c + y * s + 2 * Math.abs(cx) + 2 * allowance, x * s + y * c + 2 * Math.abs(cy) + 2 * allowance];
  };
  if (kind === 'controller') {
    const [width, length] = room(next.esp32_size_x, next.esp32_size_y, next.esp32_rotation_z, next.esp32_center_x, next.esp32_center_y, next.carrier_board_clearance + next.carrier_wall_thickness);
    next.plate_width = Math.max(next.plate_width, width);
    next.plate_length = Math.max(next.plate_length, length);
  }
  if (kind === 'esc') {
    const [width, length] = room(next.esc_size_x, next.esc_size_y, next.esc_rotation_z, next.esc_center_x, next.esc_center_y, next.esc_mount_hole_diameter);
    next.plate_width = Math.max(next.plate_width, width);
    if (next.lower_body_length) next.lower_body_length = Math.max(next.lower_body_length, length);
    else next.plate_length = Math.max(next.plate_length, length);
  }
  if (kind === 'motor' && !(next.frame_variant === 'drone_frame_v1' && (next.motor_compact_pad || next.motor_recess_enabled))) next.motor_pad_diameter = Math.max(next.motor_pad_diameter, next.motor_envelope_diameter);
  return validateParameters(next, config);
}
