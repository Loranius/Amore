extends RefCounted

const Model = preload("res://scripts/core/evolution_model.gd")
const CrystalSpecies = preload("res://scripts/species/crystal_species.gd")
const CrystalGrowthHierarchy = preload("res://scripts/growth/crystal_growth_hierarchy.gd")

const COLLISION_ATTEMPTS := 12
const SAMPLE_STEPS := [0.32, 0.58, 0.82, 1.0]


func rebuild(dna, source_events: Array):
	var state := Model.EvolutionState.new(dna)
	var species := CrystalSpecies.new()
	var hierarchy := CrystalGrowthHierarchy.new()
	for genesis_instruction in species.create_genesis_instructions(dna):
		state.append_instruction(genesis_instruction)

	var events := source_events.duplicate()
	events.sort_custom(func(left, right): return left.sort_key() < right.sort_key())

	for event_index in range(events.size()):
		var event = events[event_index]
		var candidate = species.translate_event(dna, event, event_index, state)
		candidate = hierarchy.apply(dna, candidate, event, event_index, state)
		candidate = _resolve_competition(candidate, state)
		state.append_instruction(candidate, event)

	return state


func _resolve_competition(candidate, state):
	_apply_silhouette_floor(candidate)
	var original_direction: Vector3 = candidate.direction
	var parent = state.get_instruction(candidate.parent_id)
	var rotation_axis: Vector3 = parent.direction if parent != null else Vector3.UP

	for attempt in range(COLLISION_ATTEMPTS):
		if _is_clear(candidate, state):
			candidate.metadata["collision_attempt"] = attempt
			candidate.metadata["growth_shadow"] = float(attempt) / float(COLLISION_ATTEMPTS)
			return candidate

		var alternating_sign := -1.0 if attempt % 2 == 0 else 1.0
		var angular_step := deg_to_rad(13.0 + float(attempt) * 4.5) * alternating_sign
		candidate.direction = original_direction.rotated(rotation_axis, angular_step).normalized()
		candidate.direction = (candidate.direction + Vector3.UP * float(attempt) * 0.012).normalized()
		_apply_silhouette_floor(candidate)

	# Bounded fallback: preserve the event and identity while reducing occupied volume.
	candidate.radius *= 0.72
	candidate.length *= 0.82
	candidate.direction = (candidate.direction + Vector3.UP * 0.16).normalized()
	_apply_silhouette_floor(candidate)
	candidate.metadata["collision_attempt"] = COLLISION_ATTEMPTS
	candidate.metadata["growth_shadow"] = 1.0
	candidate.metadata["competition_fallback"] = true
	return candidate


func _apply_silhouette_floor(candidate) -> void:
	var tier: String = String(candidate.metadata.get("silhouette_tier", ""))
	if tier.is_empty():
		return
	var minimum_y := 0.24 if tier == CrystalGrowthHierarchy.TIER_PRIMARY else (
		0.14 if tier == CrystalGrowthHierarchy.TIER_SECONDARY else 0.07
	)
	if candidate.direction.y >= minimum_y:
		return
	var lateral := Vector3(candidate.direction.x, 0.0, candidate.direction.z)
	if lateral.length_squared() < 0.000001:
		candidate.direction = Vector3.UP
		return
	var lateral_weight: float = sqrt(maxf(0.0, 1.0 - minimum_y * minimum_y))
	candidate.direction = lateral.normalized() * lateral_weight + Vector3.UP * minimum_y
	candidate.direction = candidate.direction.normalized()


func _is_clear(candidate, state) -> bool:
	for existing in state.instructions:
		# A child is intentionally allowed to overlap its parent close to the base;
		# the geometry layer later turns that overlap into an organic merge.
		if existing.id == candidate.parent_id:
			continue

		var required_clearance: float = (candidate.radius + existing.radius) * 1.12
		for candidate_step in SAMPLE_STEPS:
			var candidate_point: Vector3 = candidate.sample_point(candidate_step)
			for existing_step in SAMPLE_STEPS:
				var existing_point: Vector3 = existing.sample_point(existing_step)
				if candidate_point.distance_to(existing_point) < required_clearance:
					return false

	return true
