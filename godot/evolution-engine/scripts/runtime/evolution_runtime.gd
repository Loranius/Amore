extends Node3D

const Model = preload("res://scripts/core/evolution_model.gd")
const GrowthEngine = preload("res://scripts/growth/growth_engine.gd")
const CrystalMeshBuilder = preload("res://scripts/geometry/crystal_mesh_builder.gd")
const CrystalFusionBuilder = preload("res://scripts/geometry/crystal_fusion_builder.gd")
const CrystalColonyProjection = preload("res://scripts/geometry/crystal_colony_projection.gd")
const CrystalLifeEngine = preload("res://scripts/life/crystal_life_engine.gd")
const WebPortalBridge = preload("res://scripts/runtime/web_portal_bridge.gd")

@onready var artifact_root: Node3D = $ArtifactRoot
@onready var status_label: Label = $UI/SafeArea/StatusPanel/StatusMargin/StatusLabel

var current_state = null
var web_bridge = null
var life_engine = null
var current_projected_count := 0
var current_reduced_motion := false


func _ready() -> void:
	life_engine = CrystalLifeEngine.new()
	life_engine.name = "CrystalLifeEngine"
	add_child(life_engine)

	web_bridge = WebPortalBridge.new()
	web_bridge.name = "WebPortalBridge"
	web_bridge.payload_received.connect(_on_web_payload_received)
	add_child(web_bridge)
	rebuild_from_payload(_demo_payload(), "demo")


func rebuild_from_json(payload_json: String) -> bool:
	var parsed = JSON.parse_string(payload_json)
	if typeof(parsed) != TYPE_DICTIONARY:
		_report_error("Evolution payload must be a JSON object.")
		return false
	return rebuild_from_payload(parsed, "portal")


func rebuild_from_payload(payload: Dictionary, source: String = "runtime") -> bool:
	var dna_payload: Dictionary = payload.get("dna", {})
	var dna := Model.ArtifactDNA.new(
		int(dna_payload.get("seed", 1)),
		StringName(dna_payload.get("species", "crystal")),
		String(dna_payload.get("engine_version", "godot-0.1.0")),
		Dictionary(dna_payload.get("traits", {})),
	)

	if dna.species != &"crystal":
		_report_error("Bootstrap runtime currently supports Crystal only.")
		return false

	var events: Array = []
	for event_payload in payload.get("events", []):
		if typeof(event_payload) == TYPE_DICTIONARY:
			events.append(Model.EvolutionEvent.from_dictionary(event_payload))

	var previous_ids: Dictionary = _instruction_id_set(current_state)
	var next_state = GrowthEngine.new().rebuild(dna, events)
	var cues: Dictionary = _new_growth_cues(previous_ids, next_state, source)
	current_state = next_state
	current_reduced_motion = bool(dna.traits.get("reduced_motion", false))
	if web_bridge != null:
		current_reduced_motion = (
			current_reduced_motion or web_bridge.prefers_reduced_motion()
		)
	_render_state(
		Dictionary(cues.get("reveal", {})),
		Dictionary(cues.get("impact", {})),
	)
	_update_status(source)
	_post_runtime_state(source)
	print("AMORE_EVOLUTION_SNAPSHOT=" + canonical_snapshot_json())
	return true


func canonical_snapshot_json() -> String:
	if current_state == null:
		return "{}"
	return JSON.stringify(current_state.canonical_snapshot())


func _render_state(reveal_ids: Dictionary, impact_ids: Dictionary) -> void:
	if life_engine != null:
		life_engine.clear_entries()
	for child in artifact_root.get_children():
		child.free()

	var crystal_builder := CrystalMeshBuilder.new()
	var fusion_builder := CrystalFusionBuilder.new()
	var projected: Array = CrystalColonyProjection.new().build(current_state)
	current_projected_count = projected.size()
	if life_engine != null:
		life_engine.configure(current_state.dna.seed, current_reduced_motion)
	if not projected.is_empty():
		artifact_root.add_child(
			fusion_builder.create_foundation_instance(projected[0]),
		)

	# Aggregate-only event instructions are canonical evidence, not separate
	# meshes. The colony projection folds their bounded gains into the visible
	# seed so accumulated history reads as one mineral body.
	for instruction in projected:
		var crystal_instance: MeshInstance3D = crystal_builder.create_mesh_instance(instruction)
		_apply_crystal_shadow_policy(crystal_instance)
		artifact_root.add_child(crystal_instance)
		if life_engine != null:
			life_engine.register_instance(
				crystal_instance,
				instruction,
				reveal_ids.has(instruction.id),
				impact_ids.has(instruction.id),
			)


func _new_growth_cues(previous_ids: Dictionary, next_state, source: String) -> Dictionary:
	var reveal: Dictionary = {}
	var impact: Dictionary = {}
	if source == "demo":
		return {"reveal": reveal, "impact": impact}

	for instruction in next_state.instructions:
		if previous_ids.has(instruction.id):
			continue
		if String(instruction.metadata.get("role", "")) != "event-growth":
			continue
		if String(instruction.metadata.get("render_mode", "visible")) == "aggregate-only":
			var target_id: String = String(
				instruction.metadata.get("colony_target_id", ""),
			)
			if not target_id.is_empty():
				impact[target_id] = true
		else:
			reveal[instruction.id] = true
			impact[instruction.id] = true
	return {"reveal": reveal, "impact": impact}


func _instruction_id_set(state) -> Dictionary:
	var ids: Dictionary = {}
	if state == null:
		return ids
	for instruction in state.instructions:
		ids[instruction.id] = true
	return ids


func _apply_crystal_shadow_policy(instance: MeshInstance3D) -> void:
	# Opaque Web rendering is retained for stable sorting, but a child Crystal
	# must not paint a black contact shadow onto its parent inside the intentional
	# fusion overlap. Direct lighting, facet normals, Sky reflections and cast
	# shadows on the environment remain active.
	var array_mesh := instance.mesh as ArrayMesh
	if array_mesh == null or array_mesh.get_surface_count() == 0:
		return
	var material := array_mesh.surface_get_material(0) as StandardMaterial3D
	if material != null:
		material.disable_receive_shadows = true


func _update_status(source: String) -> void:
	var motion_label := "reduced motion" if current_reduced_motion else "life active"
	status_label.text = (
		"Godot 4.7.1 · Crystal Phase 9\n"
		+ "%d canonical · %d rendered bodies\n" % [
			current_state.instructions.size(),
			current_projected_count,
		]
		+ "seed %d · %s · %s" % [current_state.dna.seed, source, motion_label]
	)


func _post_runtime_state(source: String) -> void:
	if web_bridge == null or current_state == null:
		return

	var snapshot_json := canonical_snapshot_json()
	web_bridge.post_message({
		"type": "amore:godot:state",
		"version": "4.7.1",
		"source": source,
		"species": String(current_state.dna.species),
		"seed": current_state.dna.seed,
		"instructions": current_state.instructions.size(),
		"rendered_instructions": current_projected_count,
		"history": current_state.history.size(),
		"motion": "reduced" if current_reduced_motion else "full",
		"life_version": CrystalLifeEngine.VERSION,
		"signature": snapshot_json.sha256_text().substr(0, 16),
	})


func _on_web_payload_received(payload_json: String) -> void:
	rebuild_from_json(payload_json)


func _report_error(message: String) -> void:
	push_error(message)
	if web_bridge != null:
		web_bridge.post_message({
			"type": "amore:godot:error",
			"message": message,
		})


func _demo_payload() -> Dictionary:
	return {
		"dna": {
			"seed": 582013,
			"species": "crystal",
			"engine_version": "godot-0.1.0",
			"traits": {
				"identity": "amore-reference-druse",
				"growth_mode": "surface-attached",
			},
		},
		"events": [
			{
				"id": "memory:first-place",
				"occurred_at": "2024-02-12",
				"source": "map@1",
				"evidence": "verified",
				"channels": {"exploration": 0.88, "remembrance": 0.52},
				"portal_activity": 0.28,
			},
			{
				"id": "wishlist:first-gift",
				"occurred_at": "2024-05-20",
				"source": "wishlist@1",
				"evidence": "verified",
				"channels": {"achievement": 0.82, "significance": 0.76},
				"portal_activity": 0.34,
			},
			{
				"id": "plans:shared-goal",
				"occurred_at": "2024-09-08",
				"source": "plans@1",
				"evidence": "verified",
				"channels": {"stability": 0.91, "achievement": 0.55},
				"portal_activity": 0.31,
			},
			{
				"id": "memory:anniversary",
				"occurred_at": "2025-01-18",
				"source": "memories@1",
				"evidence": "verified",
				"channels": {"remembrance": 0.96, "significance": 0.84},
				"portal_activity": 0.42,
			},
			{
				"id": "calendar:culture-night",
				"occurred_at": "2025-06-04",
				"source": "calendar@1",
				"evidence": "verified",
				"channels": {"culture": 0.86, "remembrance": 0.44},
				"portal_activity": 0.26,
			},
			{
				"id": "plans:completed-trip",
				"occurred_at": "2026-03-22",
				"source": "plans@1",
				"evidence": "verified",
				"channels": {"exploration": 0.74, "achievement": 0.92, "significance": 0.58},
				"portal_activity": 0.48,
			},
		],
	}
