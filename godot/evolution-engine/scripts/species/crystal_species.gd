extends RefCounted

const Model = preload("res://scripts/core/evolution_model.gd")
const DeterministicRNG = preload("res://scripts/core/deterministic_rng.gd")

const MOTHER_ID := "crystal:mother"
const BASAL_CROWN_COUNT := 5


func create_genesis_instructions(dna) -> Array:
	var mother = create_mother(dna)
	var instructions: Array = [mother]
	var rng = DeterministicRNG.new(DeterministicRNG.seed_from_text("genesis:basal-crown", dna.seed))
	var phase_offset: float = rng.range_float(-0.18, 0.18)

	for index in range(BASAL_CROWN_COUNT):
		var spin: float = TAU * float(index) / float(BASAL_CROWN_COUNT) + phase_offset
		var radial: Vector3 = Vector3(cos(spin), 0.0, sin(spin)).normalized()
		var attach_position: Vector3 = (
			mother.attach_position
			+ Vector3.UP * rng.range_float(0.03, 0.12)
			+ radial * mother.radius * rng.range_float(0.7, 0.82)
		)
		var direction: Vector3 = (
			radial * rng.range_float(0.54, 0.72)
			+ Vector3.UP * rng.range_float(0.75, 0.96)
		).normalized()
		var energy: float = rng.range_float(0.42, 0.68)
		var metadata: Dictionary = _morphology_metadata(rng, "basal-crown", energy)
		metadata["hue_shift"] = rng.range_float(-0.045, 0.075)
		metadata["cap_base"] = false
		metadata["attachment_ratio"] = 0.03
		metadata["merge_depth_ratio"] = 0.58
		metadata["surface_offset_ratio"] = 0.76
		instructions.append(Model.GrowthInstruction.new(
			"crystal:genesis:basal:%02d" % index,
			MOTHER_ID,
			1,
			attach_position,
			direction,
			rng.range_float(0.15, 0.22),
			rng.range_float(0.68, 1.12),
			rng.range_int(5, 7),
			energy,
			"genesis",
			metadata,
		))

	return instructions


func create_mother(dna) -> RefCounted:
	var rng = DeterministicRNG.new(dna.seed)
	var metadata: Dictionary = _morphology_metadata(rng, "mother", 1.0)
	metadata["hue_shift"] = rng.range_float(-0.035, 0.035)
	metadata["cap_base"] = true
	metadata["merge_depth_ratio"] = 0.0
	return Model.GrowthInstruction.new(
		MOTHER_ID,
		"",
		0,
		Vector3(0.0, -0.18, 0.0),
		Vector3.UP,
		rng.range_float(0.58, 0.72),
		rng.range_float(3.35, 3.95),
		rng.range_int(6, 8),
		1.0,
		"genesis",
		metadata,
	)


func translate_event(dna, event, event_index: int, state) -> RefCounted:
	var decision_seed: int = DeterministicRNG.seed_from_text(
		"%s|%s|%d" % [event.sort_key(), String(dna.species), event_index],
		dna.seed,
	)
	var rng = DeterministicRNG.new(decision_seed)
	var parent = _select_parent(event, event_index, state, rng)
	var parent_direction: Vector3 = parent.direction

	var tangent_a: Vector3 = parent_direction.cross(Vector3.UP)
	if tangent_a.length_squared() < 0.000001:
		tangent_a = parent_direction.cross(Vector3.RIGHT)
	tangent_a = tangent_a.normalized()
	var tangent_b: Vector3 = parent_direction.cross(tangent_a).normalized()

	var spin: float = rng.range_float(0.0, TAU)
	var radial: Vector3 = (tangent_a * cos(spin) + tangent_b * sin(spin)).normalized()
	var along_ratio: float = rng.range_float(0.16, 0.78)
	var parent_radius_at_attachment: float = parent.radius * lerpf(1.08, 0.7, along_ratio)
	var merge_depth_ratio: float = rng.range_float(0.48, 0.66)
	var surface_offset_ratio: float = rng.range_float(0.74, 0.86)
	var attach_position: Vector3 = (
		parent.attach_position
		+ parent_direction * parent.length * along_ratio
		+ radial * parent_radius_at_attachment * surface_offset_ratio
	)

	var significance: float = _channel(event, "significance")
	var remembrance: float = _channel(event, "remembrance")
	var exploration: float = _channel(event, "exploration")
	var achievement: float = _channel(event, "achievement")
	var stability: float = _channel(event, "stability")
	var culture: float = _channel(event, "culture")
	var total_pressure: float = clampf(
		0.18
		+ event.portal_activity * 0.24
		+ significance * 0.18
		+ remembrance * 0.14
		+ achievement * 0.14
		+ exploration * 0.08
		+ stability * 0.08
		+ culture * 0.04,
		0.0,
		1.0,
	)

	var outward_force: float = 0.64 + exploration * 0.16 + achievement * 0.08
	var inherited_force: float = 0.44 + stability * 0.22 + remembrance * 0.08
	var mutation: Vector3 = rng.direction_in_cone(radial, deg_to_rad(18.0 + culture * 10.0))
	var direction: Vector3 = (
		radial * outward_force
		+ parent_direction * inherited_force
		+ mutation * (0.08 + culture * 0.08)
	).normalized()
	if direction.y < 0.1:
		direction = (direction + Vector3.UP * (0.18 - direction.y)).normalized()

	var generation: int = parent.generation + 1
	var generation_scale: float = pow(0.82, float(maxi(0, generation - 1)))
	var radius: float = lerpf(0.16, 0.31, total_pressure) * generation_scale
	var length: float = lerpf(0.82, 1.82, total_pressure) * generation_scale
	var sides: int = rng.range_int(5, 8)
	var metadata: Dictionary = _morphology_metadata(rng, "event-growth", total_pressure)
	metadata["source"] = event.source
	metadata["hue_shift"] = rng.range_float(-0.065, 0.09) + culture * 0.035
	metadata["cap_base"] = false
	metadata["attachment_ratio"] = along_ratio
	metadata["merge_depth_ratio"] = merge_depth_ratio
	metadata["surface_offset_ratio"] = surface_offset_ratio

	return Model.GrowthInstruction.new(
		"crystal:%s" % event.id,
		parent.id,
		generation,
		attach_position,
		direction,
		radius,
		length,
		sides,
		total_pressure,
		event.id,
		metadata,
	)


func _select_parent(event, event_index: int, state, rng) -> RefCounted:
	if event_index < 3:
		return state.instructions[0]

	var remembrance: float = _channel(event, "remembrance")
	var stability: float = _channel(event, "stability")
	if remembrance + stability > 1.2:
		return state.instructions[0]

	# Event growth may use the mother or previously accepted event structures,
	# but the DNA-defined basal crown is not selected as an event parent yet.
	var event_parent_start: int = 1 + BASAL_CROWN_COUNT
	if state.instructions.size() <= event_parent_start:
		return state.instructions[0]
	var available_event_parents: int = state.instructions.size() - event_parent_start
	var selected_event_offset: int = rng.range_int(0, maxi(0, available_event_parents - 1))
	return state.instructions[event_parent_start + selected_event_offset]


func _morphology_metadata(rng, role: String, energy: float) -> Dictionary:
	var body_taper_min := 0.78
	var body_taper_max := 0.92
	var waist_min := 0.9
	var waist_max := 1.04
	var shoulder_min := 0.64
	var shoulder_max := 0.78
	var termination_min := 0.18
	var termination_max := 0.29
	var tip_offset_max := 0.2
	var ridge_min := 0.035
	var ridge_max := 0.09
	var twist_max := 0.075
	var center_drift_max := 0.09

	if role == "mother":
		body_taper_min = 0.84
		body_taper_max = 0.94
		waist_min = 0.95
		waist_max = 1.045
		shoulder_min = 0.69
		shoulder_max = 0.79
		termination_min = 0.17
		termination_max = 0.23
		tip_offset_max = 0.13
		ridge_min = 0.025
		ridge_max = 0.065
		twist_max = 0.045
		center_drift_max = 0.055
	elif role == "basal-crown":
		body_taper_min = 0.76
		body_taper_max = 0.9
		waist_min = 0.88
		waist_max = 1.055
		shoulder_min = 0.61
		shoulder_max = 0.76
		termination_min = 0.2
		termination_max = 0.31
		tip_offset_max = 0.24
		ridge_min = 0.04
		ridge_max = 0.1
		twist_max = 0.095
		center_drift_max = 0.12

	var bounded_energy: float = clampf(energy, 0.0, 1.0)
	return {
		"role": role,
		"body_taper": rng.range_float(body_taper_min, body_taper_max),
		"waist_ratio": rng.range_float(waist_min, waist_max),
		"shoulder_height_ratio": rng.range_float(shoulder_min, shoulder_max),
		"termination_depth_ratio": rng.range_float(termination_min, termination_max),
		"facet_phase": rng.range_float(-0.22, 0.22),
		"ring_twist": rng.range_float(-twist_max, twist_max),
		"ridge_strength": rng.range_float(ridge_min, ridge_max) * lerpf(0.85, 1.12, bounded_energy),
		"center_drift_x": rng.range_float(-center_drift_max, center_drift_max),
		"center_drift_z": rng.range_float(-center_drift_max, center_drift_max),
		"tip_offset_x": rng.range_float(-tip_offset_max, tip_offset_max),
		"tip_offset_z": rng.range_float(-tip_offset_max, tip_offset_max),
	}


func _channel(event, name: String) -> float:
	return clampf(float(event.channels.get(name, 0.0)), 0.0, 1.0)
