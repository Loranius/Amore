extends RefCounted

const DeterministicRNG = preload("res://scripts/core/deterministic_rng.gd")

const MOTHER_ID := "crystal:mother"
const ROLE_EVENT := "event-growth"
const RENDER_AGGREGATE := "aggregate-only"
const TIER_PRIMARY := "primary"
const TIER_SECONDARY := "secondary"
const TIER_ACCENT := "accent"
const HIERARCHY_VERSION := "crystal-hierarchy-v1"
const MAX_EVENT_GENERATION := 3


func apply(dna, candidate, event, event_index: int, state):
	var tier: String = _classify_tier(event)
	var prominence: float = _prominence(event)
	var parent = _choose_parent(
		dna.seed,
		candidate,
		tier,
		event_index,
		state,
	)

	if parent != null:
		_reattach_to_parent(dna.seed, candidate, event, tier, parent)
		_apply_scale(candidate, tier, prominence, parent)
		candidate.metadata["parent_child_count_before"] = _count_event_children(parent.id, state)
		candidate.metadata["parent_capacity"] = _parent_capacity(parent)

	candidate.metadata["silhouette_tier"] = tier
	candidate.metadata["prominence"] = prominence
	candidate.metadata["hierarchy_version"] = HIERARCHY_VERSION
	candidate.metadata["hierarchy_generation_cap"] = MAX_EVENT_GENERATION
	candidate.metadata["hierarchy_event_index"] = event_index
	return candidate


func _classify_tier(event) -> String:
	var significance: float = _channel(event, "significance")
	var achievement: float = _channel(event, "achievement")
	var exploration: float = _channel(event, "exploration")
	var culture: float = _channel(event, "culture")
	var prominence: float = _prominence(event)

	if prominence >= 0.68 or significance + achievement >= 1.18:
		return TIER_PRIMARY
	if prominence < 0.42 or exploration + culture >= 1.24:
		return TIER_ACCENT
	return TIER_SECONDARY


func _prominence(event) -> float:
	return clampf(
		0.2
		+ event.portal_activity * 0.24
		+ _channel(event, "significance") * 0.24
		+ _channel(event, "achievement") * 0.18
		+ _channel(event, "remembrance") * 0.08
		+ _channel(event, "stability") * 0.06,
		0.0,
		1.0,
	)


func _choose_parent(
	dna_seed: int,
	candidate,
	tier: String,
	event_index: int,
	state,
):
	var mother = state.get_instruction(MOTHER_ID)
	if mother == null:
		return state.get_instruction(candidate.parent_id)
	if event_index < 3:
		return mother

	var best_parent = null
	var best_score := -1.0e20
	for possible_parent in state.instructions:
		if not _is_parent_eligible(possible_parent, tier, state):
			continue

		var score: float = _parent_score(possible_parent, tier, state)
		var jitter_seed: int = DeterministicRNG.seed_from_text(
			"%s|%s|%s" % [candidate.id, possible_parent.id, tier],
			dna_seed,
		)
		var jitter_rng = DeterministicRNG.new(jitter_seed)
		score += jitter_rng.range_float(-0.11, 0.11)
		if score > best_score:
			best_score = score
			best_parent = possible_parent

	return best_parent if best_parent != null else mother


func _is_parent_eligible(parent, tier: String, state) -> bool:
	if String(parent.metadata.get("render_mode", "visible")) == RENDER_AGGREGATE:
		return false
	var role: String = String(parent.metadata.get("role", ""))
	if parent.id != MOTHER_ID and role != ROLE_EVENT:
		return false
	if parent.generation >= MAX_EVENT_GENERATION:
		return false
	if tier == TIER_PRIMARY and parent.generation >= 2:
		return false
	return _count_event_children(parent.id, state) < _parent_capacity(parent)


func _parent_score(parent, tier: String, state) -> float:
	var child_count: int = _count_event_children(parent.id, state)
	var score: float = parent.direction.y * 0.5 - float(child_count) * 0.62
	var parent_tier: String = String(parent.metadata.get("silhouette_tier", TIER_SECONDARY))

	if parent.id == MOTHER_ID:
		score += 1.15 if tier == TIER_PRIMARY else 0.2
		if tier == TIER_ACCENT:
			score -= 0.9
	else:
		score += 0.55
		score -= float(parent.generation) * (0.48 if tier == TIER_PRIMARY else 0.18)

	if tier == TIER_PRIMARY:
		if parent_tier == TIER_PRIMARY:
			score += 0.28
	elif tier == TIER_SECONDARY:
		if parent_tier != TIER_ACCENT:
			score += 0.2
	else:
		score += (1.0 - parent.direction.y) * 0.42
		if parent_tier == TIER_ACCENT:
			score += 0.16
	return score


func _reattach_to_parent(
	dna_seed: int,
	candidate,
	event,
	tier: String,
	parent,
) -> void:
	var rng_seed: int = DeterministicRNG.seed_from_text(
		"hierarchy:%s|%s" % [candidate.id, parent.id],
		dna_seed,
	)
	var rng = DeterministicRNG.new(rng_seed)
	var parent_direction: Vector3 = parent.direction.normalized()
	var tangent_a: Vector3 = parent_direction.cross(Vector3.UP)
	if tangent_a.length_squared() < 0.000001:
		tangent_a = parent_direction.cross(Vector3.RIGHT)
	tangent_a = tangent_a.normalized()
	var tangent_b: Vector3 = parent_direction.cross(tangent_a).normalized()
	var spin: float = rng.range_float(0.0, TAU)
	var radial: Vector3 = (tangent_a * cos(spin) + tangent_b * sin(spin)).normalized()

	var along_min := 0.18
	var along_max := 0.54
	if tier == TIER_SECONDARY:
		along_min = 0.28
		along_max = 0.68
	elif tier == TIER_ACCENT:
		along_min = 0.4
		along_max = 0.76
	var along_ratio: float = rng.range_float(along_min, along_max)
	var parent_radius_at_attachment: float = parent.radius * lerpf(1.08, 0.7, along_ratio)
	var surface_offset_ratio: float = rng.range_float(0.75, 0.86)
	candidate.parent_id = parent.id
	candidate.generation = mini(parent.generation + 1, MAX_EVENT_GENERATION)
	candidate.attach_position = (
		parent.attach_position
		+ parent_direction * parent.length * along_ratio
		+ radial * parent_radius_at_attachment * surface_offset_ratio
	)

	var inherited_force := 0.58
	var outward_force := 0.58
	var upward_force := 0.18
	if tier == TIER_SECONDARY:
		inherited_force = 0.48
		outward_force = 0.66
		upward_force = 0.13
	elif tier == TIER_ACCENT:
		inherited_force = 0.34
		outward_force = 0.82
		upward_force = 0.08

	outward_force += _channel(event, "exploration") * 0.12
	inherited_force += _channel(event, "stability") * 0.1
	upward_force += _channel(event, "achievement") * 0.08
	var mutation: Vector3 = rng.direction_in_cone(radial, deg_to_rad(14.0))
	candidate.direction = (
		parent_direction * inherited_force
		+ radial * outward_force
		+ Vector3.UP * upward_force
		+ mutation * 0.07
	).normalized()
	var minimum_y := 0.24 if tier == TIER_PRIMARY else (0.14 if tier == TIER_SECONDARY else 0.07)
	if candidate.direction.y < minimum_y:
		candidate.direction = (
			candidate.direction + Vector3.UP * (minimum_y - candidate.direction.y + 0.04)
		).normalized()

	candidate.metadata["attachment_ratio"] = along_ratio
	candidate.metadata["surface_offset_ratio"] = surface_offset_ratio
	candidate.metadata["merge_depth_ratio"] = rng.range_float(0.5, 0.65)


func _apply_scale(candidate, tier: String, prominence: float, parent) -> void:
	var length_scale := 1.02
	var radius_scale := 1.0
	if tier == TIER_SECONDARY:
		length_scale = 0.88
		radius_scale = 0.9
	elif tier == TIER_ACCENT:
		length_scale = 0.72
		radius_scale = 0.76

	length_scale *= lerpf(0.92, 1.08, prominence)
	radius_scale *= lerpf(0.94, 1.06, prominence)
	candidate.length *= length_scale
	candidate.radius *= radius_scale

	var max_length_ratio := 0.52
	var max_radius_ratio := 0.48
	if parent.id != MOTHER_ID:
		max_length_ratio = 0.78 if tier == TIER_PRIMARY else (0.7 if tier == TIER_SECONDARY else 0.58)
		max_radius_ratio = 0.74 if tier == TIER_PRIMARY else (0.66 if tier == TIER_SECONDARY else 0.54)
	elif tier == TIER_SECONDARY:
		max_length_ratio = 0.43
		max_radius_ratio = 0.4
	elif tier == TIER_ACCENT:
		max_length_ratio = 0.34
		max_radius_ratio = 0.33

	candidate.length = minf(candidate.length, parent.length * max_length_ratio)
	candidate.radius = minf(candidate.radius, parent.radius * max_radius_ratio)
	candidate.length = maxf(candidate.length, candidate.radius * 3.2)
	candidate.metadata["hierarchy_length_ratio"] = candidate.length / parent.length
	candidate.metadata["hierarchy_radius_ratio"] = candidate.radius / parent.radius


func _parent_capacity(parent) -> int:
	if parent.id == MOTHER_ID:
		return 4
	var tier: String = String(parent.metadata.get("silhouette_tier", TIER_SECONDARY))
	return 2 if tier == TIER_PRIMARY else 1


func _count_event_children(parent_id: String, state) -> int:
	var count := 0
	for instruction in state.instructions:
		if instruction.parent_id != parent_id:
			continue
		if String(instruction.metadata.get("render_mode", "visible")) == RENDER_AGGREGATE:
			continue
		if String(instruction.metadata.get("role", "")) == ROLE_EVENT:
			count += 1
	return count


func _channel(event, name: String) -> float:
	return clampf(float(event.channels.get(name, 0.0)), 0.0, 1.0)
