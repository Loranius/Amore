extends SceneTree

const Model = preload("res://scripts/core/evolution_model.gd")
const GrowthEngine = preload("res://scripts/growth/growth_engine.gd")
const CrystalSemanticPressure = preload("res://scripts/species/crystal_semantic_pressure.gd")

const PRESSURE_KEYS := [
	"expansion",
	"internal_density",
	"polishing",
	"structural",
	"luminosity",
]


func _init() -> void:
	call_deferred("_run")


func _run() -> void:
	var fixtures := [
		{
			"id": "place:semantic:visited",
			"occurred_at": "2024-01-01",
			"source": "map@1",
			"evidence": "verified",
			"channels": {"exploration": 0.72, "culture": 0.22},
			"portal_activity": 0.2,
			"expected_family": "map",
			"expected_dominant": "expansion",
		},
		{
			"id": "memory:semantic:preserved",
			"occurred_at": "2024-02-01",
			"source": "memories@1",
			"evidence": "verified",
			"channels": {"remembrance": 0.75, "significance": 0.15},
			"portal_activity": 0.05,
			"expected_family": "memories",
			"expected_dominant": "internal_density",
		},
		{
			"id": "photo:semantic:preserved",
			"occurred_at": "2024-03-01",
			"source": "photos@1",
			"evidence": "verified",
			"channels": {"culture": 0.5, "remembrance": 0.2},
			"portal_activity": 0.1,
			"expected_family": "photos",
			"expected_dominant": "polishing",
		},
		{
			"id": "plan:semantic:completed",
			"occurred_at": "2024-04-01",
			"source": "plans@1",
			"evidence": "verified",
			"channels": {"achievement": 0.8, "stability": 0.5, "significance": 0.6},
			"portal_activity": 0.32,
			"expected_family": "plans",
			"expected_dominant": "structural",
		},
		{
			"id": "wish:semantic:fulfilled",
			"occurred_at": "2024-05-01",
			"source": "wishlist@1",
			"evidence": "verified",
			"channels": {"significance": 0.7, "culture": 0.3},
			"portal_activity": 0.24,
			"expected_family": "wishlist",
			"expected_dominant": "luminosity",
		},
	]

	var translator = CrystalSemanticPressure.new()
	var events: Array = []
	for fixture in fixtures:
		var event = Model.EvolutionEvent.from_dictionary(fixture)
		var first: Dictionary = translator.evaluate(event)
		var second: Dictionary = translator.evaluate(event)
		if JSON.stringify(first) != JSON.stringify(second):
			_fail("Semantic failure: identical events produced different pressure fields.")
			return
		if String(first.get("version", "")) != CrystalSemanticPressure.VERSION:
			_fail("Semantic failure: version metadata is missing.")
			return
		if String(first.get("source_family", "")) != String(fixture.expected_family):
			_fail("Semantic failure: module source family was not normalized.")
			return
		if String(first.get("dominant", "")) != String(fixture.expected_dominant):
			_fail("Semantic failure: module did not produce its accepted dominant pressure.")
			return

		var pressure: Dictionary = Dictionary(first.get("pressure", {}))
		if pressure.size() != PRESSURE_KEYS.size():
			_fail("Semantic failure: pressure vector is incomplete.")
			return
		for key in PRESSURE_KEYS:
			var value: float = float(pressure.get(key, -1.0))
			if value < 0.0 or value > 1.0:
				_fail("Semantic failure: pressure value is outside canonical bounds.")
				return
		events.append(event)

	var dna := Model.ArtifactDNA.new(
		771204,
		&"crystal",
		"godot-0.1.0",
		{"identity": "semantic-pressure-smoke"},
	)
	var state = GrowthEngine.new().rebuild(dna, events)
	for fixture in fixtures:
		var instruction_id := "crystal:%s" % String(fixture.id)
		var instruction = state.get_instruction(instruction_id)
		if instruction == null:
			_fail("Semantic failure: translated growth instruction is missing.")
			return
		if String(instruction.metadata.get("semantic_source_family", "")) != String(fixture.expected_family):
			_fail("Semantic failure: source family was not serialized with growth.")
			return
		if String(instruction.metadata.get("semantic_dominant", "")) != String(fixture.expected_dominant):
			_fail("Semantic failure: dominant pressure was not serialized with growth.")
			return
		if String(instruction.metadata.get("semantic_projection_version", "")).is_empty():
			_fail("Semantic failure: projection version is missing.")
			return
		if float(instruction.metadata.get("semantic_length_scale", 0.0)) <= 0.0:
			_fail("Semantic failure: length projection scale is invalid.")
			return
		if float(instruction.metadata.get("semantic_radius_scale", 0.0)) <= 0.0:
			_fail("Semantic failure: radius projection scale is invalid.")
			return

	print("PASS: crystal semantic pressure; events=%d" % fixtures.size())
	quit(0)


func _fail(message: String) -> void:
	push_error(message)
	quit(1)
