extends Node3D

const Model = preload("res://scripts/core/evolution_model.gd")
const GrowthEngine = preload("res://scripts/growth/growth_engine.gd")
const CrystalMeshBuilder = preload("res://scripts/geometry/crystal_mesh_builder.gd")
const CrystalFusionBuilder = preload("res://scripts/geometry/crystal_fusion_builder.gd")
const CrystalColonyProjection = preload("res://scripts/geometry/crystal_colony_projection.gd")
const CrystalLifeEngine = preload("res://scripts/life/crystal_life_engine.gd")
const CrystalVisualProfile = preload("res://scripts/presentation/crystal_visual_profile.gd")
const WebPortalBridge = preload("res://scripts/runtime/web_portal_bridge.gd")
const RuntimeQualityGovernor = preload("res://scripts/runtime/runtime_quality_governor.gd")

const TELEMETRY_INTERVAL_SECONDS := 1.0
const SUSPEND_STATES := ["hidden", "pagehide", "freeze", "context-lost"]
const RESUME_STATES := ["visible", "pageshow", "resume", "context-restored"]

@onready var world_environment: WorldEnvironment = $WorldEnvironment
@onready var key_light: DirectionalLight3D = $KeyLight
@onready var artifact_root: Node3D = $ArtifactRoot
@onready var camera_rig: Node3D = $CameraRig
@onready var status_panel: PanelContainer = $UI/SafeArea/StatusPanel
@onready var status_label: Label = $UI/SafeArea/StatusPanel/StatusMargin/StatusLabel

var current_state = null
var web_bridge = null
var life_engine = null
var quality_governor = null
var current_quality_settings: Dictionary = {}
var current_projected_count := 0
var current_input_event_count := 0
var current_reduced_motion := false
var current_source := "demo"
var runtime_suspended := false
var restore_count := 0
var telemetry_elapsed := 0.0
var interaction_sequence := 0


func _ready() -> void:
	life_engine = CrystalLifeEngine.new()
	life_engine.name = "CrystalLifeEngine"
	add_child(life_engine)

	quality_governor = RuntimeQualityGovernor.new()

	web_bridge = WebPortalBridge.new()
	web_bridge.name = "WebPortalBridge"
	web_bridge.payload_received.connect(_on_web_payload_received)
	web_bridge.lifecycle_received.connect(_on_web_lifecycle_received)
	add_child(web_bridge)

	current_quality_settings = quality_governor.configure(
		web_bridge.runtime_capabilities(),
		"auto",
	)
	_apply_quality_settings()
	set_process(true)

	if camera_rig.has_signal("portal_activate"):
		camera_rig.connect("portal_activate", _on_portal_activate)
	if camera_rig.has_signal("portal_interaction"):
		camera_rig.connect("portal_interaction", _on_portal_interaction)
	rebuild_from_payload(_demo_payload(), "demo")


func _process(delta: float) -> void:
	telemetry_elapsed += maxf(delta, 0.0)
	if telemetry_elapsed < TELEMETRY_INTERVAL_SECONDS:
		return
	telemetry_elapsed = 0.0

	var fps := float(Engine.get_frames_per_second())
	if not runtime_suspended and quality_governor.observe_fps(fps):
		current_quality_settings = quality_governor.current_settings()
		_apply_quality_settings()
	_post_runtime_telemetry(fps)


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

	var requested_quality := String(dna.traits.get("runtime_quality", "auto"))
	current_quality_settings = quality_governor.configure(
		web_bridge.runtime_capabilities(),
		requested_quality,
	)
	_apply_quality_settings()

	var events: Array = []
	for event_payload in payload.get("events", []):
		if typeof(event_payload) == TYPE_DICTIONARY:
			events.append(Model.EvolutionEvent.from_dictionary(event_payload))
	current_input_event_count = events.size()

	var previous_ids: Dictionary = _instruction_id_set(current_state)
	var next_state = GrowthEngine.new().rebuild(dna, events)
	var cues: Dictionary = _new_growth_cues(previous_ids, next_state, source)
	current_state = next_state
	current_source = source
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
	_post_runtime_telemetry(float(Engine.get_frames_per_second()))
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

	var visual_profile := CrystalVisualProfile.new()
	artifact_root.rotation = Vector3(
		deg_to_rad(visual_profile.default_tilt_degrees(current_state.dna.seed)),
		deg_to_rad(visual_profile.default_yaw_degrees(current_state.dna.seed)),
		0.0,
	)

	var crystal_builder := CrystalMeshBuilder.new()
	var fusion_builder := CrystalFusionBuilder.new()
	var projected: Array = CrystalColonyProjection.new().build(current_state)
	current_projected_count = projected.size()
	if life_engine != null:
		life_engine.configure(current_state.dna.seed, current_reduced_motion)
		life_engine.set_update_hz(float(current_quality_settings.get("life_hz", 30.0)))
		life_engine.set_runtime_paused(runtime_suspended)
	if not projected.is_empty():
		artifact_root.add_child(
			fusion_builder.create_foundation_instance(projected[0]),
		)

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
	# Every opaque Crystal body intentionally overlaps its neighbours at fused
	# junctions. Letting any body receive those contact shadows paints black
	# wedges across the mother Crystal that read as missing front geometry.
	# Keep direct lighting and shadow casting, but suppress receive shadows on
	# the complete fused mass, including generation zero.
	var array_mesh := instance.mesh as ArrayMesh
	if array_mesh == null or array_mesh.get_surface_count() == 0:
		return
	var material := array_mesh.surface_get_material(0) as StandardMaterial3D
	if material != null:
		material.disable_receive_shadows = true


func _apply_quality_settings() -> void:
	if current_quality_settings.is_empty():
		return
	var viewport := get_viewport()
	viewport.scaling_3d_scale = float(current_quality_settings.get("render_scale", 0.86))
	key_light.shadow_enabled = bool(current_quality_settings.get("shadows", true))
	if world_environment.environment != null:
		world_environment.environment.glow_enabled = bool(
			current_quality_settings.get("glow", true),
		)
	if life_engine != null:
		life_engine.set_update_hz(float(current_quality_settings.get("life_hz", 30.0)))


func _update_status(source: String) -> void:
	var motion_label := "reduced motion" if current_reduced_motion else "life active"
	status_panel.visible = source != "portal"
	status_label.text = (
		"Godot 4.7.1 · Crystal Phase 13\n"
		+ "%d canonical · %d rendered bodies\n" % [
			current_state.instructions.size(),
			current_projected_count,
		]
		+ "seed %d · %s · %s · %s" % [
			current_state.dna.seed,
			source,
			motion_label,
			String(current_quality_settings.get("quality", "balanced")),
		]
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
		"input_events": current_input_event_count,
		"history": current_state.history.size(),
		"motion": "reduced" if current_reduced_motion else "full",
		"life_version": CrystalLifeEngine.VERSION,
		"visual_version": CrystalVisualProfile.VERSION,
		"quality_version": RuntimeQualityGovernor.VERSION,
		"quality": String(current_quality_settings.get("quality", "balanced")),
		"render_scale": float(current_quality_settings.get("render_scale", 0.86)),
		"life_hz": float(current_quality_settings.get("life_hz", 30.0)),
		"phase": 13,
		"signature": snapshot_json.sha256_text().substr(0, 16),
	})


func _post_runtime_telemetry(fps: float) -> void:
	if web_bridge == null or current_source != "portal":
		return
	var safe_fps := maxf(0.0, fps)
	var frame_ms := 1000.0 / safe_fps if safe_fps > 0.0 else 0.0
	var static_memory_bytes := float(Performance.get_monitor(Performance.MEMORY_STATIC))
	web_bridge.post_message({
		"type": "amore:godot:telemetry",
		"version": "4.7.1",
		"quality": String(current_quality_settings.get("quality", "balanced")),
		"fps": safe_fps,
		"frame_ms": frame_ms,
		"draw_calls": int(Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME)),
		"primitives": int(Performance.get_monitor(Performance.RENDER_TOTAL_PRIMITIVES_IN_FRAME)),
		"static_memory_mb": static_memory_bytes / (1024.0 * 1024.0),
		"render_scale": float(current_quality_settings.get("render_scale", 0.86)),
		"life_hz": float(current_quality_settings.get("life_hz", 30.0)),
		"suspended": runtime_suspended,
		"restores": restore_count,
	})


func _on_web_payload_received(payload_json: String) -> void:
	rebuild_from_json(payload_json)


func _on_web_lifecycle_received(event: Dictionary) -> void:
	var state := String(event.get("state", ""))
	var was_suspended := runtime_suspended
	if state in SUSPEND_STATES:
		runtime_suspended = true
	elif state in RESUME_STATES:
		runtime_suspended = false
	else:
		return

	if was_suspended and not runtime_suspended:
		restore_count += 1
		_apply_quality_settings()
	if life_engine != null:
		life_engine.set_runtime_paused(runtime_suspended)
	camera_rig.set_process_unhandled_input(not runtime_suspended)

	web_bridge.post_message({
		"type": "amore:godot:lifecycle",
		"state": state,
		"sequence": int(event.get("sequence", 0)),
		"suspended": runtime_suspended,
		"restores": restore_count,
	})
	_post_runtime_telemetry(float(Engine.get_frames_per_second()))


func _on_portal_activate(source: String) -> void:
	if web_bridge == null or runtime_suspended:
		return
	web_bridge.post_message({
		"type": "amore:godot:activate",
		"source": source,
	})


func _on_portal_interaction(kind: String) -> void:
	if web_bridge == null or runtime_suspended:
		return
	interaction_sequence += 1
	web_bridge.post_message({
		"type": "amore:godot:interaction",
		"kind": kind,
		"sequence": interaction_sequence,
	})


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
				"runtime_quality": "auto",
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
