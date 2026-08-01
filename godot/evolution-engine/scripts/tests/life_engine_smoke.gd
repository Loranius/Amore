extends SceneTree

const Model = preload("res://scripts/core/evolution_model.gd")
const GrowthEngine = preload("res://scripts/growth/growth_engine.gd")
const CrystalColonyProjection = preload("res://scripts/geometry/crystal_colony_projection.gd")
const CrystalMeshBuilder = preload("res://scripts/geometry/crystal_mesh_builder.gd")
const CrystalLifeProfile = preload("res://scripts/life/crystal_life_profile.gd")
const CrystalLifeEngine = preload("res://scripts/life/crystal_life_engine.gd")


func _init() -> void:
	call_deferred("_run")


func _run() -> void:
	var dna := Model.ArtifactDNA.new(
		440817,
		&"crystal",
		"godot-0.1.0",
		{"identity": "life-engine-smoke"},
	)
	var events: Array = [
		Model.EvolutionEvent.from_dictionary({
			"id": "life:memory",
			"occurred_at": "2025-01-01",
			"source": "memories@1",
			"channels": {"remembrance": 0.88, "significance": 0.62},
			"portal_activity": 0.32,
		}),
		Model.EvolutionEvent.from_dictionary({
			"id": "life:wish",
			"occurred_at": "2025-02-01",
			"source": "wishlist@1",
			"channels": {"significance": 0.82, "culture": 0.36},
			"portal_activity": 0.42,
		}),
	]
	var state = GrowthEngine.new().rebuild(dna, events)
	var canonical_before: String = JSON.stringify(state.canonical_snapshot())
	var projected: Array = CrystalColonyProjection.new().build(state)
	var instruction = _first_event_instruction(projected)
	if instruction == null:
		_fail("Life failure: no visible event instruction was projected.")
		return

	var profile = CrystalLifeProfile.new()
	var first: Dictionary = profile.sample(dna.seed, instruction, 2.75, 0.35, 0.28, false)
	var second: Dictionary = profile.sample(dna.seed, instruction, 2.75, 0.35, 0.28, false)
	if JSON.stringify(first) != JSON.stringify(second):
		_fail("Life failure: identical presentation samples are not deterministic.")
		return
	if String(first.get("version", "")) != CrystalLifeProfile.VERSION:
		_fail("Life failure: profile version metadata is missing.")
		return
	if float(first.get("emission_factor", 0.0)) < CrystalLifeProfile.MIN_EMISSION_FACTOR:
		_fail("Life failure: emission factor fell below its bound.")
		return
	if float(first.get("emission_factor", 0.0)) > CrystalLifeProfile.MAX_EMISSION_FACTOR:
		_fail("Life failure: emission factor exceeded its bound.")
		return
	if float(first.get("rim_factor", 0.0)) < CrystalLifeProfile.MIN_RIM_FACTOR:
		_fail("Life failure: rim factor fell below its bound.")
		return
	if float(first.get("rim_factor", 0.0)) > CrystalLifeProfile.MAX_RIM_FACTOR:
		_fail("Life failure: rim factor exceeded its bound.")
		return
	if float(first.get("impact_flash", 0.0)) > CrystalLifeProfile.MAX_IMPACT_FLASH:
		_fail("Life failure: impact flash exceeded its bound.")
		return
	if float(first.get("axial_scale", 0.0)) < CrystalLifeProfile.MIN_AXIAL_REVEAL_SCALE:
		_fail("Life failure: axial reveal escaped its lower bound.")
		return
	if float(first.get("radial_scale", 0.0)) < CrystalLifeProfile.MIN_RADIAL_REVEAL_SCALE:
		_fail("Life failure: radial reveal escaped its lower bound.")
		return

	var reduced: Dictionary = profile.sample(dna.seed, instruction, 9.0, 0.0, 0.0, true)
	if bool(reduced.get("active", true)):
		_fail("Life failure: reduced motion still reports active animation.")
		return
	for key in ["emission_factor", "rim_factor", "axial_scale", "radial_scale", "reveal_progress"]:
		if not is_equal_approx(float(reduced.get(key, 0.0)), 1.0):
			_fail("Life failure: reduced motion did not resolve to a static sample.")
			return
	if not is_zero_approx(float(reduced.get("impact_flash", -1.0))):
		_fail("Life failure: reduced motion retained an impact flash.")
		return

	var holder := Node3D.new()
	holder.name = "LifeSmokeHolder"
	get_root().add_child(holder)
	var life_engine = CrystalLifeEngine.new()
	holder.add_child(life_engine)
	life_engine.configure(dna.seed, false)
	var instance: MeshInstance3D = CrystalMeshBuilder.new().create_mesh_instance(instruction)
	holder.add_child(instance)
	if not life_engine.register_instance(instance, instruction, true, true):
		_fail("Life failure: controller rejected a valid Crystal instance.")
		return
	if life_engine.entry_count() != 1:
		_fail("Life failure: registered body count is incorrect.")
		return
	if instance.scale.y > 0.2 or instance.scale.x < CrystalLifeProfile.MIN_RADIAL_REVEAL_SCALE:
		_fail("Life failure: new growth did not start from the bounded reveal pose.")
		return

	life_engine.advance(0.52)
	if instance.scale.y <= CrystalLifeProfile.MIN_AXIAL_REVEAL_SCALE or instance.scale.y >= 1.0:
		_fail("Life failure: reveal did not progress through an intermediate pose.")
		return
	var animated_material := instance.material_override as StandardMaterial3D
	if animated_material == null:
		_fail("Life failure: controller did not own a duplicated material.")
		return
	if animated_material.emission_energy_multiplier > CrystalLifeEngine.MAX_EMISSION_ENERGY:
		_fail("Life failure: animated emission exceeded the mobile bound.")
		return
	if animated_material.rim > CrystalLifeEngine.MAX_RIM_STRENGTH:
		_fail("Life failure: animated rim exceeded the mobile bound.")
		return

	life_engine.advance(1.2)
	if instance.scale.distance_to(Vector3.ONE) > 0.0001:
		_fail("Life failure: reveal did not settle at the canonical presentation scale.")
		return
	life_engine.configure(dna.seed, true)
	if not life_engine.is_reduced_motion():
		_fail("Life failure: controller did not enter reduced-motion mode.")
		return
	if instance.scale.distance_to(Vector3.ONE) > 0.0001:
		_fail("Life failure: reduced motion did not restore static scale.")
		return

	var canonical_after: String = JSON.stringify(state.canonical_snapshot())
	if canonical_before != canonical_after:
		_fail("Life failure: presentation animation mutated canonical state.")
		return

	holder.queue_free()
	print("PASS: crystal life engine; entries=1 reduced_motion=true")
	quit(0)


func _first_event_instruction(projected: Array):
	for instruction in projected:
		if String(instruction.metadata.get("role", "")) == "event-growth":
			return instruction
	return null


func _fail(message: String) -> void:
	push_error(message)
	quit(1)
