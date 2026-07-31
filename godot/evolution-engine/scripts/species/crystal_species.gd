extends RefCounted

const Model = preload("res://scripts/core/evolution_model.gd")
const DeterministicRNG = preload("res://scripts/core/deterministic_rng.gd")

const MOTHER_ID := "crystal:mother"


func create_mother(dna) -> RefCounted:
	var rng = DeterministicRNG.new(dna.seed)
	return Model.GrowthInstruction.new(
		MOTHER_ID,
		"",
		0,
		Vector3.ZERO,
		Vector3.UP,
		rng.range_float(0.54, 0.68),
		rng.range_float(3.45, 4.15),
		rng.range_int(6, 8),
		1.0,
		"genesis",
		{
			"role": "mother",
			"hue_shift": rng.range_float(-0.04, 0.04),
			"cap_base": true,
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
	var along_ratio: float = rng.range_float(0.18, 0.82)
	var parent_radius_at_attachment: float = parent.radius * lerpf(1.05, 0.72, along_ratio)
	var attach_position: Vector3 = (
		parent.attach_position
		+ parent_direction * parent.length * along_ratio
		+ radial * parent_radius_at_attachment * 0.72
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
	if direction.y < 0.08:
		direction = (direction + Vector3.UP * (0.16 - direction.y)).normalized()

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
			"hue_shift": rng.range_float(-0.08, 0.12) + culture * 0.04,
			"cap_base": false,
			"attachment_ratio": along_ratio,
		},
	)


func _select_parent(event, event_index: int, state, rng) -> RefCounted:
	if state.instructions.size() <= 1 or event_index < 3:
		return state.instructions[0]

	var remembrance: float = _channel(event, "remembrance")
	var stability: float = _channel(event, "stability")
	if remembrance + stability > 1.2:
		return state.instructions[0]

	var available_count: int = mini(state.instructions.size(), 1 + int(floor(float(event_index) / 2.0)))
	var selected_index: int = rng.range_int(0, maxi(0, available_count - 1))
	return state.instructions[selected_index]


func _channel(event, name: String) -> float:
	return clampf(float(event.channels.get(name, 0.0)), 0.0, 1.0)
