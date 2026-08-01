extends RefCounted

## Builds one faceted crystal column from an accepted GrowthInstruction.
## Meshes are local +Y columns and are oriented by the runtime transform.
## Attached crystals contain their own buried root and fusion flare so parent
## junctions stay continuous without a second overlay mesh.

const CrystalVisualProfile = preload("res://scripts/presentation/crystal_visual_profile.gd")

var _visual_profile = CrystalVisualProfile.new()


func create_mesh_instance(instruction) -> MeshInstance3D:
	var instance := MeshInstance3D.new()
	instance.name = _safe_node_name(instruction.id)
	instance.mesh = create_mesh(instruction)
	instance.position = instruction.attach_position
	instance.basis = _basis_from_y(instruction.direction)
	instance.set_meta("growth_id", instruction.id)
	instance.set_meta("parent_id", instruction.parent_id)
	instance.set_meta("generation", instruction.generation)
	return instance


func create_mesh(instruction) -> ArrayMesh:
	return _build_mesh(instruction)


func _build_mesh(instruction) -> ArrayMesh:
	var surface := SurfaceTool.new()
	surface.begin(Mesh.PRIMITIVE_TRIANGLES)

	var sides: int = instruction.sides
	var merge_depth_ratio: float = float(instruction.metadata.get("merge_depth_ratio", 0.0))
	var attached: bool = instruction.generation > 0
	var role: String = String(instruction.metadata.get("role", ""))
	var is_mother: bool = String(instruction.id) == "crystal:mother" or role == "mother"
	var body_taper: float = clampf(float(instruction.metadata.get("body_taper", 0.86)), 0.68, 1.0)
	var waist_ratio: float = clampf(float(instruction.metadata.get("waist_ratio", 0.98)), 0.8, 1.12)
	var shoulder_height_ratio: float = clampf(
		float(instruction.metadata.get("shoulder_height_ratio", 0.72)),
		0.55,
		0.84,
	)
	var termination_depth_ratio: float = clampf(
		float(instruction.metadata.get("termination_depth_ratio", 0.22)),
		0.12,
		0.36,
	)
	var facet_phase: float = float(instruction.metadata.get("facet_phase", 0.0))
	var ring_twist: float = float(instruction.metadata.get("ring_twist", 0.0))
	var ridge_strength: float = clampf(
		float(instruction.metadata.get("ridge_strength", 0.055)),
		0.0,
		0.14,
	)
	var visual_bias: Vector3 = _visual_profile.body_bias(instruction) * instruction.radius
	var center_drift: Vector3 = Vector3(
		float(instruction.metadata.get("center_drift_x", 0.0)) * instruction.radius,
		0.0,
		float(instruction.metadata.get("center_drift_z", 0.0)) * instruction.radius,
	) + visual_bias
	var tip_offset: Vector3 = Vector3(
		float(instruction.metadata.get("tip_offset_x", 0.0)) * instruction.radius,
		0.0,
		float(instruction.metadata.get("tip_offset_z", 0.0)) * instruction.radius,
	)

	var root_core_ratio: float = clampf(
		float(instruction.metadata.get("root_core_ratio", 0.76)),
		0.64,
		0.88,
	)
	var integrated_flare_ratio: float = clampf(
		float(instruction.metadata.get("junction_flare_ratio", 1.22)),
		1.16,
		1.28,
	)
	var base_radius: float = instruction.radius * (root_core_ratio if attached else 1.04)
	var fusion_radius: float = instruction.radius * integrated_flare_ratio
	var lower_radius: float = instruction.radius * (1.035 if attached else 0.985)
	var mid_radius: float = instruction.radius * waist_ratio
	var shoulder_radius: float = instruction.radius * body_taper
	if is_mother:
		# Renderer-only taper removes the manufactured tower read while the
		# canonical attachment radius, length and lineage remain unchanged.
		mid_radius *= 0.90
		shoulder_radius *= 0.82
	var upper_mid_radius: float = lerpf(mid_radius, shoulder_radius, 0.52) * 0.96
	var termination_radius: float = shoulder_radius * lerpf(0.54, 0.70, instruction.energy)
	var base_y: float = -minf(
		instruction.length * 0.16,
		instruction.radius * merge_depth_ratio * 0.98,
	) if attached else 0.0
	var fusion_y: float = minf(
		instruction.length * 0.008,
		instruction.radius * 0.028,
	) if attached else 0.0
	var lower_y: float = instruction.length * (0.145 if attached else 0.115)
	var mid_y: float = instruction.length * 0.395
	var upper_mid_y: float = instruction.length * 0.575
	var shoulder_y: float = instruction.length * shoulder_height_ratio
	var termination_y: float = instruction.length * (1.0 - termination_depth_ratio)
	termination_y = maxf(shoulder_y + instruction.length * 0.055, termination_y)
	termination_y = minf(instruction.length * 0.9, termination_y)
	var tip: Vector3 = Vector3(
		center_drift.x + tip_offset.x,
		instruction.length,
		center_drift.z + tip_offset.z,
	)
	var color: Color = _crystal_color(instruction)

	var base_ring: Array[Vector3] = _build_ring(
		sides,
		base_radius,
		base_y,
		facet_phase,
		ridge_strength * (0.3 if attached else 0.42),
		Vector3.ZERO,
	)
	var fusion_ring: Array[Vector3] = []
	if attached:
		fusion_ring = _build_ring(
			sides,
			fusion_radius,
			fusion_y,
			facet_phase + ring_twist * 0.05,
			ridge_strength * 0.48,
			Vector3.ZERO,
		)
	var lower_ring: Array[Vector3] = _build_ring(
		sides,
		lower_radius,
		lower_y,
		facet_phase + ring_twist * 0.22,
		ridge_strength * 0.7,
		center_drift * 0.14,
	)
	var mid_ring: Array[Vector3] = _build_ring(
		sides,
		mid_radius,
		mid_y,
		facet_phase + ring_twist * 0.5,
		ridge_strength,
		center_drift * 0.5,
	)
	var upper_mid_ring: Array[Vector3] = _build_ring(
		sides,
		upper_mid_radius,
		upper_mid_y,
		facet_phase + ring_twist * 0.76,
		ridge_strength * 0.92,
		center_drift * 0.78,
	)
	var shoulder_ring: Array[Vector3] = _build_ring(
		sides,
		shoulder_radius,
		shoulder_y,
		facet_phase + ring_twist,
		ridge_strength * 0.82,
		center_drift,
	)
	var termination_ring: Array[Vector3] = _build_ring(
		sides,
		termination_radius,
		termination_y,
		facet_phase + ring_twist * 1.22,
		ridge_strength * 0.58,
		center_drift + tip_offset * 0.34,
		instruction.radius * (0.09 if is_mother else 0.045),
	)

	if attached:
		_connect_rings_gradient(surface, base_ring, fusion_ring, instruction, 0.0, 0.05)
		_connect_rings_gradient(surface, fusion_ring, lower_ring, instruction, 0.05, 0.145)
	else:
		_connect_rings_gradient(surface, base_ring, lower_ring, instruction, 0.0, 0.115)
	_connect_rings_gradient(surface, lower_ring, mid_ring, instruction, 0.145, 0.395)
	_connect_rings_gradient(surface, mid_ring, upper_mid_ring, instruction, 0.395, 0.575)
	_connect_rings_gradient(surface, upper_mid_ring, shoulder_ring, instruction, 0.575, shoulder_height_ratio)
	_connect_rings_gradient(surface, shoulder_ring, termination_ring, instruction, shoulder_height_ratio, 0.86)

	for side in range(sides):
		var next: int = (side + 1) % sides
		_add_triangle_clockwise_gradient(
			surface,
			termination_ring[side],
			termination_ring[next],
			tip,
			_visual_profile.facet_color(instruction, 0.86, side),
			_visual_profile.facet_color(instruction, 0.86, next),
			_visual_profile.facet_color(instruction, 1.0, side),
		)

	if bool(instruction.metadata.get("cap_base", false)):
		var center := Vector3(0.0, base_y, 0.0)
		for side in range(sides):
			var next: int = (side + 1) % sides
			_add_triangle_with_normal(
				surface,
				center,
				base_ring[next],
				base_ring[side],
				Vector3.DOWN,
				_visual_profile.facet_color(instruction, 0.0, side).darkened(0.15),
			)

	var mesh: ArrayMesh = surface.commit()
	mesh.surface_set_material(0, _build_optical_material(instruction, color))
	return mesh


func _build_ring(
	sides: int,
	radius: float,
	y: float,
	phase: float,
	ridge_strength: float,
	center: Vector3,
	vertical_wave: float = 0.0,
) -> Array[Vector3]:
	var ring: Array[Vector3] = []
	for side in range(sides):
		var angle: float = TAU * float(side) / float(sides) + phase
		var harmonic: float = (
			sin(angle * 2.0 + phase * 3.0) * 0.62
			+ cos(angle * 3.0 - phase * 1.7) * 0.38
		)
		var local_radius: float = radius * (1.0 + harmonic * ridge_strength)
		var local_y: float = y + sin(angle * 2.0 + phase * 1.4) * vertical_wave
		var radial: Vector3 = Vector3(cos(angle), 0.0, sin(angle))
		ring.append(center + radial * local_radius + Vector3.UP * local_y)
	return ring


func _connect_rings_gradient(
	surface: SurfaceTool,
	lower: Array[Vector3],
	upper: Array[Vector3],
	instruction,
	lower_height: float,
	upper_height: float,
) -> void:
	var sides: int = mini(lower.size(), upper.size())
	for side in range(sides):
		var next: int = (side + 1) % sides
		_add_quad_clockwise_gradient(
			surface,
			lower[side],
			lower[next],
			upper[next],
			upper[side],
			_visual_profile.facet_color(instruction, lower_height, side),
			_visual_profile.facet_color(instruction, lower_height, next),
			_visual_profile.facet_color(instruction, upper_height, next),
			_visual_profile.facet_color(instruction, upper_height, side),
		)


func _build_optical_material(instruction, color: Color) -> StandardMaterial3D:
	var energy: float = clampf(instruction.energy, 0.0, 1.0)
	var semantic_pressure: Dictionary = Dictionary(
		instruction.metadata.get("semantic_pressure", {}),
	)
	var polishing: float = clampf(
		float(semantic_pressure.get("polishing", instruction.metadata.get("semantic_polish_factor", 0.0))),
		0.0,
		1.0,
	)
	var luminosity: float = clampf(
		float(semantic_pressure.get("luminosity", instruction.metadata.get("semantic_luminosity", 0.0))),
		0.0,
		1.0,
	)
	var material := StandardMaterial3D.new()
	material.vertex_color_use_as_albedo = true
	material.albedo_color = Color(1.0, 1.0, 1.0, 1.0)
	material.cull_mode = BaseMaterial3D.CULL_BACK
	material.roughness = clampf(lerpf(0.34, 0.22, energy) - polishing * 0.035, 0.2, 0.35)
	material.metallic = 0.01
	material.metallic_specular = clampf(lerpf(0.5, 0.69, energy) + polishing * 0.025, 0.45, 0.72)

	material.rim_enabled = true
	material.rim = clampf(lerpf(0.07, 0.16, energy) + luminosity * 0.012, 0.05, 0.18)
	material.rim_tint = 0.4

	material.clearcoat_enabled = true
	material.clearcoat = clampf(lerpf(0.28, 0.6, energy) + polishing * 0.025, 0.25, 0.63)
	material.clearcoat_roughness = clampf(
		lerpf(0.28, 0.12, energy) - polishing * 0.02,
		0.1,
		0.3,
	)

	material.backlight_enabled = true
	var backlight_strength: float = clampf(
		lerpf(0.026, 0.052, energy) + luminosity * 0.006,
		0.02,
		0.06,
	)
	material.backlight = Color(
		color.r * backlight_strength,
		color.g * backlight_strength,
		color.b * backlight_strength,
		1.0,
	)

	material.emission_enabled = true
	material.emission = color.darkened(0.56)
	material.emission_energy_multiplier = clampf(
		0.003 + energy * 0.007 + luminosity * 0.004,
		0.003,
		0.016,
	)
	return material


func _add_quad_clockwise_gradient(
	surface: SurfaceTool,
	a: Vector3,
	b: Vector3,
	c: Vector3,
	d: Vector3,
	color_a: Color,
	color_b: Color,
	color_c: Color,
	color_d: Color,
) -> void:
	# Vertices are submitted clockwise for Godot front faces. The stored
	# lighting normal follows the opposite geometric cross order so it points
	# away from the crystal axis instead of into the solid volume.
	var outward: Vector3 = (d - a).cross(b - a).normalized()
	_add_triangle_with_colors(surface, a, c, b, outward, color_a, color_c, color_b)
	_add_triangle_with_colors(surface, a, d, c, outward, color_a, color_d, color_c)


func _add_triangle_clockwise_gradient(
	surface: SurfaceTool,
	a: Vector3,
	b: Vector3,
	c: Vector3,
	color_a: Color,
	color_b: Color,
	color_c: Color,
) -> void:
	var outward: Vector3 = (c - a).cross(b - a).normalized()
	_add_triangle_with_colors(surface, a, c, b, outward, color_a, color_c, color_b)


func _add_triangle_with_colors(
	surface: SurfaceTool,
	a: Vector3,
	b: Vector3,
	c: Vector3,
	normal: Vector3,
	color_a: Color,
	color_b: Color,
	color_c: Color,
) -> void:
	var vertices := [a, b, c]
	var colors := [color_a, color_b, color_c]
	for index in range(3):
		surface.set_normal(normal)
		surface.set_color(colors[index])
		surface.add_vertex(vertices[index])


func _add_triangle_with_normal(
	surface: SurfaceTool,
	a: Vector3,
	b: Vector3,
	c: Vector3,
	normal: Vector3,
	color: Color,
) -> void:
	for vertex in [a, b, c]:
		surface.set_normal(normal)
		surface.set_color(color)
		surface.add_vertex(vertex)


func _basis_from_y(direction: Vector3) -> Basis:
	var y_axis: Vector3 = direction.normalized()
	var x_axis: Vector3 = Vector3.FORWARD.cross(y_axis)
	if x_axis.length_squared() < 0.000001:
		x_axis = Vector3.RIGHT
	x_axis = x_axis.normalized()
	var z_axis: Vector3 = x_axis.cross(y_axis).normalized()
	return Basis(x_axis, y_axis, z_axis)


func _crystal_color(instruction) -> Color:
	return _visual_profile.base_color(instruction)


func _safe_node_name(value: String) -> String:
	return value.replace(":", "_").replace("/", "_").replace("@", "_")
