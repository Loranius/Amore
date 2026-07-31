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
	var merge_depth_ratio := float(instruction.metadata.get("merge_depth_ratio", 0.0))
	var attached := instruction.generation > 0
	var base_radius: float = instruction.radius * (1.34 if attached else 1.08)
	var lower_radius: float = instruction.radius * (1.03 if attached else 1.0)
	var shoulder_radius: float = instruction.radius * 0.76
	var base_y: float = -minf(
		instruction.length * 0.1,
		instruction.radius * merge_depth_ratio * 0.72,
	) if attached else 0.0
	var lower_y: float = instruction.length * 0.12
	var shoulder_y: float = instruction.length * 0.78
	var tip := Vector3(0.0, instruction.length, 0.0)
	var color := _crystal_color(instruction)

	var base_ring: Array[Vector3] = []
	var lower_ring: Array[Vector3] = []
	var shoulder_ring: Array[Vector3] = []

	for side in range(sides):
		var angle := TAU * float(side) / float(sides)
		var radial := Vector3(cos(angle), 0.0, sin(angle))
		base_ring.append(radial * base_radius + Vector3.UP * base_y)
		lower_ring.append(radial * lower_radius + Vector3.UP * lower_y)
		shoulder_ring.append(radial * shoulder_radius + Vector3.UP * shoulder_y)

	for side in range(sides):
		var next := (side + 1) % sides
		_add_quad_clockwise(
			surface,
			base_ring[side],
			base_ring[next],
			lower_ring[next],
			lower_ring[side],
			color.darkened(0.12),
		)
		_add_quad_clockwise(
			surface,
			lower_ring[side],
			lower_ring[next],
			shoulder_ring[next],
			shoulder_ring[side],
			color.lightened(float(side % 3) * 0.025),
		)
		_add_triangle_clockwise(
			surface,
			shoulder_ring[side],
			shoulder_ring[next],
			tip,
			color.lightened(0.075),
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
