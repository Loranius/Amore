extends SceneTree

const Model = preload("res://scripts/core/evolution_model.gd")
const GrowthEngine = preload("res://scripts/growth/growth_engine.gd")


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

	if first_state.instructions.size() != payloads.size() + 1:
		_fail("Growth history failure: expected genesis plus one instruction per event.")
		return

	if first_state.history.size() != first_state.instructions.size():
		_fail("Append-only history failure: history and instruction counts differ.")
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
