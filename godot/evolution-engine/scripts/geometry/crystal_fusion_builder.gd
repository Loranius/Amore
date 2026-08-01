extends RefCounted

## Adds the low-profile druse foundation and short crystalline sleeves that hide
## parent/child intersection seams without transparency or runtime booleans.
## All geometry is derived from canonical GrowthInstruction metadata.


func create_foundation_instance(mother) -> MeshInstance3D:
	var instance := MeshInstance3D.new()
	instance.name = "CrystalFoundation"
	instance.mesh = create_foundation_mesh(mother)
	instance.set_meta("growth_id", "crystal:foundation")
	instance.set_meta("parent_id", mother.id)
	instance.set_meta("role", "foundation")
	return instance


func create_junction_instance(instruction) -> MeshInstance3D:
	var instance := MeshInstance3D.new()
	instance.name = _safe_node_name("junction:%s" % instruction.id)
	instance.mesh = create_junction_mesh(instruction)
	instance.position = instruction.attach_position
	instance.basis = _basis_from_y(instruction.direction)
	instance.set_meta("growth_id", "junction:%s" % instruction.id)
	instance.set_meta("parent_id", instruction.parent_id)
	instance.set_meta("role", "fusion-junction")
	return instance


func create_foundation_mesh(mother) -> ArrayMesh:
	var surface := SurfaceTool.new()
	surface.begin(Mesh.PRIMITIVE_TRIANGLES)

	var sides: int = clampi(int(mother.metadata.get("foundation_sides", 11)), 9, 14)
	var radius_ratio: float = clampf(
		float(mother.metadata.get("foundation_radius_ratio", 1.56)),
		1.42,
		1.72,
	)
	var height_ratio: float = clampf(
		float(mother.metadata.get("foundation_height_ratio", 0.72)),
		0.58,
		0.86,
	)
	var irregularity: float = clampf(
		float(mother.metadata.get("foundation_irregularity", 0.085)),
		0.035,
		0.14,
	)
	var phase: float = float(mother.metadata.get("foundation_phase", 0.0))
	var center: Vector3 = Vector3(
		mother.attach_position.x
			+ float(mother.metadata.get("foundation_offset_x", 0.0)) * mother.radius,
		0.0,
		mother.attach_position.z
			+ float(mother.metadata.get("foundation_offset_z", 0.0)) * mother.radius,
	)
	var radius: float = mother.radius * radius_ratio
	var height: float = mother.radius * height_ratio
	var bottom_y: float = mother.attach_position.y - mother.radius * 0.075
	var skirt_y: float = mother.attach_position.y + height * 0.16
	var shoulder_y: float = mother.attach_position.y + height * 0.58
	var crown_y: float = mother.attach_position.y + height * 0.84
	var top: Vector3 = center + Vector3.UP * (mother.attach_position.y + height)
	var color: Color = _crystal_color(mother).darkened(0.1)

	var bottom_ring: Array[Vector3] = _build_foundation_ring(
		sides,
		radius * 0.92,
		bottom_y,
		phase,
		irregularity * 0.62,
		center,
		height * 0.035,
	)
	var skirt_ring: Array[Vector3] = _build_foundation_ring(
		sides,
		radius,
		skirt_y,
		phase + 0.035,
		irregularity,
		center,
		height * 0.055,
	)
	var shoulder_ring: Array[Vector3] = _build_foundation_ring(
		sides,
		radius * 0.72,
		shoulder_y,
		phase + 0.07,
		irregularity * 0.86,
		center,
		height * 0.04,
	)
	var crown_ring: Array[Vector3] = _build_foundation_ring(
		sides,
		radius * 0.38,
		crown_y,
		phase + 0.11,
		irregularity * 0.58,
		center,
		height * 0.022,
	)

	_connect_rings(surface, bottom_ring, skirt_ring, color.darkened(0.11))
	_connect_rings(surface, skirt_ring, shoulder_ring, color.darkened(0.045))
	_connect_rings(surface, shoulder_ring, crown_ring, color.lightened(0.018))

	for side in range(sides):
		var next: int = (side + 1) % sides
		_add_triangle_clockwise(
			surface,
			crown_ring[side],
			crown_ring[next],
			top,
			color.lightened(0.035 + float(side % 2) * 0.012),
		)

	var bottom_center: Vector3 = center + Vector3.UP * bottom_y
	for side in range(sides):
		var next: int = (side + 1) % sides
		_add_triangle_with_normal(
			surface,
			bottom_center,
			bottom_ring[next],
			bottom_ring[side],
			Vector3.DOWN,
			color.darkened(0.18),
		)

	var mesh: ArrayMesh = surface.commit()
	mesh.surface_set_material(0, _build_foundation_material(color))
	return mesh


func create_junction_mesh(instruction) -> ArrayMesh:
	var surface := SurfaceTool.new()
	surface.begin(Mesh.PRIMITIVE_TRIANGLES)

	var sides: int = instruction.sides
	var merge_depth: float = clampf(
		float(instruction.metadata.get("merge_depth_ratio", 0.52)),
		0.42,
		0.72,
	)
	var root_core_ratio: float = clampf(
		float(instruction.metadata.get("root_core_ratio", 0.76)),
		0.64,
		0.88,
	)
	var flare_ratio: float = clampf(
		float(instruction.metadata.get("junction_flare_ratio", 1.46)),
		1.32,
		1.62,
	)
	var sleeve_ratio: float = clampf(
		float(instruction.metadata.get("junction_sleeve_ratio", 1.08)),
		1.02,
		1.18,
	)
	var junction_height_ratio: float = clampf(
		float(instruction.metadata.get("junction_height_ratio", 0.035)),
		0.012,
		0.065,
	)
	var sleeve_height_ratio: float = clampf(
		float(instruction.metadata.get("junction_sleeve_height_ratio", 0.14)),
		0.1,
		0.2,
	)
	var phase: float = float(instruction.metadata.get("facet_phase", 0.0))
	var twist: float = float(instruction.metadata.get("ring_twist", 0.0))
	var ridge: float = clampf(
		float(instruction.metadata.get("ridge_strength", 0.055)),
		0.0,
		0.14,
	)
	var root_y: float = -minf(
		instruction.length * 0.14,
		instruction.radius * merge_depth * 0.94,
	)
	var flare_y: float = instruction.length * junction_height_ratio
	var sleeve_y: float = maxf(
		instruction.length * sleeve_height_ratio,
		flare_y + instruction.radius * 0.48,
	)
	var color: Color = _crystal_color(instruction).darkened(0.035)

	var root_ring: Array[Vector3] = _build_ring(
		sides,
		instruction.radius * root_core_ratio,
		root_y,
		phase,
		ridge * 0.35,
	)
	var flare_ring: Array[Vector3] = _build_ring(
		sides,
		instruction.radius * flare_ratio,
		flare_y,
		phase + twist * 0.08,
		ridge * 0.7,
	)
	var sleeve_ring: Array[Vector3] = _build_ring(
		sides,
		instruction.radius * sleeve_ratio,
		sleeve_y,
		phase + twist * 0.2,
		ridge * 0.52,
	)

	_connect_rings(surface, root_ring, flare_ring, color.darkened(0.055))
	_connect_rings(surface, flare_ring, sleeve_ring, color.lightened(0.012))

	var mesh: ArrayMesh = surface.commit()
	mesh.surface_set_material(0, _build_junction_material(instruction, color))
	return mesh


func _build_foundation_ring(
	sides: int,
	radius: float,
	y: float,
	phase: float,
	irregularity: float,
	center: Vector3,
	vertical_wave: float,
) -> Array[Vector3]:
	var ring: Array[Vector3] = []
	for side in range(sides):
		var angle: float = TAU * float(side) / float(sides) + phase
		var harmonic: float = (
			sin(angle * 2.0 + phase * 2.7) * 0.58
			+ cos(angle * 3.0 - phase * 1.4) * 0.42
		)
		var local_radius: float = radius * (1.0 + harmonic * irregularity)
		var local_y: float = y + sin(angle * 3.0 + phase) * vertical_wave
		var radial: Vector3 = Vector3(cos(angle), 0.0, sin(angle))
		ring.append(center + radial * local_radius + Vector3.UP * local_y)
	return ring


func _build_ring(
	sides: int,
	radius: float,
	y: float,
	phase: float,
	ridge_strength: float,
) -> Array[Vector3]:
	var ring: Array[Vector3] = []
	for side in range(sides):
		var angle: float = TAU * float(side) / float(sides) + phase
		var harmonic: float = (
			sin(angle * 2.0 + phase * 3.0) * 0.62
			+ cos(angle * 3.0 - phase * 1.7) * 0.38
		)
		var local_radius: float = radius * (1.0 + harmonic * ridge_strength)
		var radial: Vector3 = Vector3(cos(angle), 0.0, sin(angle))
		ring.append(radial * local_radius + Vector3.UP * y)
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
		var facet_color: Color = color.lightened(float(side % 3) * 0.012)
		_add_quad_clockwise(
			surface,
			lower[side],
			lower[next],
			upper[next],
			upper[side],
			facet_color,
		)


func _build_foundation_material(color: Color) -> StandardMaterial3D:
	var material := StandardMaterial3D.new()
	material.vertex_color_use_as_albedo = true
	material.albedo_color = Color.WHITE
	material.cull_mode = BaseMaterial3D.CULL_BACK
	material.roughness = 0.46
	material.metallic = 0.008
	material.metallic_specular = 0.46
	material.rim_enabled = true
	material.rim = 0.045
	material.rim_tint = 0.38
	material.clearcoat_enabled = true
	material.clearcoat = 0.22
	material.clearcoat_roughness = 0.34
	material.emission_enabled = true
	material.emission = color.darkened(0.52)
	material.emission_energy_multiplier = 0.004
	return material


func _build_junction_material(instruction, color: Color) -> StandardMaterial3D:
	var energy: float = clampf(instruction.energy, 0.0, 1.0)
	var material := StandardMaterial3D.new()
	material.vertex_color_use_as_albedo = true
	material.albedo_color = Color.WHITE
	material.cull_mode = BaseMaterial3D.CULL_BACK
	material.roughness = lerpf(0.4, 0.29, energy)
	material.metallic = 0.008
	material.metallic_specular = lerpf(0.44, 0.58, energy)
	material.rim_enabled = true
	material.rim = lerpf(0.045, 0.095, energy)
	material.rim_tint = 0.42
	material.clearcoat_enabled = true
	material.clearcoat = lerpf(0.18, 0.36, energy)
	material.clearcoat_roughness = lerpf(0.32, 0.22, energy)
	material.emission_enabled = true
	material.emission = color.darkened(0.5)
	material.emission_energy_multiplier = 0.003 + energy * 0.008
	return material


func _add_quad_clockwise(
	surface: SurfaceTool,
	a: Vector3,
	b: Vector3,
	c: Vector3,
	d: Vector3,
	color: Color,
) -> void:
	var outward: Vector3 = (d - a).cross(b - a).normalized()
	_add_triangle_with_normal(surface, a, c, b, outward, color)
	_add_triangle_with_normal(surface, a, d, c, outward, color)


func _add_triangle_clockwise(
	surface: SurfaceTool,
	a: Vector3,
	b: Vector3,
	c: Vector3,
	color: Color,
) -> void:
	var outward: Vector3 = (c - a).cross(b - a).normalized()
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
	var y_axis: Vector3 = direction.normalized()
	var x_axis: Vector3 = Vector3.FORWARD.cross(y_axis)
	if x_axis.length_squared() < 0.000001:
		x_axis = Vector3.RIGHT
	x_axis = x_axis.normalized()
	var z_axis: Vector3 = x_axis.cross(y_axis).normalized()
	return Basis(x_axis, y_axis, z_axis)


func _crystal_color(instruction) -> Color:
	var hue_shift: float = float(instruction.metadata.get("hue_shift", 0.0))
	var hue: float = fposmod(0.765 + hue_shift + float(instruction.generation) * 0.014, 1.0)
	var saturation: float = clampf(0.34 + instruction.energy * 0.11, 0.0, 1.0)
	var value: float = clampf(0.64 + instruction.energy * 0.13, 0.0, 1.0)
	return Color.from_hsv(hue, saturation, value, 1.0)


func _safe_node_name(value: String) -> String:
	return value.replace(":", "_").replace("/", "_").replace("@", "_")
