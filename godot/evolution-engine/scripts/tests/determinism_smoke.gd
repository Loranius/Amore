extends SceneTree

const Model = preload("res://scripts/core/evolution_model.gd")
const GrowthEngine = preload("res://scripts/growth/growth_engine.gd")
const CrystalSpecies = preload("res://scripts/species/crystal_species.gd")
const CrystalMeshBuilder = preload("res://scripts/geometry/crystal_mesh_builder.gd")


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

		var instance: MeshInstance3D = builder.create_mesh_instance(instruction)
		var mesh := instance.mesh as ArrayMesh
		if mesh == null or mesh.get_surface_count() != 1:
			return "Geometry failure: crystal mesh surface is missing."
		var bounds: AABB = mesh.get_aabb()
		if bounds.size.y < instruction.length * 0.95:
			return "Geometry failure: crystal morphology lost vertical extent."
		if bounds.size.x < instruction.radius * 1.35 or bounds.size.z < instruction.radius * 1.35:
			return "Geometry failure: crystal morphology collapsed laterally."

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
			var radial := Vector3(vertex.x, 0.0, vertex.z)
			if radial.length_squared() < instruction.radius * instruction.radius * 0.1:
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

		var material := mesh.surface_get_material(0) as StandardMaterial3D
		if material == null:
			return "Material failure: optical material is missing."
		if not material.rim_enabled or material.rim < 0.1 or material.rim > 0.34:
			return "Material failure: bounded rim contract is invalid."
		if not material.clearcoat_enabled or material.clearcoat < 0.3 or material.clearcoat > 0.72:
			return "Material failure: bounded clearcoat contract is invalid."
		if material.clearcoat_roughness < 0.07 or material.clearcoat_roughness > 0.25:
			return "Material failure: clearcoat roughness is outside bounds."
		if not material.backlight_enabled:
			return "Material failure: internal backlight cue is disabled."
		if material.roughness < 0.15 or material.roughness > 0.31:
			return "Material failure: surface roughness is outside bounds."
		if material.emission_energy_multiplier > 0.065:
			return "Material failure: internal emission exceeds the mobile bound."

	return ""


func _fail(message: String) -> void:
	push_error(message)
	quit(1)


func _events_from_payloads(payloads: Array) -> Array:
	var events: Array = []
	for payload in payloads:
		events.append(Model.EvolutionEvent.from_dictionary(payload))
	return events
