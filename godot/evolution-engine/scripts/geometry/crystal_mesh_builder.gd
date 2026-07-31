extends RefCounted

## Builds one faceted crystal column from an accepted GrowthInstruction.
## Meshes are local +Y columns and are oriented by the runtime transform.


func create_mesh_instance(instruction) -> MeshInstance3D:
	var instance := MeshInstance3D.new()
	instance.name = _safe_node_name(instruction.id)
	instance.mesh = _build_mesh(instruction)
	instance.position = instruction.attach_position
	instance.basis = _basis_from_y(instruction.direction)
	instance.set_meta("growth_id", instruction.id)
	instance.set_meta("parent_id", instruction.parent_id)
	instance.set_meta("generation", instruction.generation)
	return instance


func _build_mesh(instruction) -> ArrayMesh:
	var surface := SurfaceTool.new()
	surface.begin(Mesh.PRIMITIVE_TRIANGLES)

	var sides: int = instruction.sides
	var merge_depth_ratio: float = float(instruction.metadata.get("merge_depth_ratio", 0.0))
	var attached: bool = instruction.generation > 0
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
	var center_drift := Vector3(
		float(instruction.metadata.get("center_drift_x", 0.0)) * instruction.radius,
		0.0,
		float(instruction.metadata.get("center_drift_z", 0.0)) * instruction.radius,
	)
	var tip_offset := Vector3(
		float(instruction.metadata.get("tip_offset_x", 0.0)) * instruction.radius,
		0.0,
		float(instruction.metadata.get("tip_offset_z", 0.0)) * instruction.radius,
	)

	var base_radius: float = instruction.radius * (1.34 if attached else 1.08)
	var lower_radius: float = instruction.radius * (1.03 if attached else 1.0)
	var mid_radius: float = instruction.radius * waist_ratio
	var shoulder_radius: float = instruction.radius * body_taper
	var termination_radius: float = shoulder_radius * lerpf(0.62, 0.78, instruction.energy)
	var base_y: float = -minf(
		instruction.length * 0.1,
		instruction.radius * merge_depth_ratio * 0.72,
	) if attached else 0.0
	var lower_y: float = instruction.length * 0.12
	var mid_y: float = instruction.length * 0.46
	var shoulder_y: float = instruction.length * shoulder_height_ratio
	var termination_y: float = instruction.length * (1.0 - termination_depth_ratio)
	termination_y = maxf(shoulder_y + instruction.length * 0.055, termination_y)
	termination_y = minf(instruction.length * 0.9, termination_y)
	var tip := Vector3(
		center_drift.x + tip_offset.x,
		instruction.length,
		center_drift.z + tip_offset.z,
	)
	var color := _crystal_color(instruction)

	var base_ring: Array[Vector3] = _build_ring(
		sides,
		base_radius,
		base_y,
		facet_phase,
		ridge_strength * 0.42,
		Vector3.ZERO,
	)
	var lower_ring: Array[Vector3] = _build_ring(
		sides,
		lower_radius,
		lower_y,
		facet_phase + ring_twist * 0.22,
		ridge_strength * 0.7,
		center_drift * 0.18,
	)
	var mid_ring: Array[Vector3] = _build_ring(
		sides,
		mid_radius,
		mid_y,
		facet_phase + ring_twist * 0.55,
		ridge_strength,
		center_drift * 0.62,
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
	)

	_connect_rings(surface, base_ring, lower_ring, color.darkened(0.13))
	_connect_rings(surface, lower_ring, mid_ring, color.darkened(0.035))
	_connect_rings(surface, mid_ring, shoulder_ring, color.lightened(0.018))
	_connect_rings(surface, shoulder_ring, termination_ring, color.lightened(0.04))

	for side in range(sides):
		var next := (side + 1) % sides
		_add_triangle_clockwise(
			surface,
			termination_ring[side],
			termination_ring[next],
			tip,
			color.lightened(0.08 + float(side % 2) * 0.018),
		)

	if bool(instruction.metadata.get("cap_base", false)):
		var center := Vector3(0.0, base_y, 0.0)
		for side in range(sides):
			var next := (side + 1) % sides
			_add_triangle_with_normal(
				surface,
				center,
				base_ring[next],
				base_ring[side],
				Vector3.DOWN,
				color.darkened(0.2),
			)

	var mesh := surface.commit()
	var material := StandardMaterial3D.new()
	material.vertex_color_use_as_albedo = true
	material.roughness = 0.32
	material.metallic = 0.025
	material.cull_mode = BaseMaterial3D.CULL_BACK
	material.albedo_color = Color(1.0, 1.0, 1.0, 1.0)
	material.emission_enabled = true
	material.emission = color.darkened(0.34)
	material.emission_energy_multiplier = 0.035 + instruction.energy * 0.06
	mesh.surface_set_material(0, material)
	return mesh


func _build_ring(
	sides: int,
	radius: float,
	y: float,
	phase: float,
	ridge_strength: float,
	center: Vector3,
) -> Array[Vector3]:
	var ring: Array[Vector3] = []
	for side in range(sides):
		var angle: float = TAU * float(side) / float(sides) + phase
		var harmonic: float = (
			sin(angle * 2.0 + phase * 3.0) * 0.62
			+ cos(angle * 3.0 - phase * 1.7) * 0.38
		)
		var local_radius: float = radius * (1.0 + harmonic * ridge_strength)
		var radial := Vector3(cos(angle), 0.0, sin(angle))
		ring.append(center + radial * local_radius + Vector3.UP * y)
	return ring


func _connect_rings(
	surface: SurfaceTool,
	lower: Array[Vector3],
	upper: Array[Vector3],
	color: Color,
) -> void:
	var sides: int = mini(lower.size(), upper.size())
	for side in range(sides):
		var next: int = (side + 1) % sides
		var facet_color := color.lightened(float(side % 3) * 0.018)
		_add_quad_clockwise(
			surface,
			lower[side],
			lower[next],
			upper[next],
			upper[side],
			facet_color,
		)


func _add_quad_clockwise(
	surface: SurfaceTool,
	a: Vector3,
	b: Vector3,
	c: Vector3,
	d: Vector3,
	color: Color,
) -> void:
	# Godot uses clockwise front-face winding. Normals are calculated from
	# the outward CCW order, while vertices are submitted in reverse order.
	var outward := (b - a).cross(d - a).normalized()
	_add_triangle_with_normal(surface, a, c, b, outward, color)
	_add_triangle_with_normal(surface, a, d, c, outward, color)


func _add_triangle_clockwise(
	surface: SurfaceTool,
	a: Vector3,
	b: Vector3,
	c: Vector3,
	color: Color,
) -> void:
	var outward := (b - a).cross(c - a).normalized()
	_add_triangle_with_normal(surface, a, c, b, outward, color)


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
	var y_axis := direction.normalized()
	var x_axis := Vector3.FORWARD.cross(y_axis)
	if x_axis.length_squared() < 0.000001:
		x_axis = Vector3.RIGHT
	x_axis = x_axis.normalized()
	var z_axis := x_axis.cross(y_axis).normalized()
	return Basis(x_axis, y_axis, z_axis)


func _crystal_color(instruction) -> Color:
	var hue_shift := float(instruction.metadata.get("hue_shift", 0.0))
	var hue := fposmod(0.765 + hue_shift + float(instruction.generation) * 0.014, 1.0)
	var saturation := clampf(0.44 + instruction.energy * 0.13, 0.0, 1.0)
	var value := clampf(0.68 + instruction.energy * 0.15, 0.0, 1.0)
	return Color.from_hsv(hue, saturation, value, 1.0)


func _safe_node_name(value: String) -> String:
	return value.replace(":", "_").replace("/", "_").replace("@", "_")
