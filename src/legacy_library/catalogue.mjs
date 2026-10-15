const entry = (slug, title, file, purpose, basic, groups, caution = '', options = {}) => ({
  slug, title, file, purpose, basic, groups, manualUpdate: Boolean(options.manualUpdate),
  validation: options.validation ?? `Unverified parametric design. Print fit and function have not been validated.${caution ? ` ${caution}` : ''}`,
  load: () => import(new URL(`../models/${file}.js`, import.meta.url).href)
});

// Deliberately independent of app.js: importing it would start the old application.
export const catalogue = Object.freeze({
  organizer: entry('grid-organizer', 'Grid organizer', 'organizer',
    'A divided tray for sorting small parts; size the footprint and compartments to your storage.',
    ['width', 'depth', 'rows', 'cols'], [
      ['Compartments and wall merging', ['grid_pattern', 'vertical_wall_mask', 'horizontal_wall_mask']],
      ['Height, walls and corners', ['height', 'wall_t', 'fillet_r']]
    ]),
  badminton_pole_head: entry('round-badminton-pole-head', 'Round badminton pole head', 'badminton_pole_head',
    'A round pole-top fitting with a shaped cap and net-line groove.', ['d_cyl', 'h'], [
      ['Cap shape', ['d_ball', 'h_ball', 'edge_fillet_r']],
      ['Net-line groove', ['groove_center_r', 'groove_axis', 'groove_z', 'groove_profile_d', 'groove_y_scale', 'groove_z_scale']]
    ]),
  badminton_pole_head_square: entry('square-badminton-pole-head', 'Square badminton pole head', 'badminton_pole_head_square',
    'A rounded square pole-top fitting with adjustable cap overhang and groove.', ['body_w', 'body_d', 'h'], [
      ['Body and cap shape', ['body_corner_r', 'd_ball', 'h_ball', 'head_overhang_xy', 'head_lateral_scale', 'head_vertical_scale', 'side_relief_inset', 'edge_fillet_r']],
      ['Net-line groove', ['groove_center_r', 'groove_axis', 'groove_z', 'groove_profile_d', 'groove_y_scale', 'groove_z_scale']]
    ], 'The original default export mesh is not watertight; inspect before printing.'),
  vase: entry('twisted-vase', 'Twisted vase', 'vase',
    'A hollow lofted vase with a circular or polygonal profile and adjustable twist.', ['height', 'profile_sides', 'twist'], [
      ['Radius profile and wall', ['base_r', 'mid_r', 'top_r', 'wall_t']]
    ], 'Watertightness is untested. Twist does not visibly change a circular section.'),
  vase_spline: entry('spline-vase', 'Spline vase', 'vase_spline',
    'A hollow vase shaped by a freeform height-radius spline.', ['height', 'profile_sides', 'twist', 'radius_curve'], [
      ['Polygon edges and wall', ['edge_curve', 'wall_t']],
      ['Loft resolution', ['edge_samples_per_side', 'section_count']]
    ], 'Watertightness is untested.'),
  bolt: entry('bolt-generator', 'Bolt generator', 'bolts',
    'Standards-based fastener presets for layout and printing experiments, with optional helical thread geometry.', ['preset_index', 'length_override', 'major_dia_offset'], [
      ['Drive and tool fit', ['make_drive', 'drive_depth_scale', 'headless_drive_type', 'socket_clearance', 'headless_tool_size', 'headless_torx_size', 'headless_phillips_size', 'headless_flat_width', 'headless_drive_depth', 'headless_drive_through']],
      ['Thread shape and resolution', ['render_thread', 'thread_sections_per_turn', 'thread_depth_scale', 'thread_runout_top', 'thread_runout_bottom', 'thread_end_style', 'circle_sides']],
      ['Boolean tolerances', ['eps', 'boolean_fuzzy']]
    ], 'Not a rated fastener. The original default has thread geometry disabled.'),
  unlevel_hangboard_depth_taper: entry('depth-taper-hangboard', 'Depth-taper hangboard', 'symmetric_5_zone_unlevel_portable_hangboard_depth_taper',
    'Dual-sided grip with finger profiles and alternative rope attachments.', ['slot_count', 'slot_depth_y', 'upper_slot_depth_y', 'slot_clearance_between_surfaces'], [
      ['Finger widths and risers', Array.from({length:6}, (_, i) => [`slot_width_${i+1}`, `riser_height_${i+1}`]).flat()],
      ['Per-finger width profile', ['width_taper_curve', 'width_taper_amount_mm']],
      ['Depth profile', ['depth_taper_curve', 'depth_taper_amount_mm', 'riser_fillet_r', 'risers_on_both_sides']],
      ['Body height, walls and back taper', ['base_slot_height', 'side_wall_x', 'rope_side_wall_x', 'back_wall_y', 'bottom_wall_z', 'top_wall_z', 'rope_bend_radius', 'rope_crown_rise_mm', 'make_back_taper', 'taper_top_inset']],
      ['Rope attachment', ['make_holes', 'attachment_method', 'hole_width_x', 'hole_height_z', 'hole_chamfer', 'rope_diameter', 'rope_clearance', 'rope_depth_offset_mm', 'attachment_side', 'eyelet_depth_offset_mm', 'eyelet_thickness_mm']],
      ['Edge rounding and tolerances', ['outer_fillet_r', 'slot_fillet_r', 'eps', 'boolean_fuzzy', 'depth_profile_version']]
    ], '', { manualUpdate: true, validation: 'Unverified fit and strength. Default mesh is not watertight.' })
});

export function getModel(key) {
  if (!Object.hasOwn(catalogue, key)) throw new Error('This model is not part of the public library.');
  return catalogue[key];
}

export function defaults(meta) {
  return Object.fromEntries(meta.params.map(param => [param.key, param.default]));
}
