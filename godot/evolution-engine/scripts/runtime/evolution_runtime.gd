extends Node3D

const Model = preload("res://scripts/core/evolution_model.gd")
const GrowthEngine = preload("res://scripts/growth/growth_engine.gd")
const CrystalMeshBuilder = preload("res://scripts/geometry/crystal_mesh_builder.gd")
const CrystalFusionBuilder = preload("res://scripts/geometry/crystal_fusion_builder.gd")
const WebPortalBridge = preload("res://scripts/runtime/web_portal_bridge.gd")

@onready var artifact_root: Node3D = $ArtifactRoot
@onready var status_label: Label = $UI/SafeArea/StatusPanel/StatusMargin/StatusLabel

var current_state = null
var web_bridge = null


func _ready() -> void:
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

	current_state = GrowthEngine.new().rebuild(dna, events)
	_render_state()
	_update_status(source)
	_post_runtime_state(source)
	print("AMORE_EVOLUTION_SNAPSHOT=" + canonical_snapshot_json())
	return true


func canonical_snapshot_json() -> String:
	if current_state == null:
		return "{}"
	return JSON.stringify(current_state.canonical_snapshot())


func _render_state() -> void:
	for child in artifact_root.get_children():
		child.free()

	var crystal_builder := CrystalMeshBuilder.new()
	var fusion_builder := CrystalFusionBuilder.new()
	if not current_state.instructions.is_empty():
		artifact_root.add_child(
			fusion_builder.create_foundation_instance(current_state.instructions[0]),
		)

	# Every attached Crystal now carries its buried root and surface flare in
	# the same ArrayMesh. Rendering a second collar here would recreate the
	# visible bracelet seam Phase 5 is intended to remove.
	for instruction in current_state.instructions:
		var crystal_instance: MeshInstance3D = crystal_builder.create_mesh_instance(instruction)
		_apply_crystal_shadow_policy(crystal_instance)
		artifact_root.add_child(crystal_instance)


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
	status_label.text = (
		"Godot 4.7.1 · Crystal Phase 5\n"
		+ "%d accepted growth instructions\n" % current_state.instructions.size()
		+ "seed %d · %s rebuild" % [current_state.dna.seed, source]
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
		"history": current_state.history.size(),
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
