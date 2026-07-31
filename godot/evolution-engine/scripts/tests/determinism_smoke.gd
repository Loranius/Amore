extends SceneTree

const Model = preload("res://scripts/core/evolution_model.gd")
const GrowthEngine = preload("res://scripts/growth/growth_engine.gd")
const CrystalSpecies = preload("res://scripts/species/crystal_species.gd")


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

	var genesis_count := 1 + CrystalSpecies.BASAL_CROWN_COUNT
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

	for index in range(genesis_count, first_state.instructions.size()):
		var event_growth = first_state.instructions[index]
		if first_state.get_instruction(event_growth.parent_id) == null:
			_fail("Lineage failure: event growth parent is missing.")
			return
		var merge_depth := float(event_growth.metadata.get("merge_depth_ratio", 0.0))
		if merge_depth < 0.45 or merge_depth > 0.7:
			_fail("Attachment failure: event growth merge depth is outside bounds.")
			return

	print("PASS: deterministic crystal rebuild; instructions=%d" % first_state.instructions.size())
	quit(0)


func _fail(message: String) -> void:
	push_error(message)
	quit(1)


func _events_from_payloads(payloads: Array) -> Array:
	var events: Array = []
	for payload in payloads:
		events.append(Model.EvolutionEvent.from_dictionary(payload))
	return events
