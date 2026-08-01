extends RefCounted

## Produces the renderer-facing Crystal instruction list. Canonical aggregate
## deposits are folded into their colony seed so many events can become one
## continuous mineral body without mutating append-only history.

const Model = preload("res://scripts/core/evolution_model.gd")
const CrystalColonyAccumulator = preload("res://scripts/growth/crystal_colony_accumulator.gd")

const VERSION := "crystal-colony-projection-v1"
const MAX_RADIUS_GAIN := 0.34
const MAX_LENGTH_GAIN := 0.3
const MAX_ENERGY_GAIN := 0.16
const MAX_POLISH_GAIN := 0.24
const MAX_LUMINOSITY_GAIN := 0.2


func build(state) -> Array:
	var projected: Array = []
	var projected_by_id: Dictionary = {}

	for instruction in state.instructions:
		if String(instruction.metadata.get("render_mode", "visible")) == (
			CrystalColonyAccumulator.RENDER_AGGREGATE
		):
			_apply_deposit(instruction, projected_by_id)
			continue

		var clone = _clone_instruction(instruction)
		_prepare_projection_metadata(clone)
		projected.append(clone)
		projected_by_id[clone.id] = clone

	return projected


func _apply_deposit(deposit, projected_by_id: Dictionary) -> void:
	var target_id: String = String(deposit.metadata.get("colony_target_id", ""))
	var target = projected_by_id.get(target_id)
	if target == null:
		return

	var radius_gain: float = minf(
		MAX_RADIUS_GAIN,
		float(target.metadata.get("colony_radius_gain_total", 0.0))
		+ float(deposit.metadata.get("colony_radius_gain", 0.0)),
	)
	var length_gain: float = minf(
		MAX_LENGTH_GAIN,
		float(target.metadata.get("colony_length_gain_total", 0.0))
		+ float(deposit.metadata.get("colony_length_gain", 0.0)),
	)
	var energy_gain: float = minf(
		MAX_ENERGY_GAIN,
		float(target.metadata.get("colony_energy_gain_total", 0.0))
		+ float(deposit.metadata.get("colony_energy_gain", 0.0)),
	)
	var polish_gain: float = minf(
		MAX_POLISH_GAIN,
		float(target.metadata.get("colony_polish_gain_total", 0.0))
		+ float(deposit.metadata.get("colony_polish_gain", 0.0)),
	)
	var luminosity_gain: float = minf(
		MAX_LUMINOSITY_GAIN,
		float(target.metadata.get("colony_luminosity_gain_total", 0.0))
		+ float(deposit.metadata.get("colony_luminosity_gain", 0.0)),
	)

	var base_radius: float = float(target.metadata.get("colony_base_radius", target.radius))
	var base_length: float = float(target.metadata.get("colony_base_length", target.length))
	var base_energy: float = float(target.metadata.get("colony_base_energy", target.energy))
	var base_sides: int = int(target.metadata.get("colony_base_sides", target.sides))
	target.radius = base_radius * (1.0 + radius_gain)
	target.length = base_length * (1.0 + length_gain)
	target.energy = clampf(base_energy + energy_gain, 0.0, 1.0)
	target.sides = clampi(base_sides + int(roundf(polish_gain * 7.0)), 5, 12)

	target.metadata["colony_radius_gain_total"] = radius_gain
	target.metadata["colony_length_gain_total"] = length_gain
	target.metadata["colony_energy_gain_total"] = energy_gain
	target.metadata["colony_polish_gain_total"] = polish_gain
	target.metadata["colony_luminosity_gain_total"] = luminosity_gain
	target.metadata["colony_projected_members"] = (
		int(target.metadata.get("colony_projected_members", 1)) + 1
	)
	target.metadata["colony_projection_version"] = VERSION

	var pressure: Dictionary = Dictionary(target.metadata.get("semantic_pressure", {})).duplicate(true)
	pressure["internal_density"] = clampf(
		maxf(float(pressure.get("internal_density", 0.0)), radius_gain / MAX_RADIUS_GAIN),
		0.0,
		1.0,
	)
	pressure["expansion"] = clampf(
		maxf(float(pressure.get("expansion", 0.0)), length_gain / MAX_LENGTH_GAIN),
		0.0,
		1.0,
	)
	pressure["polishing"] = clampf(
		float(pressure.get("polishing", 0.0)) + polish_gain,
		0.0,
		1.0,
	)
	pressure["luminosity"] = clampf(
		float(pressure.get("luminosity", 0.0)) + luminosity_gain,
		0.0,
		1.0,
	)
	target.metadata["semantic_pressure"] = pressure
	target.metadata["semantic_polish_factor"] = float(pressure.get("polishing", 0.0))
	target.metadata["semantic_luminosity"] = float(pressure.get("luminosity", 0.0))

	var waist_ratio: float = float(target.metadata.get("waist_ratio", 0.98))
	target.metadata["waist_ratio"] = clampf(
		waist_ratio + radius_gain * 0.08,
		0.8,
		1.12,
	)
	var ridge_strength: float = float(target.metadata.get("ridge_strength", 0.055))
	target.metadata["ridge_strength"] = clampf(
		ridge_strength * lerpf(1.0, 0.72, polish_gain / MAX_POLISH_GAIN),
		0.0,
		0.14,
	)


func _prepare_projection_metadata(instruction) -> void:
	instruction.metadata["colony_projection_version"] = VERSION
	instruction.metadata["colony_base_radius"] = instruction.radius
	instruction.metadata["colony_base_length"] = instruction.length
	instruction.metadata["colony_base_energy"] = instruction.energy
	instruction.metadata["colony_base_sides"] = instruction.sides
	instruction.metadata["colony_radius_gain_total"] = 0.0
	instruction.metadata["colony_length_gain_total"] = 0.0
	instruction.metadata["colony_energy_gain_total"] = 0.0
	instruction.metadata["colony_polish_gain_total"] = 0.0
	instruction.metadata["colony_luminosity_gain_total"] = 0.0
	instruction.metadata["colony_projected_members"] = 1


func _clone_instruction(instruction):
	return Model.GrowthInstruction.new(
		instruction.id,
		instruction.parent_id,
		instruction.generation,
		instruction.attach_position,
		instruction.direction,
		instruction.radius,
		instruction.length,
		instruction.sides,
		instruction.energy,
		instruction.event_id,
		instruction.metadata,
	)
