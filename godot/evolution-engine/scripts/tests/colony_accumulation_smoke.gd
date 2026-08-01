extends SceneTree

const Model = preload("res://scripts/core/evolution_model.gd")
const GrowthEngine = preload("res://scripts/growth/growth_engine.gd")
const CrystalSpecies = preload("res://scripts/species/crystal_species.gd")
const CrystalColonyAccumulator = preload("res://scripts/growth/crystal_colony_accumulator.gd")
const CrystalColonyProjection = preload("res://scripts/geometry/crystal_colony_projection.gd")


func _init() -> void:
	call_deferred("_run")


func _run() -> void:
	var dna := Model.ArtifactDNA.new(
		918273,
		&"crystal",
		"godot-0.1.0",
		{"identity": "colony-accumulation-smoke"},
	)
	var events: Array = _build_events()
	var reverse_events: Array = events.duplicate()
	reverse_events.reverse()

	var state = GrowthEngine.new().rebuild(dna, events)
	var reverse_state = GrowthEngine.new().rebuild(dna, reverse_events)
	if JSON.stringify(state.canonical_snapshot()) != JSON.stringify(reverse_state.canonical_snapshot()):
		_fail("Colony failure: input order changed canonical accumulation.")
		return

	var genesis_count: int = 1 + CrystalSpecies.BASAL_CROWN_COUNT
	if state.instructions.size() != genesis_count + events.size():
		_fail("Colony failure: an event instruction was lost.")
		return
	if state.history.size() != state.instructions.size():
		_fail("Colony failure: append-only history no longer mirrors instructions.")
		return

	var seed_count := 0
	var aggregate_count := 0
	var mode_counts := {
		CrystalColonyAccumulator.MODE_EXTENSION: 0,
		CrystalColonyAccumulator.MODE_THICKENING: 0,
		CrystalColonyAccumulator.MODE_REFINEMENT: 0,
	}
	var members_by_colony: Dictionary = {}
	for index in range(genesis_count, state.instructions.size()):
		var instruction = state.instructions[index]
		var mode: String = String(instruction.metadata.get("colony_mode", ""))
		var render_mode: String = String(instruction.metadata.get("render_mode", ""))
		var colony_id: String = String(instruction.metadata.get("colony_id", ""))
		if String(instruction.metadata.get("colony_version", "")) != CrystalColonyAccumulator.VERSION:
			_fail("Colony failure: version metadata is missing.")
			return
		if colony_id.is_empty():
			_fail("Colony failure: event has no colony identity.")
			return
		members_by_colony[colony_id] = int(members_by_colony.get(colony_id, 0)) + 1

		if mode == CrystalColonyAccumulator.MODE_SEED:
			seed_count += 1
			if render_mode != CrystalColonyAccumulator.RENDER_VISIBLE:
				_fail("Colony failure: seed is not visible.")
				return
			if instruction.id != colony_id:
				_fail("Colony failure: seed does not own its colony ID.")
				return
		else:
			aggregate_count += 1
			if render_mode != CrystalColonyAccumulator.RENDER_AGGREGATE:
				_fail("Colony failure: deposit was exposed as a separate body.")
				return
			if not mode_counts.has(mode):
				_fail("Colony failure: aggregate mode is invalid.")
				return
			mode_counts[mode] = int(mode_counts[mode]) + 1
			var target = state.get_instruction(String(instruction.metadata.get("colony_target_id", "")))
			if target == null:
				_fail("Colony failure: aggregate target is missing.")
				return
			if String(target.metadata.get("colony_mode", "")) != CrystalColonyAccumulator.MODE_SEED:
				_fail("Colony failure: aggregate target is not a seed.")
				return
			if instruction.parent_id != target.id:
				_fail("Colony failure: aggregate lineage does not point to its seed.")
				return
			if String(instruction.metadata.get("competition_mode", "")) != "colony-aggregate":
				_fail("Colony failure: aggregate entered visible collision competition.")
				return

	for colony_id in members_by_colony:
		if int(members_by_colony[colony_id]) > CrystalColonyAccumulator.MAX_MEMBERS_PER_COLONY:
			_fail("Colony failure: a colony exceeded its bounded member count.")
			return

	if aggregate_count <= seed_count:
		_fail("Colony failure: fixture did not reduce visible body growth.")
		return
	for mode in mode_counts:
		if int(mode_counts[mode]) <= 0:
			_fail("Colony failure: fixture did not exercise every aggregate mode.")
			return

	var projected: Array = CrystalColonyProjection.new().build(state)
	if projected.size() != genesis_count + seed_count:
		_fail("Colony failure: renderer projection count is not genesis plus seeds.")
		return
	if projected.size() >= state.instructions.size():
		_fail("Colony failure: renderer still exposes every canonical event.")
		return

	var enlarged_radius := false
	var enlarged_length := false
	var refined_surface := false
	for instruction in projected:
		var base_radius: float = float(instruction.metadata.get("colony_base_radius", instruction.radius))
		var base_length: float = float(instruction.metadata.get("colony_base_length", instruction.length))
		var radius_gain: float = float(instruction.metadata.get("colony_radius_gain_total", 0.0))
		var length_gain: float = float(instruction.metadata.get("colony_length_gain_total", 0.0))
		var polish_gain: float = float(instruction.metadata.get("colony_polish_gain_total", 0.0))
		var luminosity_gain: float = float(instruction.metadata.get("colony_luminosity_gain_total", 0.0))
		if radius_gain < 0.0 or radius_gain > CrystalColonyProjection.MAX_RADIUS_GAIN + 0.000001:
			_fail("Colony failure: projected radius gain escaped its bound.")
			return
		if length_gain < 0.0 or length_gain > CrystalColonyProjection.MAX_LENGTH_GAIN + 0.000001:
			_fail("Colony failure: projected length gain escaped its bound.")
			return
		if instruction.radius > base_radius + 0.000001:
			enlarged_radius = true
		if instruction.length > base_length + 0.000001:
			enlarged_length = true
		if polish_gain > 0.0 or luminosity_gain > 0.0:
			refined_surface = true

	if not enlarged_radius or not enlarged_length or not refined_surface:
		_fail("Colony failure: projection did not express all accumulation outcomes.")
		return

	# Rebuilding a longer history may add deposits to a rendered projection,
	# but it must never rewrite an earlier canonical instruction or history row.
	var prefix_size := 20
	var prefix_events: Array = events.slice(0, prefix_size)
	var prefix_state = GrowthEngine.new().rebuild(dna, prefix_events)
	for instruction in prefix_state.instructions:
		var full_instruction = state.get_instruction(instruction.id)
		if full_instruction == null:
			_fail("Colony failure: prefix instruction disappeared from full history.")
			return
		if JSON.stringify(instruction.to_dictionary()) != JSON.stringify(full_instruction.to_dictionary()):
			_fail("Colony failure: later events rewrote canonical ancestors.")
			return
	for index in range(prefix_state.history.size()):
		if JSON.stringify(prefix_state.history[index]) != JSON.stringify(state.history[index]):
			_fail("Colony failure: later events rewrote append-only history.")
			return

	print(
		"PASS: crystal colony accumulation; events=%d seeds=%d aggregate=%d rendered=%d"
		% [events.size(), seed_count, aggregate_count, projected.size()],
	)
	quit(0)


func _build_events() -> Array:
	var events: Array = []
	for index in range(14):
		events.append(_event(
			"memory:%02d" % index,
			index,
			"memories@1",
			{"remembrance": 0.84, "stability": 0.42, "significance": 0.18},
			0.12,
		))
	for index in range(14):
		events.append(_event(
			"map:%02d" % index,
			14 + index,
			"map@1",
			{"exploration": 0.92, "culture": 0.24, "significance": 0.12},
			0.2,
		))
	for index in range(14):
		events.append(_event(
			"photo:%02d" % index,
			28 + index,
			"photos@1",
			{"culture": 0.72, "remembrance": 0.28, "significance": 0.16},
			0.14,
		))
	return events


func _event(
	id: String,
	index: int,
	source: String,
	channels: Dictionary,
	activity: float,
):
	var year_offset: int = floori(float(index) / 12.0)
	var year: int = 2023 + year_offset
	var month: int = index % 12 + 1
	return Model.EvolutionEvent.new(
		id,
		"%04d-%02d-01" % [year, month],
		source,
		"verified",
		channels,
		activity,
	)


func _fail(message: String) -> void:
	push_error(message)
	quit(1)
