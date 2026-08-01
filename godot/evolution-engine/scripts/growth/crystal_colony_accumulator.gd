extends RefCounted

## Groups compatible Crystal events into bounded mineral colonies. Canonical
## event instructions remain append-only, but compatible events may become
## aggregate deposits instead of independent visible columns.

const VERSION := "crystal-colony-accumulation-v1"
const MODE_SEED := "seed"
const MODE_EXTENSION := "extension"
const MODE_THICKENING := "thickening"
const MODE_REFINEMENT := "refinement"
const RENDER_VISIBLE := "visible"
const RENDER_AGGREGATE := "aggregate-only"
const MAX_MEMBERS_PER_COLONY := 7
const COMPATIBILITY_THRESHOLD := 0.62
const PRESSURE_KEYS := [
	"expansion",
	"internal_density",
	"polishing",
	"structural",
	"luminosity",
]


func apply(dna, candidate, event, event_index: int, state):
	var colonies: Array = _open_colonies(state)
	var match: Dictionary = _best_match(candidate, colonies, state)
	if match.is_empty() or float(match.get("score", 0.0)) < COMPATIBILITY_THRESHOLD:
		_mark_seed(candidate, event_index, colonies.size())
		return candidate

	var target = match.get("instruction")
	var mode: String = _aggregate_mode(candidate)
	_mark_aggregate(
		dna,
		candidate,
		target,
		mode,
		float(match.get("score", 0.0)),
		event_index,
		state,
	)
	return candidate


func is_aggregate(instruction) -> bool:
	return String(instruction.metadata.get("render_mode", RENDER_VISIBLE)) == RENDER_AGGREGATE


func _open_colonies(state) -> Array:
	var colonies: Array = []
	for instruction in state.instructions:
		if String(instruction.metadata.get("colony_mode", "")) != MODE_SEED:
			continue
		if _colony_member_count(instruction.id, state) >= MAX_MEMBERS_PER_COLONY:
			continue
		colonies.append(instruction)
	return colonies


func _best_match(candidate, colonies: Array, state) -> Dictionary:
	if colonies.is_empty():
		return {}

	var best_instruction = null
	var best_score := -1.0
	for colony in colonies:
		var member_count: int = _colony_member_count(colony.id, state)
		var similarity: float = _pressure_similarity(candidate, colony)
		var dominant_bonus := 0.0
		if String(candidate.metadata.get("semantic_dominant", "")) == String(
			colony.metadata.get("semantic_dominant", ""),
		):
			dominant_bonus = 0.2
		var source_bonus := 0.0
		if String(candidate.metadata.get("semantic_source_family", "")) == String(
			colony.metadata.get("semantic_source_family", ""),
		):
			source_bonus = 0.08
		var saturation: float = float(member_count) / float(MAX_MEMBERS_PER_COLONY)
		var score: float = similarity * 0.74 + dominant_bonus + source_bonus - saturation * 0.08
		if score > best_score:
			best_score = score
			best_instruction = colony

	if best_instruction == null:
		return {}
	return {
		"instruction": best_instruction,
		"score": clampf(best_score, 0.0, 1.0),
	}


func _pressure_similarity(left, right) -> float:
	var left_pressure: Dictionary = Dictionary(left.metadata.get("semantic_pressure", {}))
	var right_pressure: Dictionary = Dictionary(right.metadata.get("semantic_pressure", {}))
	var difference := 0.0
	for key in PRESSURE_KEYS:
		difference += absf(
			float(left_pressure.get(key, 0.0)) - float(right_pressure.get(key, 0.0)),
		)
	return clampf(1.0 - difference / float(PRESSURE_KEYS.size()), 0.0, 1.0)


func _aggregate_mode(candidate) -> String:
	var pressure: Dictionary = Dictionary(candidate.metadata.get("semantic_pressure", {}))
	var expansion: float = float(pressure.get("expansion", 0.0))
	var density: float = float(pressure.get("internal_density", 0.0))
	var polishing: float = float(pressure.get("polishing", 0.0))
	var structural: float = float(pressure.get("structural", 0.0))
	var luminosity: float = float(pressure.get("luminosity", 0.0))

	if expansion >= maxf(density, maxf(polishing, maxf(structural, luminosity))):
		return MODE_EXTENSION
	if density + structural * 0.55 >= maxf(polishing, luminosity) * 1.08:
		return MODE_THICKENING
	return MODE_REFINEMENT


func _mark_seed(candidate, event_index: int, visible_index: int) -> void:
	candidate.metadata["colony_version"] = VERSION
	candidate.metadata["colony_mode"] = MODE_SEED
	candidate.metadata["render_mode"] = RENDER_VISIBLE
	candidate.metadata["colony_id"] = candidate.id
	candidate.metadata["colony_seed_id"] = candidate.id
	candidate.metadata["colony_target_id"] = candidate.id
	candidate.metadata["colony_member_index"] = 0
	candidate.metadata["colony_size_before"] = 0
	candidate.metadata["colony_event_index"] = event_index
	candidate.metadata["colony_visible_index"] = visible_index
	candidate.metadata["colony_compatibility"] = 1.0
	candidate.metadata["colony_radius_gain"] = 0.0
	candidate.metadata["colony_length_gain"] = 0.0
	candidate.metadata["colony_energy_gain"] = 0.0
	candidate.metadata["colony_polish_gain"] = 0.0
	candidate.metadata["colony_luminosity_gain"] = 0.0


func _mark_aggregate(
	dna,
	candidate,
	target,
	mode: String,
	compatibility: float,
	event_index: int,
	state,
) -> void:
	var member_count: int = _colony_member_count(target.id, state)
	var pressure: Dictionary = Dictionary(candidate.metadata.get("semantic_pressure", {}))
	var expansion: float = float(pressure.get("expansion", 0.0))
	var density: float = float(pressure.get("internal_density", 0.0))
	var polishing: float = float(pressure.get("polishing", 0.0))
	var structural: float = float(pressure.get("structural", 0.0))
	var luminosity: float = float(pressure.get("luminosity", 0.0))
	var diminishing: float = 1.0 / (1.0 + float(member_count) * 0.18)
	var shadow_factor: float = 1.0 - clampf(
		float(target.metadata.get("growth_shadow", 0.0)) * 0.35,
		0.0,
		0.35,
	)

	var radius_gain := 0.0
	var length_gain := 0.0
	var energy_gain := 0.0
	var polish_gain := 0.0
	var luminosity_gain := 0.0
	match mode:
		MODE_EXTENSION:
			length_gain = (0.035 + expansion * 0.09 + structural * 0.02) * diminishing
			radius_gain = (0.008 + structural * 0.018) * diminishing
			energy_gain = (0.006 + luminosity * 0.012) * diminishing
		MODE_THICKENING:
			radius_gain = (0.03 + density * 0.065 + structural * 0.04) * diminishing
			length_gain = (0.008 + expansion * 0.018) * diminishing
			energy_gain = (0.008 + luminosity * 0.012) * diminishing
		MODE_REFINEMENT:
			radius_gain = (0.005 + density * 0.012) * diminishing
			length_gain = (0.004 + expansion * 0.012) * diminishing
			energy_gain = (0.01 + luminosity * 0.025) * diminishing
			polish_gain = (0.025 + polishing * 0.075) * diminishing
			luminosity_gain = (0.015 + luminosity * 0.06) * diminishing

	radius_gain = clampf(radius_gain * shadow_factor, 0.0, 0.12)
	length_gain = clampf(length_gain * shadow_factor, 0.0, 0.13)
	energy_gain = clampf(energy_gain, 0.0, 0.04)
	polish_gain = clampf(polish_gain, 0.0, 0.09)
	luminosity_gain = clampf(luminosity_gain, 0.0, 0.075)

	candidate.parent_id = target.id
	candidate.generation = mini(target.generation + 1, 3)
	var along_ratio: float = 0.72 if mode == MODE_EXTENSION else (
		0.42 if mode == MODE_THICKENING else 0.58
	)
	candidate.attach_position = target.sample_point(along_ratio)
	candidate.direction = target.direction
	candidate.radius = maxf(0.01, target.radius * maxf(radius_gain, 0.025))
	candidate.length = maxf(0.05, target.length * maxf(length_gain, 0.035))
	candidate.energy = clampf(candidate.energy * 0.55, 0.0, 1.0)

	candidate.metadata["colony_version"] = VERSION
	candidate.metadata["colony_mode"] = mode
	candidate.metadata["render_mode"] = RENDER_AGGREGATE
	candidate.metadata["colony_id"] = target.id
	candidate.metadata["colony_seed_id"] = target.id
	candidate.metadata["colony_target_id"] = target.id
	candidate.metadata["colony_member_index"] = member_count
	candidate.metadata["colony_size_before"] = member_count
	candidate.metadata["colony_event_index"] = event_index
	candidate.metadata["colony_compatibility"] = compatibility
	candidate.metadata["colony_radius_gain"] = radius_gain
	candidate.metadata["colony_length_gain"] = length_gain
	candidate.metadata["colony_energy_gain"] = energy_gain
	candidate.metadata["colony_polish_gain"] = polish_gain
	candidate.metadata["colony_luminosity_gain"] = luminosity_gain
	candidate.metadata["colony_seed"] = dna.seed


func _colony_member_count(colony_id: String, state) -> int:
	var count := 0
	for instruction in state.instructions:
		if String(instruction.metadata.get("colony_id", "")) == colony_id:
			count += 1
	return count
