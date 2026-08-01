extends SceneTree

const Model = preload("res://scripts/core/evolution_model.gd")
const GrowthEngine = preload("res://scripts/growth/growth_engine.gd")
const CrystalSpecies = preload("res://scripts/species/crystal_species.gd")
const CrystalMeshBuilder = preload("res://scripts/geometry/crystal_mesh_builder.gd")
const CrystalFusionBuilder = preload("res://scripts/geometry/crystal_fusion_builder.gd")


func _init() -> void:
	call_deferred("_run")


func _run() -> void:
	var dna := Model.ArtifactDNA.new(
		582013,
		&"crystal",
		"godot-0.1.0",
		{"identity": "determinism-smoke"},
	)
	var payloads := [
		{
			"id": "event:b",
			"occurred_at": "2025-02-01",
			"source": "plans@1",
			"channels": {"achievement": 0.82, "stability": 0.4},
			"portal_activity": 0.33,
		},
		{
			"id": "event:a",
			"occurred_at": "2024-01-01",
			"source": "memories@1",
			"channels": {"remembrance": 0.91, "significance": 0.72},
			"portal_activity": 0.27,
		},
		{
			"id": "event:c",
			"occurred_at": "2026-03-03",
			"source": "map@1",
			"channels": {"exploration": 0.88, "culture": 0.2},
			"portal_activity": 0.38,
		},
	]

	var forward_events := _events_from_payloads(payloads)
	var reverse_payloads := payloads.duplicate(true)
	reverse_payloads.reverse()
	var reverse_events := _events_from_payloads(reverse_payloads)

	var first_state = GrowthEngine.new().rebuild(dna, forward_events)
	var second_state = GrowthEngine.new().rebuild(dna, reverse_events)
	var first_snapshot := JSON.stringify(first_state.canonical_snapshot())
	var second_snapshot := JSON.stringify(second_state.canonical_snapshot())

	if first_snapshot != second_snapshot:
		_fail("Determinism failure: input ordering changed canonical state.")
		return

	var genesis_count: int = 1 + CrystalSpecies.BASAL_CROWN_COUNT
	if first_state.instructions.size() != payloads.size() + genesis_count:
		_fail("Growth history failure: expected genesis druse plus one instruction per event.")
		return

	if first_state.history.size() != first_state.instructions.size():
		_fail("Append-only history failure: history and instruction counts differ.")
		return

	var mother = first_state.instructions[0]
	if mother.id != CrystalSpecies.MOTHER_ID or mother.generation != 0 or not mother.parent_id.is_empty():
		_fail("Genesis failure: mother crystal identity is invalid.")
		return

	for index in range(1, genesis_count):
		var basal = first_state.instructions[index]
		if basal.parent_id != mother.id or basal.generation != 1:
			_fail("Genesis failure: basal crown lineage is invalid.")
			return
		if String(basal.metadata.get("role", "")) != "basal-crown":
			_fail("Genesis failure: basal crown role is missing.")
			return
		if float(basal.metadata.get("merge_depth_ratio", 0.0)) < 0.5:
			_fail("Attachment failure: basal crown is not embedded deeply enough.")
			return
		var radial_distance: float = Vector2(
			basal.attach_position.x - mother.attach_position.x,
			basal.attach_position.z - mother.attach_position.z,
		).length()
		var radial_ratio: float = radial_distance / mother.radius
		if radial_ratio < 0.65 or radial_ratio > 0.88:
			_fail("Attachment failure: basal crown root is not near the mother surface.")
			return

		for other_index in range(index + 1, genesis_count):
			var other = first_state.instructions[other_index]
			var root_distance: float = basal.attach_position.distance_to(other.attach_position)
			var minimum_root_distance: float = (basal.radius + other.radius) * 0.95
			if root_distance < minimum_root_distance:
				_fail("Competition failure: basal crown roots overlap too strongly.")
				return

	for index in range(genesis_count, first_state.instructions.size()):
		var event_growth = first_state.instructions[index]
		if first_state.get_instruction(event_growth.parent_id) == null:
			_fail("Lineage failure: event growth parent is missing.")
			return
		var merge_depth: float = float(event_growth.metadata.get("merge_depth_ratio", 0.0))
		if merge_depth < 0.45 or merge_depth > 0.7:
			_fail("Attachment failure: event growth merge depth is outside bounds.")
			return
		var surface_offset: float = float(event_growth.metadata.get("surface_offset_ratio", 0.0))
		if surface_offset < 0.7 or surface_offset > 0.9:
			_fail("Attachment failure: event growth root is not near the parent surface.")
			return

	var morphology_error := _validate_morphology(first_state.instructions)
	if not morphology_error.is_empty():
		_fail(morphology_error)
		return

	var fusion_error := _validate_fusion(first_state.instructions)
	if not fusion_error.is_empty():
		_fail(fusion_error)
		return

	var environment_error := _validate_environment()
	if not environment_error.is_empty():
		_fail(environment_error)
		return

	print("PASS: deterministic crystal rebuild; instructions=%d" % first_state.instructions.size())
	quit(0)


func _validate_morphology(instructions: Array) -> String:
	var builder = CrystalMeshBuilder.new()
	for instruction in instructions:
		var body_taper: float = float(instruction.metadata.get("body_taper", -1.0))
		var waist_ratio: float = float(instruction.metadata.get("waist_ratio", -1.0))
		var shoulder_height: float = float(instruction.metadata.get("shoulder_height_ratio", -1.0))
		var termination_depth: float = float(instruction.metadata.get("termination_depth_ratio", -1.0))
		var ridge_strength: float = float(instruction.metadata.get("ridge_strength", -1.0))
		var tip_offset := Vector2(
			float(instruction.metadata.get("tip_offset_x", 0.0)),
			float(instruction.metadata.get("tip_offset_z", 0.0)),
		)

		if body_taper < 0.68 or body_taper > 1.0:
			return "Morphology failure: body taper is outside bounds."
		if waist_ratio < 0.8 or waist_ratio > 1.12:
			return "Morphology failure: waist ratio is outside bounds."
		if shoulder_height < 0.55 or shoulder_height > 0.84:
			return "Morphology failure: shoulder height is outside bounds."
		if termination_depth < 0.12 or termination_depth > 0.36:
			return "Morphology failure: termination depth is outside bounds."
		if ridge_strength < 0.0 or ridge_strength > 0.14:
			return "Morphology failure: ridge strength is outside bounds."
		if tip_offset.length() > 0.36:
			return "Morphology failure: tip offset is outside bounds."

		var mesh: ArrayMesh = builder.create_mesh(instruction)
		if mesh == null or mesh.get_surface_count() != 1:
			return "Geometry failure: crystal mesh surface is missing."
		var bounds: AABB = mesh.get_aabb()
		if bounds.size.y < instruction.length * 0.95:
			return "Geometry failure: crystal morphology lost vertical extent."
		if bounds.size.x < instruction.radius * 1.35 or bounds.size.z < instruction.radius * 1.35:
			return "Geometry failure: crystal morphology collapsed laterally."

		var normal_error := _validate_outward_normals(mesh, Vector3.ZERO, instruction.radius)
		if not normal_error.is_empty():
			return normal_error

		var material := mesh.surface_get_material(0) as StandardMaterial3D
		if material == null:
			return "Material failure: optical material is missing."
		if not material.rim_enabled or material.rim < 0.05 or material.rim > 0.19:
			return "Material failure: bounded rim contract is invalid."
		if not material.clearcoat_enabled or material.clearcoat < 0.25 or material.clearcoat > 0.65:
			return "Material failure: bounded clearcoat contract is invalid."
		if material.clearcoat_roughness < 0.1 or material.clearcoat_roughness > 0.3:
			return "Material failure: clearcoat roughness is outside bounds."
		if not material.backlight_enabled:
			return "Material failure: internal backlight cue is disabled."
		if material.roughness < 0.2 or material.roughness > 0.35:
			return "Material failure: surface roughness is outside bounds."
		if material.emission_energy_multiplier > 0.03:
			return "Material failure: internal emission exceeds the mobile bound."

	return ""


func _validate_fusion(instructions: Array) -> String:
	if instructions.is_empty():
		return "Fusion failure: no mother instruction is available."
	var builder = CrystalFusionBuilder.new()
	var mother = instructions[0]
	var foundation_radius: float = float(mother.metadata.get("foundation_radius_ratio", -1.0))
	var foundation_height: float = float(mother.metadata.get("foundation_height_ratio", -1.0))
	var foundation_irregularity: float = float(
		mother.metadata.get("foundation_irregularity", -1.0),
	)
	var foundation_sides: int = int(mother.metadata.get("foundation_sides", 0))
	if foundation_radius < 1.42 or foundation_radius > 1.72:
		return "Fusion failure: foundation radius ratio is outside bounds."
	if foundation_height < 0.58 or foundation_height > 0.86:
		return "Fusion failure: foundation height ratio is outside bounds."
	if foundation_irregularity < 0.035 or foundation_irregularity > 0.14:
		return "Fusion failure: foundation irregularity is outside bounds."
	if foundation_sides < 9 or foundation_sides > 14:
		return "Fusion failure: foundation side count is outside bounds."

	var foundation_mesh: ArrayMesh = builder.create_foundation_mesh(mother)
	if foundation_mesh == null or foundation_mesh.get_surface_count() != 1:
		return "Fusion failure: foundation mesh surface is missing."
	var foundation_bounds: AABB = foundation_mesh.get_aabb()
	if foundation_bounds.size.x < mother.radius * 2.35:
		return "Fusion failure: foundation does not cover enough lateral width."
	if foundation_bounds.size.z < mother.radius * 2.35:
		return "Fusion failure: foundation does not cover enough depth."
	if foundation_bounds.size.y < mother.radius * 0.58:
		return "Fusion failure: foundation is too flat to hide basal roots."
	var foundation_center := Vector3(
		mother.attach_position.x
			+ float(mother.metadata.get("foundation_offset_x", 0.0)) * mother.radius,
		0.0,
		mother.attach_position.z
			+ float(mother.metadata.get("foundation_offset_z", 0.0)) * mother.radius,
	)
	var foundation_normal_error := _validate_outward_normals(
		foundation_mesh,
		foundation_center,
		mother.radius,
	)
	if not foundation_normal_error.is_empty():
		return "Fusion foundation: " + foundation_normal_error
	var foundation_material := foundation_mesh.surface_get_material(0) as StandardMaterial3D
	if foundation_material == null:
		return "Fusion failure: foundation material is missing."
	if foundation_material.roughness < 0.42 or foundation_material.roughness > 0.5:
		return "Fusion failure: foundation roughness is outside bounds."
	if not foundation_material.clearcoat_enabled:
		return "Fusion failure: foundation clearcoat is disabled."
	if foundation_material.clearcoat < 0.18 or foundation_material.clearcoat > 0.26:
		return "Fusion failure: foundation clearcoat is outside bounds."
	if foundation_material.emission_energy_multiplier > 0.008:
		return "Fusion failure: foundation emission exceeds the mobile bound."

	for instruction in instructions:
		if instruction.generation <= 0:
			continue
		var root_core: float = float(instruction.metadata.get("root_core_ratio", -1.0))
		var flare: float = float(instruction.metadata.get("junction_flare_ratio", -1.0))
		var sleeve: float = float(instruction.metadata.get("junction_sleeve_ratio", -1.0))
		var junction_height: float = float(
			instruction.metadata.get("junction_height_ratio", -1.0),
		)
		var sleeve_height: float = float(
			instruction.metadata.get("junction_sleeve_height_ratio", -1.0),
		)
		if root_core < 0.64 or root_core > 0.88:
			return "Fusion failure: buried root core ratio is outside bounds."
		if flare < 1.32 or flare > 1.62:
			return "Fusion failure: junction flare ratio is outside bounds."
		if sleeve < 1.02 or sleeve > 1.18:
			return "Fusion failure: junction sleeve ratio is outside bounds."
		if junction_height < 0.012 or junction_height > 0.065:
			return "Fusion failure: junction flare height is outside bounds."
		if sleeve_height < 0.1 or sleeve_height > 0.2:
			return "Fusion failure: junction sleeve height is outside bounds."
		if flare <= root_core * 1.55:
			return "Fusion failure: junction does not widen enough above its buried root."

		var junction_mesh: ArrayMesh = builder.create_junction_mesh(instruction)
		if junction_mesh == null or junction_mesh.get_surface_count() != 1:
			return "Fusion failure: junction mesh surface is missing."
		var junction_bounds: AABB = junction_mesh.get_aabb()
		if junction_bounds.position.y >= -instruction.radius * 0.2:
			return "Fusion failure: junction root is not buried below the attachment plane."
		if junction_bounds.size.x < instruction.radius * 2.3:
			return "Fusion failure: junction flare collapsed laterally."
		if junction_bounds.size.z < instruction.radius * 2.3:
			return "Fusion failure: junction flare collapsed in depth."

		var arrays: Array = junction_mesh.surface_get_arrays(0)
		var vertices: PackedVector3Array = arrays[Mesh.ARRAY_VERTEX]
		var minimum_y: float = 1.0e20
		for vertex in vertices:
			minimum_y = minf(minimum_y, vertex.y)
		var root_radius := 0.0
		var flare_radius := 0.0
		for vertex in vertices:
			var radial_radius: float = Vector2(vertex.x, vertex.z).length()
			if absf(vertex.y - minimum_y) < 0.0001:
				root_radius = maxf(root_radius, radial_radius)
			elif vertex.y > 0.0 and vertex.y < instruction.length * 0.08:
				flare_radius = maxf(flare_radius, radial_radius)
		if root_radius <= 0.0 or flare_radius <= root_radius * 1.45:
			return "Fusion failure: generated flare does not cover the buried root seam."

		var junction_normal_error := _validate_outward_normals(
			junction_mesh,
			Vector3.ZERO,
			instruction.radius,
		)
		if not junction_normal_error.is_empty():
			return "Fusion junction: " + junction_normal_error
		var junction_material := junction_mesh.surface_get_material(0) as StandardMaterial3D
		if junction_material == null:
			return "Fusion failure: junction material is missing."
		if junction_material.roughness < 0.27 or junction_material.roughness > 0.42:
			return "Fusion failure: junction roughness is outside bounds."
		if junction_material.emission_energy_multiplier > 0.014:
			return "Fusion failure: junction emission exceeds the mobile bound."

	return ""


func _validate_outward_normals(mesh: ArrayMesh, radial_center: Vector3, scale: float) -> String:
	var arrays: Array = mesh.surface_get_arrays(0)
	var vertices: PackedVector3Array = arrays[Mesh.ARRAY_VERTEX]
	var normals: PackedVector3Array = arrays[Mesh.ARRAY_NORMAL]
	if vertices.is_empty() or vertices.size() != normals.size():
		return "Geometry failure: vertex and normal buffers are inconsistent."
	var directional_samples := 0
	var outward_samples := 0
	for vertex_index in range(vertices.size()):
		var normal: Vector3 = normals[vertex_index]
		if normal.length() < 0.98 or normal.length() > 1.02:
			return "Geometry failure: facet normal is not normalized."
		var vertex: Vector3 = vertices[vertex_index]
		var radial := Vector3(
			vertex.x - radial_center.x,
			0.0,
			vertex.z - radial_center.z,
		)
		if radial.length_squared() < scale * scale * 0.1:
			continue
		if absf(normal.y) > 0.97:
			continue
		directional_samples += 1
		if normal.dot(radial.normalized()) > 0.0:
			outward_samples += 1
	if directional_samples == 0:
		return "Geometry failure: no directional normal samples were found."
	var outward_ratio: float = float(outward_samples) / float(directional_samples)
	if outward_ratio < 0.72:
		return "Geometry failure: facet normals are not predominantly outward."
	return ""


func _validate_environment() -> String:
	var packed_scene := load("res://scenes/evolution_engine.tscn") as PackedScene
	if packed_scene == null:
		return "Environment failure: main scene could not be loaded."
	var root := packed_scene.instantiate()
	var world_environment := root.get_node_or_null("WorldEnvironment") as WorldEnvironment
	if world_environment == null or world_environment.environment == null:
		root.free()
		return "Environment failure: WorldEnvironment is missing."
	var environment := world_environment.environment
	if environment.background_mode != Environment.BG_SKY:
		root.free()
		return "Environment failure: background is not Sky-based."
	if environment.ambient_light_source != Environment.AMBIENT_SOURCE_SKY:
		root.free()
		return "Environment failure: ambient light is not Sky-based."
	if environment.reflected_light_source != Environment.REFLECTION_SOURCE_SKY:
		root.free()
		return "Environment failure: reflected light is not Sky-based."
	if environment.sky == null or environment.sky.sky_material == null:
		root.free()
		return "Environment failure: procedural radiance Sky is missing."
	if environment.sky.radiance_size > Sky.RADIANCE_SIZE_64:
		root.free()
		return "Environment failure: radiance map exceeds the mobile budget."
	root.free()
	return ""


func _fail(message: String) -> void:
	push_error(message)
	quit(1)


func _events_from_payloads(payloads: Array) -> Array:
	var events: Array = []
	for payload in payloads:
		events.append(Model.EvolutionEvent.from_dictionary(payload))
	return events
