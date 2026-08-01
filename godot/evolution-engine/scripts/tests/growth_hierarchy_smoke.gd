extends SceneTree

const Model = preload("res://scripts/core/evolution_model.gd")
const GrowthEngine = preload("res://scripts/growth/growth_engine.gd")
const CrystalSpecies = preload("res://scripts/species/crystal_species.gd")
const CrystalGrowthHierarchy = preload("res://scripts/growth/crystal_growth_hierarchy.gd")


func _init() -> void:
	call_deferred("_run")


func _run() -> void:
	var dna := Model.ArtifactDNA.new(
		842771,
		&"crystal",
		"godot-0.1.0",
		{"identity": "growth-hierarchy-smoke"},
	)
	var events: Array = _build_events()
	var reverse_events: Array = events.duplicate()
	reverse_events.reverse()

	var first_state = GrowthEngine.new().rebuild(dna, events)
	var second_state = GrowthEngine.new().rebuild(dna, reverse_events)
	if JSON.stringify(first_state.canonical_snapshot()) != JSON.stringify(second_state.canonical_snapshot()):
		_fail("Hierarchy failure: event input order changed the canonical state.")
		return

	var genesis_count: int = 1 + CrystalSpecies.BASAL_CROWN_COUNT
	if first_state.instructions.size() != genesis_count + events.size():
		_fail("Hierarchy failure: accepted event growth was lost.")
		return

	var mother = first_state.get_instruction(CrystalSpecies.MOTHER_ID)
	if mother == null:
		_fail("Hierarchy failure: mother Crystal is missing.")
		return

	var tier_counts := {
		CrystalGrowthHierarchy.TIER_PRIMARY: 0,
		CrystalGrowthHierarchy.TIER_SECONDARY: 0,
		CrystalGrowthHierarchy.TIER_ACCENT: 0,
	}
	var event_child_counts: Dictionary = {}
	for index in range(genesis_count, first_state.instructions.size()):
		var instruction = first_state.instructions[index]
		var tier: String = String(instruction.metadata.get("silhouette_tier", ""))
		if not tier_counts.has(tier):
			_fail("Hierarchy failure: event growth has no valid silhouette tier.")
			return
		tier_counts[tier] = int(tier_counts[tier]) + 1

		if String(instruction.metadata.get("hierarchy_version", "")) != CrystalGrowthHierarchy.HIERARCHY_VERSION:
			_fail("Hierarchy failure: hierarchy version metadata is missing.")
			return
		var prominence: float = float(instruction.metadata.get("prominence", -1.0))
		if prominence < 0.0 or prominence > 1.0:
			_fail("Hierarchy failure: prominence is outside canonical bounds.")
			return
		if instruction.generation < 1 or instruction.generation > CrystalGrowthHierarchy.MAX_EVENT_GENERATION:
			_fail("Hierarchy failure: event generation exceeded the silhouette cap.")
			return
		if instruction.length >= mother.length:
			_fail("Hierarchy failure: event growth overtook the mother Crystal.")
			return
		if instruction.direction.y < 0.04:
			_fail("Hierarchy failure: a branch escaped below the accepted silhouette floor.")
			return

		var parent = first_state.get_instruction(instruction.parent_id)
		if parent == null:
			_fail("Hierarchy failure: selected parent does not exist.")
			return
		var parent_role: String = String(parent.metadata.get("role", ""))
		if parent.id != CrystalSpecies.MOTHER_ID and parent_role != "event-growth":
			_fail("Hierarchy failure: basal crown was used as an event parent.")
			return
		if instruction.length > parent.length * 0.8:
			_fail("Hierarchy failure: child length is not subordinate to its parent.")
			return
		if instruction.radius > parent.radius * 0.76:
			_fail("Hierarchy failure: child radius is not subordinate to its parent.")
			return

		event_child_counts[instruction.parent_id] = int(
			event_child_counts.get(instruction.parent_id, 0),
		) + 1

	for parent_id in event_child_counts:
		var parent = first_state.get_instruction(String(parent_id))
		var child_count: int = int(event_child_counts[parent_id])
		var capacity := 4 if parent.id == CrystalSpecies.MOTHER_ID else (
			2 if String(parent.metadata.get("silhouette_tier", "secondary")) == "primary" else 1
		)
		if child_count > capacity:
			_fail("Hierarchy failure: parent capacity was exceeded.")
			return

	for tier in tier_counts:
		if int(tier_counts[tier]) <= 0:
			_fail("Hierarchy failure: smoke fixture did not produce every silhouette tier.")
			return

	print(
		"PASS: crystal growth hierarchy; primary=%d secondary=%d accent=%d max_generation=%d"
		% [
			int(tier_counts[CrystalGrowthHierarchy.TIER_PRIMARY]),
			int(tier_counts[CrystalGrowthHierarchy.TIER_SECONDARY]),
			int(tier_counts[CrystalGrowthHierarchy.TIER_ACCENT]),
			CrystalGrowthHierarchy.MAX_EVENT_GENERATION,
		],
	)
	quit(0)


func _build_events() -> Array:
	var payloads := [
		["primary-a", "2025-01-01", {"significance": 0.95, "achievement": 0.82}, 0.72],
		["secondary-a", "2025-01-02", {"remembrance": 0.72, "stability": 0.58}, 0.45],
		["accent-a", "2025-01-03", {"exploration": 0.9, "culture": 0.72}, 0.28],
		["primary-b", "2025-01-04", {"significance": 0.84, "achievement": 0.74}, 0.68],
		["secondary-b", "2025-01-05", {"significance": 0.46, "remembrance": 0.66}, 0.52],
		["accent-b", "2025-01-06", {"exploration": 0.84, "culture": 0.62}, 0.31],
		["primary-c", "2025-01-07", {"achievement": 0.94, "significance": 0.69}, 0.76],
		["secondary-c", "2025-01-08", {"stability": 0.76, "remembrance": 0.58}, 0.49],
		["accent-c", "2025-01-09", {"exploration": 0.76, "culture": 0.7}, 0.24],
		["primary-d", "2025-01-10", {"significance": 0.91, "achievement": 0.64}, 0.7],
		["secondary-d", "2025-01-11", {"significance": 0.48, "stability": 0.61}, 0.5],
		["accent-d", "2025-01-12", {"exploration": 0.92, "culture": 0.44}, 0.26],
	]
	var events: Array = []
	for payload in payloads:
		events.append(Model.EvolutionEvent.new(
			"event:%s" % String(payload[0]),
			String(payload[1]),
			"hierarchy-smoke@1",
			"verified",
			Dictionary(payload[2]),
			float(payload[3]),
		))
	return events


func _fail(message: String) -> void:
	push_error(message)
	quit(1)
