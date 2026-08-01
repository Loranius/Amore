extends SceneTree

const Model = preload("res://scripts/core/evolution_model.gd")
const GrowthEngine = preload("res://scripts/growth/growth_engine.gd")
const CrystalMeshBuilder = preload("res://scripts/geometry/crystal_mesh_builder.gd")
const CrystalFusionBuilder = preload("res://scripts/geometry/crystal_fusion_builder.gd")
const CrystalVisualProfile = preload("res://scripts/presentation/crystal_visual_profile.gd")


func _init() -> void:
	call_deferred("_run")


func _run() -> void:
	var dna := Model.ArtifactDNA.new(
		582013,
		&"crystal",
		"godot-0.1.0",
		{"identity": "phase-ten-visual-smoke"},
	)
	var payloads := [
		{
			"id": "visual:map",
			"occurred_at": "2024-01-01",
			"source": "map@1",
			"evidence": "verified",
			"channels": {"exploration": 0.92, "culture": 0.18},
			"portal_activity": 0.34,
		},
		{
			"id": "visual:memory",
			"occurred_at": "2024-02-01",
			"source": "memories@1",
			"evidence": "verified",
			"channels": {"remembrance": 0.95, "significance": 0.42},
			"portal_activity": 0.3,
		},
		{
			"id": "visual:photo",
			"occurred_at": "2024-03-01",
			"source": "photos@1",
			"evidence": "verified",
			"channels": {"culture": 0.78, "remembrance": 0.25},
			"portal_activity": 0.28,
		},
		{
			"id": "visual:plan",
			"occurred_at": "2024-04-01",
			"source": "plans@1",
			"evidence": "verified",
			"channels": {"achievement": 0.94, "stability": 0.72},
			"portal_activity": 0.4,
		},
		{
			"id": "visual:wish",
			"occurred_at": "2024-05-01",
			"source": "wishlist@1",
			"evidence": "verified",
			"channels": {"significance": 0.9, "culture": 0.38},
			"portal_activity": 0.36,
		},
	]
	var events: Array = []
	for payload in payloads:
		events.append(Model.EvolutionEvent.from_dictionary(payload))
	var state = GrowthEngine.new().rebuild(dna, events)
	var profile = CrystalVisualProfile.new()

	if CrystalVisualProfile.VERSION.is_empty():
		_fail("Visual failure: profile version is missing.")
		return
	var yaw_a: float = profile.default_yaw_degrees(dna.seed)
	var yaw_b: float = profile.default_yaw_degrees(dna.seed)
	if not is_equal_approx(yaw_a, yaw_b) or yaw_a < 24.0 or yaw_a > 34.0:
		_fail("Visual failure: default presentation angle is not deterministic or oblique.")
		return

	var palette_buckets: Dictionary = {}
	for payload in payloads:
		var instruction = state.get_instruction("crystal:%s" % String(payload.id))
		if instruction == null:
			_fail("Visual failure: fixture instruction is missing.")
			return
		var first: Color = profile.base_color(instruction)
		var second: Color = profile.base_color(instruction)
		if not first.is_equal_approx(second):
			_fail("Visual failure: palette projection is not deterministic.")
			return
		palette_buckets[int(roundf(first.h * 24.0))] = true
	if palette_buckets.size() < 4:
		_fail("Visual failure: semantic fixtures do not span enough mineral colour families.")
		return

	var mother = state.instructions[0]
	var bias_a: Vector3 = profile.body_bias(mother)
	var bias_b: Vector3 = profile.body_bias(mother)
	if not bias_a.is_equal_approx(bias_b) or bias_a.length() > 0.08:
		_fail("Visual failure: body bias is not deterministic or bounded.")
		return

	var mesh: ArrayMesh = CrystalMeshBuilder.new().create_mesh(mother)
	if mesh == null or mesh.get_surface_count() != 1:
		_fail("Visual failure: polished mother mesh is missing.")
		return
	var arrays: Array = mesh.surface_get_arrays(0)
	var vertex_colors: PackedColorArray = arrays[Mesh.ARRAY_COLOR]
	if vertex_colors.size() < 24:
		_fail("Visual failure: vertex colour buffer is incomplete.")
		return
	var unique_colors: Dictionary = {}
	for color in vertex_colors:
		unique_colors["%.3f:%.3f:%.3f" % [color.r, color.g, color.b]] = true
	if unique_colors.size() < 8:
		_fail("Visual failure: crystal lacks base-to-tip and facet colour variation.")
		return

	var material := mesh.surface_get_material(0) as StandardMaterial3D
	if material == null:
		_fail("Visual failure: optical material is missing.")
		return
	if material.transparency != BaseMaterial3D.TRANSPARENCY_DISABLED:
		_fail("Visual failure: Phase 10 broke opaque mobile sorting.")
		return
	if material.roughness < 0.2 or material.roughness > 0.35:
		_fail("Visual failure: crystal roughness escaped the accepted mobile bounds.")
		return
	if material.clearcoat < 0.25 or material.clearcoat > 0.65:
		_fail("Visual failure: crystal clearcoat escaped the accepted bounds.")
		return
	if material.emission_energy_multiplier > 0.03:
		_fail("Visual failure: crystal emission exceeds the mobile budget.")
		return

	var foundation_mesh: ArrayMesh = CrystalFusionBuilder.new().create_foundation_mesh(mother)
	var foundation_material := foundation_mesh.surface_get_material(0) as StandardMaterial3D
	if foundation_material == null:
		_fail("Visual failure: mineral foundation material is missing.")
		return
	if foundation_material.roughness < 0.42 or foundation_material.roughness > 0.5:
		_fail("Visual failure: mineral foundation roughness is outside accepted bounds.")
		return
	if foundation_material.emission_energy_multiplier > 0.008:
		_fail("Visual failure: mineral foundation emission exceeds the mobile budget.")
		return

	var packed_scene := load("res://scenes/evolution_engine.tscn") as PackedScene
	if packed_scene == null:
		_fail("Visual failure: Evolution Engine scene could not be loaded.")
		return
	var scene := packed_scene.instantiate()
	if scene.has_node("Floor"):
		scene.free()
		_fail("Visual failure: a visible floor or pedestal is still present.")
		return
	var artifact_root := scene.get_node("ArtifactRoot") as Node3D
	if artifact_root == null or artifact_root.position.y < 0.1:
		scene.free()
		_fail("Visual failure: floating artifact framing is not configured.")
		return
	var camera := scene.get_node("CameraRig/Camera3D") as Camera3D
	if camera == null or camera.fov < 35.0 or camera.fov > 40.0:
		scene.free()
		_fail("Visual failure: mobile camera field of view is outside Phase 10 framing.")
		return
	var world := scene.get_node("WorldEnvironment") as WorldEnvironment
	var environment := world.environment
	if environment.background_mode != Environment.BG_SKY:
		scene.free()
		_fail("Visual failure: Phase 10 must preserve the procedural Sky background.")
		return
	if environment.sky == null or not (environment.sky.sky_material is ProceduralSkyMaterial):
		scene.free()
		_fail("Visual failure: readable procedural slate Sky is missing.")
		return
	var sky_material := environment.sky.sky_material as ProceduralSkyMaterial
	if sky_material.sky_top_color.get_luminance() < 0.025:
		scene.free()
		_fail("Visual failure: presentation Sky collapsed back to near-black.")
		return
	if environment.background_energy_multiplier < 0.75 or environment.background_energy_multiplier > 1.05:
		scene.free()
		_fail("Visual failure: background exposure is outside the accepted dark-slate range.")
		return
	if not environment.glow_enabled or environment.glow_intensity > 0.22:
		scene.free()
		_fail("Visual failure: glow is missing or exceeds the restrained accent budget.")
		return

	var light_count := 0
	for child in scene.get_children():
		if child is Light3D:
			light_count += 1
			if child.light_energy > 1.2:
				scene.free()
				_fail("Visual failure: a presentation light exceeds the mobile energy budget.")
				return
	if light_count != 3:
		scene.free()
		_fail("Visual failure: Phase 10 must retain exactly three presentation lights.")
		return

	scene.free()
	print("PASS: crystal visual polish; palette=%d colours=%d lights=%d" % [
		palette_buckets.size(),
		unique_colors.size(),
		light_count,
	])
	quit(0)


func _fail(message: String) -> void:
	push_error(message)
	quit(1)
