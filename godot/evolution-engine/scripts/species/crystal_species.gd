extends RefCounted

const Model = preload("res://scripts/core/evolution_model.gd")
const DeterministicRNG = preload("res://scripts/core/deterministic_rng.gd")

const MOTHER_ID := "crystal:mother"
const BASAL_CROWN_COUNT := 6


func create_genesis_instructions(dna) -> Array:
	var mother = create_mother(dna)
	var instructions: Array = [mother]
	var rng = DeterministicRNG.new(DeterministicRNG.seed_from_text("genesis:basal-crown", dna.seed))
	var phase_offset: float = rng.range_float(-0.18, 0.18)

	for index in range(BASAL_CROWN_COUNT):
		var spin := TAU * float(index) / float(BASAL_CROWN_COUNT) + phase_offset
		var radial := Vector3(cos(spin), 0.0, sin(spin)).normalized()
		var attach_position := (
			mother.attach_position
			+ Vector3.UP * rng.range_float(0.04, 0.15)
			+ radial * mother.radius * rng.range_float(0.34, 0.48)
		)
		var direction := (
			radial * rng.range_float(0.48, 0.72)
			+ Vector3.UP * rng.range_float(0.72, 0.94)
		).normalized()
		var energy := rng.range_float(0.42, 0.7)
		instructions.append(Model.GrowthInstruction.new(
			"crystal:genesis:basal:%02d" % index,
			MOTHER_ID,
			1,
			attach_position,
			direction,
			rng.range_float(0.16, 0.25),
			rng.range_float(0.74, 1.28),
			rng.range_int(5, 7),
			energy,
			"genesis",
			{
				"role": "basal-crown",
				"hue_shift": rng.range_float(-0.045, 0.075),
				"cap_base": false,
				"attachment_ratio": 0.03,
				"merge_depth_ratio": 0.58,
			},
		))

	return instructions


func create_mother(dna) -> RefCounted:
	var rng = DeterministicRNG.new(dna.seed)
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
		{
			"role": "mother",
			"hue_shift": rng.range_float(-0.035, 0.035),
			"cap_base": true,
			"merge_depth_ratio": 0.0,
		},
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
	var merge_depth_ratio := rng.range_float(0.48, 0.66)
	var attach_position: Vector3 = (
		parent.attach_position
		+ parent_direction * parent.length * along_ratio
		+ radial * parent_radius_at_attachment * (1.0 - merge_depth_ratio)
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
		{
			"source": event.source,
			"role": "event-growth",
			"hue_shift": rng.range_float(-0.065, 0.09) + culture * 0.035,
			"cap_base": false,
			"attachment_ratio": along_ratio,
			"merge_depth_ratio": merge_depth_ratio,
		},
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
	var event_parent_start := 1 + BASAL_CROWN_COUNT
	if state.instructions.size() <= event_parent_start:
		return state.instructions[0]
	var available_event_parents := state.instructions.size() - event_parent_start
	var selected_event_offset := rng.range_int(0, maxi(0, available_event_parents - 1))
	return state.instructions[event_parent_start + selected_event_offset]


func _channel(event, name: String) -> float:
	return clampf(float(event.channels.get(name, 0.0)), 0.0, 1.0)
